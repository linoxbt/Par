// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";

/// @dev Implemented by ParCircuit: debt already booked against a clearing line.
interface ILineHolder {
    function outstanding(address vault, uint256 lineId) external view returns (uint256);
}

/// @dev Hook the factory exposes so vaultsOf() follows ownership transfers.
interface IParFactoryHook {
    function onVaultOwnerChanged(address from, address to) external;
}

/// @dev Implemented by ParMarket: cover requests a vault owner can fill (underwrite) in one call.
///      Declared here, not imported, so ParVault and ParMarket do not import each other.
interface IParMarket {
    enum RKind {
        Scheduled, // same numbering as ParVault.Kind
        Claim
    }

    enum RStatus {
        None, // no such request
        Open,
        Filled,
        Cancelled
    }

    /// @dev Packed into 8 slots. Field meanings match ParVault.Commitment; the principal of the
    ///      commitment is `requester`.
    struct Request {
        address requester;
        RKind kind;
        RStatus status;
        uint64 deadline; // last moment the request can be filled
        address beneficiary;
        uint64 start; // Scheduled
        uint32 period; // Scheduled
        address arbiter; // Claim
        uint32 grace; // Scheduled
        uint16 count; // Scheduled
        uint32 challengeWindow; // Claim
        address vault; // set when filled
        uint64 expiry;
        uint128 installment; // Scheduled
        uint128 cap;
        uint128 premium; // MUSD escrowed by the market, paid to the underwriter on fill
        uint256 commitmentId; // set when filled
        bytes32 ref; // metadata hash (e.g. pilot reference)
    }

    function getRequest(uint256 id) external view returns (Request memory);
    function onFill(uint256 id, uint256 commitmentId) external;
}

/// @title ParVault
/// @notice One vault per user (EIP-1167 clone). The vault is the MUSD trove's borrower,
///         so it controls the trove. Undrawn borrowing capacity is reserved against
///         "commitments" (guarantees and Circuit clearing lines). MUSD is only minted
///         when a commitment is called.
contract ParVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum Kind {
        Scheduled, // installment guarantee (rent, BNPL, supplier terms)
        Claim, // discretionary claim with challenge window + arbiter
        ClearingLine // credit line pledged to a ParCircuit circle
    }

    enum CStatus {
        None,
        Active,
        Closed
    }

    struct Commitment {
        Kind kind;
        CStatus status;
        address beneficiary; // receives payouts (for ClearingLine: the ParCircuit contract)
        address principal; // obligor; pays installments, may dispute claims
        address arbiter; // Claim only
        uint64 expiry; // after this, no new triggers; anyone may close
        uint128 cap; // maximum total the vault will ever pay on this commitment
        uint128 paidOut; // total paid so far
        // Scheduled
        uint128 installment;
        uint64 start; // due time of installment #0
        uint32 period; // seconds between installments
        uint32 grace; // seconds after due before a miss can be triggered
        uint16 count; // number of installments
        // Claim
        uint32 challengeWindow;
    }

    struct PendingClaim {
        uint128 amount;
        uint64 filedAt;
        bool disputed;
        bool open;
        bytes32 evidence;
        uint64 disputedAt; // when the claim was disputed (resolution deadline = disputedAt + RESOLVE_WINDOW)
        uint64 rejectedAt; // last rejection by the arbiter (refiling cooldown = one challengeWindow)
    }

    // ------------------------------------------------------------------
    // Storage (set once in initialize; clones have no constructor)
    // ------------------------------------------------------------------

    address public owner;
    address public factory;
    IBorrowerOperations public borrowerOps;
    ITroveManager public troveManager;
    IPriceFeed public priceFeed;
    IERC20 public musd;

    uint256 public stressBps; // e.g. 4000 = commitments must survive a 40% BTC drop
    uint256 public targetIcr; // e.g. 1.6e18 = stay >= 160% after all reserved draws, at stressed price

    uint256 public constant CCR = 1.5e18; // MUSD Recovery Mode threshold
    uint256 public constant MCR = 1.1e18; // MUSD minimum individual collateral ratio
    uint256 private constant RM_EPSILON = 1e15; // +0.1% so new ICR strictly improves
    /// @notice Shortest allowed challenge window for Claim commitments.
    uint32 public constant MIN_CHALLENGE_WINDOW = 60;
    /// @notice A scheduled commitment must stay live this long after its last trigger time, so the
    ///         last installment can actually be triggered (not a 1-second window).
    uint32 public constant MIN_TRIGGER_WINDOW = 300;
    /// @notice An arbiter has this long after a dispute to resolve it. After that anyone may
    ///         finalize the claim with the default outcome: APPROVE and pay. The owner chose the
    ///         arbiter, so an absent arbiter is the owner's risk, not the beneficiary's.
    uint256 public constant RESOLVE_WINDOW = 7 days;

    address public pendingOwner; // two-step ownership transfer

    uint256 public reserved; // sum over active commitments of (cap - paidOut)
    uint256 public nextId;
    mapping(uint256 => Commitment) internal commitments;
    mapping(uint256 => mapping(uint256 => bool)) public installmentSettled; // id => index => settled
    mapping(uint256 => PendingClaim) public pendingClaims;

    // ------------------------------------------------------------------
    // Events / errors
    // ------------------------------------------------------------------

    event TroveOpened(uint256 collateral, uint256 seedDraw);
    event CommitmentCreated(uint256 indexed id, Kind kind, address indexed beneficiary, uint256 cap, uint64 expiry);
    event InstallmentPaid(uint256 indexed id, uint256 indexed index, address payer, uint256 amount);
    event InstallmentMissed(uint256 indexed id, uint256 indexed index, uint256 amount);
    event ClaimFiled(uint256 indexed id, uint256 amount, bytes32 evidence);
    event ClaimDisputed(uint256 indexed id);
    event ClaimResolved(uint256 indexed id, bool approved);
    event Payout(uint256 indexed id, address indexed to, uint256 amount, uint256 fromBuffer, uint256 minted);
    event CommitmentClosed(uint256 indexed id, uint256 released);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event CollateralClaimed(uint256 amount);

    error NotOwner();
    error NotAuthorized();
    error AlreadyInitialized();
    error BadParams();
    error NotActive();
    error Unhealthy();
    error TooEarly();
    error TooLate();
    error AlreadySettled();
    error ExceedsCap();
    error RecoveryModeNeedsReserve(uint256 btcNeeded);
    error ReservedCommitments();
    error ClaimOpen();
    error ReserveLocked();
    error LineOwed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Locks the implementation contract so it can never be initialized directly.
    ///      Clones do not run constructors, so each clone starts with factory == address(0).
    constructor() {
        factory = address(this);
    }

    receive() external payable {} // trove returns BTC on withdrawColl / closeTrove; owner may fund RM reserve

    // ------------------------------------------------------------------
    // Init
    // ------------------------------------------------------------------

    function initialize(
        address _owner,
        IBorrowerOperations _bo,
        ITroveManager _tm,
        IPriceFeed _pf,
        IERC20 _musd,
        uint256 _stressBps,
        uint256 _targetIcr
    ) external {
        if (factory != address(0)) revert AlreadyInitialized();
        if (_owner == address(0) || _stressBps >= 10_000 || _targetIcr < CCR) revert BadParams();
        factory = msg.sender;
        owner = _owner;
        borrowerOps = _bo;
        troveManager = _tm;
        priceFeed = _pf;
        musd = _musd;
        stressBps = _stressBps;
        targetIcr = _targetIcr;
    }

    // ------------------------------------------------------------------
    // Trove management (owner)
    // ------------------------------------------------------------------

    /// @notice Open the trove with ALL intended collateral. The fixed rate and the
    ///         max borrowing capacity are snapshotted here; later top-ups add safety,
    ///         not capacity (only refinance resets capacity, at the current global rate).
    /// @param seedDraw at least minNetDebt (1,800 MUSD at time of writing). Kept as liquid buffer.
    function openTrove(uint256 seedDraw, address up, address lo) external payable onlyOwner nonReentrant {
        borrowerOps.openTrove{value: msg.value}(seedDraw, up, lo);
        emit TroveOpened(msg.value, seedDraw);
    }

    function topUp(address up, address lo) external payable nonReentrant {
        borrowerOps.addColl{value: msg.value}(up, lo); // anyone may add safety
    }

    function withdrawCollateral(uint256 amount, address up, address lo) external onlyOwner nonReentrant {
        borrowerOps.withdrawColl(amount, up, lo);
        _requireHealthy(0);
        _sendBTC(owner, amount);
    }

    function borrow(uint256 amount, address to, address up, address lo) external onlyOwner nonReentrant {
        borrowerOps.withdrawMUSD(amount, up, lo);
        _requireHealthy(0);
        musd.safeTransfer(to, amount);
    }

    /// @notice Repay from the vault's MUSD balance. Anyone can send MUSD to the vault first.
    function repay(uint256 amount, address up, address lo) external onlyOwner nonReentrant {
        borrowerOps.repayMUSD(amount, up, lo);
    }

    function refinance(address up, address lo) external onlyOwner nonReentrant {
        borrowerOps.refinance(up, lo);
        _requireHealthy(0); // refinance re-snapshots capacity at the current price
    }

    /// @notice After a liquidation or full redemption MUSD keeps any collateral surplus for the
    ///         borrower (this vault). Pull it in; the owner can then withdraw it as idle BTC.
    function claimCollateral() external onlyOwner nonReentrant {
        uint256 before = address(this).balance;
        borrowerOps.claimCollateral();
        emit CollateralClaimed(address(this).balance - before);
    }

    function closeTrove() external onlyOwner nonReentrant {
        if (reserved != 0) revert ReservedCommitments();
        borrowerOps.closeTrove(); // vault must hold entireDebt - 200 MUSD
        _sendBTC(owner, address(this).balance);
    }

    /// @notice Owner may take buffer MUSD out (it is not counted in health checks).
    ///         Allowed in Recovery Mode too: health never counts the buffer, so removing it
    ///         cannot make a commitment unpayable that health considered payable.
    function withdrawMUSDBuffer(uint256 amount, address to) external onlyOwner nonReentrant {
        musd.safeTransfer(to, amount);
    }

    /// @notice Withdraw idle BTC held by the vault (top-up reserve), not trove collateral.
    ///         Blocked while Recovery Mode is active and commitments are reserved: in that state
    ///         the idle BTC is exactly what lets a pending payout go through.
    function withdrawIdleBTC(uint256 amount) external onlyOwner nonReentrant {
        if (
            reserved != 0 && _troveActive() && troveManager.checkRecoveryMode(priceFeed.fetchPrice())
        ) revert ReserveLocked();
        _sendBTC(owner, amount);
    }

    // ------------------------------------------------------------------
    // Ownership (two-step)
    // ------------------------------------------------------------------

    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotAuthorized();
        address prev = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        IParFactoryHook(factory).onVaultOwnerChanged(prev, msg.sender);
        emit OwnershipTransferred(prev, msg.sender);
    }

    // ------------------------------------------------------------------
    // Commitments (owner creates; irrevocable until expiry or released)
    // ------------------------------------------------------------------

    function createScheduled(
        address beneficiary,
        address principal,
        uint128 installment,
        uint64 start,
        uint32 period,
        uint32 grace,
        uint16 count,
        uint128 coverCap,
        uint64 expiry
    ) external onlyOwner returns (uint256 id) {
        id = _createScheduled(beneficiary, principal, installment, start, period, grace, count, coverCap, expiry);
    }

    function createClaim(
        address beneficiary,
        address principal,
        address arbiter,
        uint128 cap,
        uint64 expiry,
        uint32 challengeWindow
    ) external onlyOwner returns (uint256 id) {
        id = _createClaim(beneficiary, principal, arbiter, cap, expiry, challengeWindow);
    }

    /// @notice Underwrite an open ParMarket request from this vault in one transaction: creates the
    ///         commitment the request describes (same checks and stress test as createScheduled /
    ///         createClaim, principal = the requester), then the market verifies it and pays the
    ///         escrowed premium to this vault's owner. Any failure reverts the whole fill.
    function fillRequest(address market, uint256 requestId) external onlyOwner nonReentrant returns (uint256 id) {
        IParMarket.Request memory r = IParMarket(market).getRequest(requestId);
        if (r.status != IParMarket.RStatus.Open) revert NotActive();
        if (r.kind == IParMarket.RKind.Scheduled) {
            id = _createScheduled(
                r.beneficiary, r.requester, r.installment, r.start, r.period, r.grace, r.count, r.cap, r.expiry
            );
        } else {
            id = _createClaim(r.beneficiary, r.requester, r.arbiter, r.cap, r.expiry, r.challengeWindow);
        }
        IParMarket(market).onFill(requestId, id);
    }

    function _createScheduled(
        address beneficiary,
        address principal,
        uint128 installment,
        uint64 start,
        uint32 period,
        uint32 grace,
        uint16 count,
        uint128 coverCap,
        uint64 expiry
    ) internal returns (uint256 id) {
        // Every installment must be triggerable before expiry: the last one becomes
        // triggerable after lastDue + grace, and stays so for at least MIN_TRIGGER_WINDOW.
        if (
            beneficiary == address(0) || installment == 0 || count == 0 || period == 0 || coverCap == 0
                || coverCap > uint256(installment) * count || start < block.timestamp
                || expiry < uint256(start) + uint256(count - 1) * period + grace + MIN_TRIGGER_WINDOW
        ) revert BadParams();
        id = _newCommitment(Kind.Scheduled, beneficiary, principal, address(0), coverCap, expiry);
        Commitment storage c = commitments[id];
        c.installment = installment;
        c.start = start;
        c.period = period;
        c.grace = grace;
        c.count = count;
    }

    function _createClaim(
        address beneficiary,
        address principal,
        address arbiter,
        uint128 cap,
        uint64 expiry,
        uint32 challengeWindow
    ) internal returns (uint256 id) {
        if (
            beneficiary == address(0) || arbiter == address(0) || arbiter == owner || arbiter == beneficiary
                || arbiter == principal
                || cap == 0 || expiry <= block.timestamp || challengeWindow < MIN_CHALLENGE_WINDOW
        ) revert BadParams();
        id = _newCommitment(Kind.Claim, beneficiary, principal, arbiter, cap, expiry);
        commitments[id].challengeWindow = challengeWindow;
    }

    /// @param circuit the ParCircuit contract; it becomes the only address able to draw this line.
    ///         Must be a contract: a line to an EOA would be an unconditional instant credit line.
    function createClearingLine(address circuit, uint128 cap, uint64 expiry) external onlyOwner returns (uint256 id) {
        if (circuit.code.length == 0 || cap == 0 || expiry <= block.timestamp) revert BadParams();
        id = _newCommitment(Kind.ClearingLine, circuit, owner, address(0), cap, expiry);
    }

    function _newCommitment(
        Kind kind,
        address beneficiary,
        address principal,
        address arbiter,
        uint128 cap,
        uint64 expiry
    ) internal returns (uint256 id) {
        _requireHealthy(cap); // the new cap must fit capacity AND survive the stress test
        id = nextId++;
        Commitment storage c = commitments[id];
        c.kind = kind;
        c.status = CStatus.Active;
        c.beneficiary = beneficiary;
        c.principal = principal;
        c.arbiter = arbiter;
        c.cap = cap;
        c.expiry = expiry;
        reserved += cap;
        emit CommitmentCreated(id, kind, beneficiary, cap, expiry);
    }

    // ---------------- Scheduled ----------------

    function dueTime(uint256 id, uint256 index) public view returns (uint256) {
        Commitment storage c = commitments[id];
        return uint256(c.start) + index * c.period;
    }

    /// @notice Anyone (usually the principal) pays an installment through the vault.
    ///         Caller must approve this vault for `installment` MUSD.
    function payInstallment(uint256 id, uint256 index) external nonReentrant {
        Commitment storage c = commitments[id];
        if (c.kind != Kind.Scheduled || c.status != CStatus.Active) revert NotActive();
        if (index >= c.count) revert BadParams();
        if (installmentSettled[id][index]) revert AlreadySettled();
        installmentSettled[id][index] = true;
        musd.safeTransferFrom(msg.sender, c.beneficiary, c.installment);
        emit InstallmentPaid(id, index, msg.sender, c.installment);
    }

    /// @notice Permissionless: if an installment is unpaid after due + grace, the vault pays it.
    function triggerMissed(uint256 id, uint256 index, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        if (c.kind != Kind.Scheduled || c.status != CStatus.Active) revert NotActive();
        if (index >= c.count) revert BadParams();
        if (installmentSettled[id][index]) revert AlreadySettled();
        if (block.timestamp <= dueTime(id, index) + c.grace) revert TooEarly();
        if (block.timestamp > c.expiry) revert TooLate();
        installmentSettled[id][index] = true;
        uint256 remaining = uint256(c.cap) - c.paidOut;
        uint256 amount = c.installment < remaining ? c.installment : remaining;
        emit InstallmentMissed(id, index, amount);
        _payout(id, amount, up, lo);
    }

    // ---------------- Claim ----------------

    function fileClaim(uint256 id, uint128 amount, bytes32 evidence) external {
        Commitment storage c = commitments[id];
        if (c.kind != Kind.Claim || c.status != CStatus.Active) revert NotActive();
        if (msg.sender != c.beneficiary) revert NotAuthorized();
        if (block.timestamp > c.expiry) revert TooLate();
        PendingClaim storage p = pendingClaims[id];
        if (p.open) revert BadParams();
        if (p.rejectedAt != 0 && block.timestamp < uint256(p.rejectedAt) + c.challengeWindow) revert TooEarly();
        if (amount == 0 || amount > uint256(c.cap) - c.paidOut) revert ExceedsCap();
        p.amount = amount;
        p.filedAt = uint64(block.timestamp);
        p.disputed = false;
        p.open = true;
        p.evidence = evidence;
        p.disputedAt = 0;
        emit ClaimFiled(id, amount, evidence);
    }

    function disputeClaim(uint256 id) external {
        Commitment storage c = commitments[id];
        PendingClaim storage p = pendingClaims[id];
        if (!p.open || p.disputed) revert NotActive();
        if (msg.sender != c.principal && msg.sender != owner) revert NotAuthorized();
        if (block.timestamp > p.filedAt + c.challengeWindow) revert TooLate();
        p.disputed = true;
        p.disputedAt = uint64(block.timestamp);
        emit ClaimDisputed(id);
    }

    /// @notice Arbiter decides a disputed claim, until disputedAt + RESOLVE_WINDOW.
    function resolveClaim(uint256 id, bool approve, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        PendingClaim storage p = pendingClaims[id];
        if (c.status != CStatus.Active || !p.open || !p.disputed) revert NotActive();
        if (msg.sender != c.arbiter) revert NotAuthorized();
        if (block.timestamp > uint256(p.disputedAt) + RESOLVE_WINDOW) revert TooLate();
        p.open = false;
        if (!approve) p.rejectedAt = uint64(block.timestamp);
        emit ClaimResolved(id, approve);
        if (approve) _payout(id, p.amount, up, lo);
    }

    /// @notice Permissionless. Pays an undisputed claim after its challenge window, or a
    ///         disputed claim the arbiter left unresolved past disputedAt + RESOLVE_WINDOW
    ///         (default outcome: approve).
    function executeClaim(uint256 id, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        PendingClaim storage p = pendingClaims[id];
        if (c.status != CStatus.Active || !p.open) revert NotActive();
        uint256 readyAt = p.disputed ? uint256(p.disputedAt) + RESOLVE_WINDOW : uint256(p.filedAt) + c.challengeWindow;
        if (block.timestamp <= readyAt) revert TooEarly();
        p.open = false;
        emit ClaimResolved(id, true);
        _payout(id, p.amount, up, lo);
    }

    // ---------------- Clearing line ----------------

    /// @notice Only the circuit (beneficiary) can draw; MUSD goes to the circuit.
    ///         No expiry check here: the circuit only books new debt against a line while it is
    ///         live, and debt booked before expiry must stay collectable however late the
    ///         force-settle runs (a line can't be timed to expire as the draw window opens).
    function drawLine(uint256 id, uint256 amount, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        if (c.kind != Kind.ClearingLine || c.status != CStatus.Active) revert NotActive();
        if (msg.sender != c.beneficiary) revert NotAuthorized();
        _payout(id, amount, up, lo);
    }

    // ---------------- Closing ----------------

    /// @notice Beneficiary can release early. After expiry anyone can close. Never while a claim
    ///         is open: the open claim still has to be paid from this commitment's reservation.
    function closeCommitment(uint256 id) external {
        Commitment storage c = commitments[id];
        if (c.status != CStatus.Active) revert NotActive();
        if (pendingClaims[id].open) revert ClaimOpen();
        if (block.timestamp <= c.expiry && msg.sender != c.beneficiary) revert NotAuthorized();
        // An expired clearing line stays reserved while its circuit still has debt booked on it.
        if (c.kind == Kind.ClearingLine && msg.sender != c.beneficiary) {
            try ILineHolder(c.beneficiary).outstanding(address(this), id) returns (uint256 owed) {
                if (owed != 0) revert LineOwed();
            } catch {}
        }
        uint256 released = uint256(c.cap) - c.paidOut;
        c.status = CStatus.Closed;
        reserved -= released;
        emit CommitmentClosed(id, released);
    }

    // ------------------------------------------------------------------
    // Payout waterfall
    // ------------------------------------------------------------------

    /// 1) pay from liquid MUSD buffer (seed draw, prior repayments)
    /// 2) Normal Mode: mint the shortfall from the trove (withdrawMUSD), as long as the
    ///    draw keeps the trove >= MCR and the system TCR >= CCR (MUSD's Normal Mode rule)
    /// 3) Otherwise (Recovery Mode, or a Normal Mode draw that would breach CCR/MCR):
    ///    combine the draw with a collateral top-up from idle BTC held by the vault, sized
    ///    by recoveryTopUp. If the vault holds too little, revert with the BTC needed so a
    ///    keeper can retry after the owner funds the reserve.
    function _payout(uint256 id, uint256 amount, address up, address lo) internal {
        Commitment storage c = commitments[id];
        if (amount == 0) return;
        if (amount > uint256(c.cap) - c.paidOut) revert ExceedsCap();
        c.paidOut += uint128(amount);
        reserved -= amount;
        if (c.paidOut == c.cap) c.status = CStatus.Closed;

        uint256 bal = musd.balanceOf(address(this));
        uint256 fromBuffer = bal >= amount ? amount : bal;
        uint256 shortfall = amount - fromBuffer;

        if (shortfall > 0) {
            uint256 topUpNeeded = recoveryTopUp(shortfall, priceFeed.fetchPrice()); // reverts NotActive if no trove
            if (topUpNeeded == 0) {
                borrowerOps.withdrawMUSD(shortfall, up, lo);
            } else {
                if (address(this).balance < topUpNeeded) revert RecoveryModeNeedsReserve(topUpNeeded);
                borrowerOps.adjustTrove{value: topUpNeeded}(0, shortfall, true, up, lo);
            }
        }

        musd.safeTransfer(c.beneficiary, amount);
        emit Payout(id, c.beneficiary, amount, fromBuffer, shortfall);
    }

    // ------------------------------------------------------------------
    // Risk views
    // ------------------------------------------------------------------

    function troveState() public view returns (uint256 coll, uint256 debt, uint256 capacity) {
        (uint256 c0, uint256 p, uint256 i, uint256 pc, uint256 pp, uint256 pi) =
            troveManager.getEntireDebtAndColl(address(this));
        coll = c0 + pc;
        debt = p + i + pp + pi;
        capacity = troveManager.getTroveMaxBorrowingCapacity(address(this));
    }

    /// @notice BTC to add alongside a draw of `draw` MUSD at `price` so MUSD accepts the debt increase.
    ///         Recovery Mode: new ICR >= max(oldICR, CCR) + epsilon (always > 0).
    ///         Normal Mode: 0 if the plain draw keeps ICR >= MCR and system TCR >= CCR; otherwise
    ///         enough BTC that both hold again (+ epsilon). Reverts NotActive without an active trove.
    function recoveryTopUp(uint256 draw, uint256 price) public view returns (uint256) {
        if (!_troveActive()) revert NotActive();
        (uint256 coll, uint256 debt,) = troveState();
        uint256 change = draw + borrowerOps.getBorrowingFee(draw); // fee: exact in Normal Mode, margin in RM
        if (troveManager.checkRecoveryMode(price)) {
            uint256 oldIcr = (coll * price) / debt;
            uint256 target = (oldIcr > CCR ? oldIcr : CCR) + RM_EPSILON;
            uint256 collNeeded = ((debt + change) * target + price - 1) / price; // ceil
            return collNeeded > coll ? collNeeded - coll : 0;
        }
        uint256 forIcr = _collShortfall(coll, debt + change, MCR, price);
        uint256 forTcr =
            _collShortfall(troveManager.getEntireSystemColl(), troveManager.getEntireSystemDebt() + change, CCR, price);
        return forIcr > forTcr ? forIcr : forTcr;
    }

    /// @dev 0 if coll * price / debt >= cr already, else BTC so it reaches cr + epsilon.
    function _collShortfall(uint256 coll, uint256 debt, uint256 cr, uint256 price) internal pure returns (uint256) {
        if ((coll * price) / debt >= cr) return 0;
        uint256 need = (debt * (cr + RM_EPSILON) + price - 1) / price;
        return need > coll ? need - coll : 0;
    }

    /// @notice Health = (a) every reserved MUSD can still be minted under the capacity
    ///         snapshot, and (b) after minting all of it, ICR stays >= targetIcr even
    ///         if BTC falls by stressBps. The MUSD buffer is ignored (conservative).
    function health(uint256 extraReserve)
        public
        view
        returns (bool ok, uint256 stressedIcr, uint256 headroom)
    {
        if (!_troveActive()) return (false, 0, 0);
        (uint256 coll, uint256 debt, uint256 capacity) = troveState();
        uint256 r = reserved + extraReserve;
        uint256 need = r + borrowerOps.getBorrowingFee(r);
        uint256 price = priceFeed.fetchPrice();
        uint256 stressed = (price * (10_000 - stressBps)) / 10_000;
        uint256 debtAfter = debt + need;
        stressedIcr = (coll * stressed) / debtAfter;
        bool capOk = debtAfter <= capacity;
        headroom = capOk ? capacity - debtAfter : 0;
        ok = capOk && stressedIcr >= targetIcr;
    }

    /// @notice MUSD this commitment can still pay. 0 once closed, expired, or when the trove is
    ///         not active (liquidated, redeemed or closed): nothing can be minted against it.
    function available(uint256 id) external view returns (uint256) {
        Commitment storage c = commitments[id];
        if (c.status != CStatus.Active || block.timestamp > c.expiry || !_troveActive()) return 0;
        return uint256(c.cap) - c.paidOut;
    }

    function getCommitment(uint256 id) external view returns (Commitment memory) {
        return commitments[id];
    }

    function commitmentInfo(uint256 id)
        external
        view
        returns (Kind kind, CStatus status, address beneficiary, uint256 cap, uint256 paidOut, uint64 expiry)
    {
        Commitment storage c = commitments[id];
        return (c.kind, c.status, c.beneficiary, c.cap, c.paidOut, c.expiry);
    }

    function _troveActive() internal view returns (bool) {
        return troveManager.getTroveStatus(address(this)) == ITroveManager.Status.active;
    }

    function _requireHealthy(uint256 extra) internal view {
        (bool ok,,) = health(extra);
        if (!ok) revert Unhealthy();
    }

    function _sendBTC(address to, uint256 amount) internal {
        (bool s,) = to.call{value: amount}("");
        require(s, "BTC transfer failed");
    }
}

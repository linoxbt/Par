// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";

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
    uint256 private constant RM_EPSILON = 1e15; // +0.1% so new ICR strictly improves

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

    function closeTrove() external onlyOwner nonReentrant {
        if (reserved != 0) revert ReservedCommitments();
        borrowerOps.closeTrove(); // vault must hold entireDebt - 200 MUSD
        _sendBTC(owner, address(this).balance);
    }

    /// @notice Owner may take buffer MUSD out (it is not counted in health checks).
    function withdrawMUSDBuffer(uint256 amount, address to) external onlyOwner nonReentrant {
        musd.safeTransfer(to, amount);
    }

    /// @notice Withdraw idle BTC held by the vault (Recovery Mode reserve), not trove collateral.
    function withdrawIdleBTC(uint256 amount) external onlyOwner nonReentrant {
        _sendBTC(owner, amount);
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
        if (
            beneficiary == address(0) || installment == 0 || count == 0 || period == 0 || coverCap == 0
                || coverCap > uint256(installment) * count || expiry <= block.timestamp
        ) revert BadParams();
        id = _newCommitment(Kind.Scheduled, beneficiary, principal, address(0), coverCap, expiry);
        Commitment storage c = commitments[id];
        c.installment = installment;
        c.start = start;
        c.period = period;
        c.grace = grace;
        c.count = count;
    }

    function createClaim(
        address beneficiary,
        address principal,
        address arbiter,
        uint128 cap,
        uint64 expiry,
        uint32 challengeWindow
    ) external onlyOwner returns (uint256 id) {
        if (beneficiary == address(0) || arbiter == address(0) || cap == 0 || expiry <= block.timestamp) {
            revert BadParams();
        }
        id = _newCommitment(Kind.Claim, beneficiary, principal, arbiter, cap, expiry);
        commitments[id].challengeWindow = challengeWindow;
    }

    /// @param circuit the ParCircuit contract; it becomes the only address able to draw this line.
    function createClearingLine(address circuit, uint128 cap, uint64 expiry) external onlyOwner returns (uint256 id) {
        if (circuit == address(0) || cap == 0 || expiry <= block.timestamp) revert BadParams();
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
        if (pendingClaims[id].open) revert BadParams();
        if (amount == 0 || amount > uint256(c.cap) - c.paidOut) revert ExceedsCap();
        pendingClaims[id] = PendingClaim(amount, uint64(block.timestamp), false, true, evidence);
        emit ClaimFiled(id, amount, evidence);
    }

    function disputeClaim(uint256 id) external {
        Commitment storage c = commitments[id];
        PendingClaim storage p = pendingClaims[id];
        if (!p.open || p.disputed) revert NotActive();
        if (msg.sender != c.principal && msg.sender != owner) revert NotAuthorized();
        if (block.timestamp > p.filedAt + c.challengeWindow) revert TooLate();
        p.disputed = true;
        emit ClaimDisputed(id);
    }

    function resolveClaim(uint256 id, bool approve, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        PendingClaim storage p = pendingClaims[id];
        if (!p.open || !p.disputed) revert NotActive();
        if (msg.sender != c.arbiter) revert NotAuthorized();
        p.open = false;
        emit ClaimResolved(id, approve);
        if (approve) _payout(id, p.amount, up, lo);
    }

    function executeClaim(uint256 id, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        PendingClaim storage p = pendingClaims[id];
        if (!p.open || p.disputed) revert NotActive();
        if (block.timestamp <= p.filedAt + c.challengeWindow) revert TooEarly();
        p.open = false;
        emit ClaimResolved(id, true);
        _payout(id, p.amount, up, lo);
    }

    // ---------------- Clearing line ----------------

    /// @notice Only the circuit (beneficiary) can draw; MUSD goes to the circuit.
    function drawLine(uint256 id, uint256 amount, address up, address lo) external nonReentrant {
        Commitment storage c = commitments[id];
        if (c.kind != Kind.ClearingLine || c.status != CStatus.Active) revert NotActive();
        if (msg.sender != c.beneficiary) revert NotAuthorized();
        if (block.timestamp > c.expiry) revert TooLate();
        _payout(id, amount, up, lo);
    }

    // ---------------- Closing ----------------

    /// @notice Beneficiary can release early. After expiry anyone can close (no open claim).
    function closeCommitment(uint256 id) external {
        Commitment storage c = commitments[id];
        if (c.status != CStatus.Active) revert NotActive();
        bool expired = block.timestamp > c.expiry && !pendingClaims[id].open;
        if (!expired && msg.sender != c.beneficiary) revert NotAuthorized();
        uint256 released = uint256(c.cap) - c.paidOut;
        c.status = CStatus.Closed;
        reserved -= released;
        emit CommitmentClosed(id, released);
    }

    // ------------------------------------------------------------------
    // Payout waterfall
    // ------------------------------------------------------------------

    /// 1) pay from liquid MUSD buffer (seed draw, prior repayments)
    /// 2) Normal Mode: mint the shortfall from the trove (withdrawMUSD)
    /// 3) Recovery Mode: MUSD only allows a debt increase combined with a collateral
    ///    top-up that leaves ICR >= 150% AND higher than before. Use idle BTC held by
    ///    the vault as a top-up reserve. If not enough, revert with the BTC needed so
    ///    a keeper can retry after the owner funds the reserve.
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
            uint256 price = priceFeed.fetchPrice();
            if (!troveManager.checkRecoveryMode(price)) {
                borrowerOps.withdrawMUSD(shortfall, up, lo);
            } else {
                uint256 topUpNeeded = recoveryTopUp(shortfall, price);
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

    /// @notice BTC to add alongside a draw of `draw` MUSD so the new ICR is >= max(oldICR, CCR) + epsilon.
    function recoveryTopUp(uint256 draw, uint256 price) public view returns (uint256) {
        (uint256 coll, uint256 debt,) = troveState();
        uint256 fee = borrowerOps.getBorrowingFee(draw);
        uint256 oldIcr = debt == 0 ? type(uint256).max : (coll * price) / debt;
        uint256 target = (oldIcr > CCR ? oldIcr : CCR) + RM_EPSILON;
        uint256 newDebt = debt + draw + fee;
        uint256 collNeeded = (newDebt * target + price - 1) / price; // ceil
        return collNeeded > coll ? collNeeded - coll : 0;
    }

    /// @notice Health = (a) every reserved MUSD can still be minted under the capacity
    ///         snapshot, and (b) after minting all of it, ICR stays >= targetIcr even
    ///         if BTC falls by stressBps. The MUSD buffer is ignored (conservative).
    function health(uint256 extraReserve)
        public
        view
        returns (bool ok, uint256 stressedIcr, uint256 headroom)
    {
        if (troveManager.getTroveStatus(address(this)) != ITroveManager.Status.active) return (false, 0, 0);
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

    function available(uint256 id) external view returns (uint256) {
        Commitment storage c = commitments[id];
        if (c.status != CStatus.Active || block.timestamp > c.expiry) return 0;
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

    function _requireHealthy(uint256 extra) internal view {
        (bool ok,,) = health(extra);
        if (!ok) revert Unhealthy();
    }

    function _sendBTC(address to, uint256 amount) internal {
        (bool s,) = to.call{value: amount}("");
        require(s, "BTC transfer failed");
    }
}

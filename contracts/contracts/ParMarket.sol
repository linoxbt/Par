// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ParVault, IParMarket} from "./ParVault.sol";
import {ParFactory} from "./ParFactory.sol";

/// @title ParMarket
/// @notice Underwriting market. Someone who needs cover but holds no BTC (a tenant who needs a
///         rent guarantee, a merchant who needs a supplier bond) posts a cover request and
///         escrows a premium in MUSD. A BTC holder fills it from their own ParVault with
///         ParVault.fillRequest: in one transaction the vault creates the commitment (same
///         checks and stress test as any other commitment, principal = the requester) and this
///         contract pays the premium to the vault's owner. If any step fails nothing happens.
///
///         The market never holds collateral and never pays cover: the beneficiary is paid by the
///         underwriter's vault exactly as for a commitment the owner created directly. The
///         market only holds premiums of open requests.
contract ParMarket is IParMarket, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Only vaults cloned by this factory can fill requests (no look-alike contracts).
    ParFactory public immutable factory;
    IERC20 public immutable musd;

    // Mirrors of the ParVault creation rules (ParVault.MIN_TRIGGER_WINDOW / MIN_CHALLENGE_WINDOW).
    uint32 public constant MIN_TRIGGER_WINDOW = 300;
    uint32 public constant MIN_CHALLENGE_WINDOW = 60;

    uint256 public nextRequestId;
    /// @notice Requests currently Open.
    uint256 public openCount;
    mapping(uint256 => Request) internal requests;

    event RequestCreated(
        uint256 indexed id,
        address indexed requester,
        RKind kind,
        address indexed beneficiary,
        uint256 cap,
        uint256 premium,
        uint64 deadline
    );
    event RequestCancelled(uint256 indexed id);
    event RequestFilled(
        uint256 indexed id, address indexed vault, uint256 commitmentId, address indexed underwriter, uint256 premium
    );

    error BadParams();
    error NotRequester();
    error NotOpen();
    error Expired();
    error NotParVault();
    error SelfFill();
    error Mismatch();

    constructor(ParFactory _factory) {
        factory = _factory;
        musd = IERC20(_factory.musd());
    }

    // ------------------------------------------------------------------
    // Requests
    // ------------------------------------------------------------------

    /// @notice Request an installment guarantee (rent, BNPL, supplier terms). The caller is the
    ///         principal (obligor) of the future commitment. Caller must approve `premium` MUSD.
    /// @param deadline last moment the request can be filled; must be <= start, because a vault
    ///        only creates a scheduled commitment whose first installment is not yet due.
    function requestScheduled(
        address beneficiary,
        uint128 installment,
        uint64 start,
        uint32 period,
        uint32 grace,
        uint16 count,
        uint128 cap,
        uint64 expiry,
        uint128 premium,
        uint64 deadline,
        bytes32 ref
    ) external nonReentrant returns (uint256 id) {
        if (
            beneficiary == address(0) || beneficiary == msg.sender || installment == 0 || count == 0 || period == 0
                || cap == 0 || cap > uint256(installment) * count || start < block.timestamp
                || expiry < uint256(start) + uint256(count - 1) * period + grace + MIN_TRIGGER_WINDOW
                || deadline < block.timestamp || deadline > start
        ) revert BadParams();
        id = nextRequestId++;
        Request storage r = requests[id];
        r.requester = msg.sender;
        r.kind = RKind.Scheduled;
        r.status = RStatus.Open;
        r.deadline = deadline;
        r.beneficiary = beneficiary;
        r.start = start;
        r.period = period;
        r.grace = grace;
        r.count = count;
        r.expiry = expiry;
        r.installment = installment;
        r.cap = cap;
        r.premium = premium;
        r.ref = ref;
        _open(id, RKind.Scheduled, beneficiary, cap, premium, deadline);
    }

    /// @notice Request a claim guarantee (bond, deposit) with an arbiter. The caller is the
    ///         principal: they may dispute claims. Caller must approve `premium` MUSD.
    /// @param deadline last moment the request can be filled; must be before expiry.
    function requestClaim(
        address beneficiary,
        address arbiter,
        uint128 cap,
        uint64 expiry,
        uint32 challengeWindow,
        uint128 premium,
        uint64 deadline,
        bytes32 ref
    ) external nonReentrant returns (uint256 id) {
        if (
            beneficiary == address(0) || beneficiary == msg.sender || arbiter == address(0) || arbiter == beneficiary
                || arbiter == msg.sender || cap == 0 || expiry <= block.timestamp
                || challengeWindow < MIN_CHALLENGE_WINDOW || deadline < block.timestamp || deadline >= expiry
        ) revert BadParams();
        id = nextRequestId++;
        Request storage r = requests[id];
        r.requester = msg.sender;
        r.kind = RKind.Claim;
        r.status = RStatus.Open;
        r.deadline = deadline;
        r.beneficiary = beneficiary;
        r.arbiter = arbiter;
        r.challengeWindow = challengeWindow;
        r.expiry = expiry;
        r.cap = cap;
        r.premium = premium;
        r.ref = ref;
        _open(id, RKind.Claim, beneficiary, cap, premium, deadline);
    }

    /// @notice Requester withdraws an open request and gets the premium back.
    function cancel(uint256 id) external nonReentrant {
        Request storage r = requests[id];
        if (msg.sender != r.requester) revert NotRequester();
        if (r.status != RStatus.Open) revert NotOpen();
        r.status = RStatus.Cancelled;
        openCount--;
        uint256 premium = r.premium;
        emit RequestCancelled(id);
        if (premium != 0) musd.safeTransfer(msg.sender, premium);
    }

    function _open(uint256 id, RKind kind, address beneficiary, uint128 cap, uint128 premium, uint64 deadline)
        internal
    {
        openCount++;
        emit RequestCreated(id, msg.sender, kind, beneficiary, cap, premium, deadline);
        if (premium != 0) musd.safeTransferFrom(msg.sender, address(this), premium);
    }

    // ------------------------------------------------------------------
    // Fill (called by ParVault.fillRequest)
    // ------------------------------------------------------------------

    /// @notice Called by a factory vault right after it created `commitmentId` for request `id`.
    ///         Verifies the commitment is exactly what was requested, then pays the premium to
    ///         the vault's owner (the underwriter).
    function onFill(uint256 id, uint256 commitmentId) external nonReentrant {
        if (!factory.isVault(msg.sender)) revert NotParVault();
        Request storage r = requests[id];
        if (r.status != RStatus.Open) revert NotOpen();
        if (block.timestamp > r.deadline) revert Expired();
        ParVault v = ParVault(payable(msg.sender));
        address underwriter = v.owner();
        if (underwriter == r.requester) revert SelfFill();
        if (!_matches(r, v.getCommitment(commitmentId))) revert Mismatch();

        r.status = RStatus.Filled;
        r.vault = msg.sender;
        r.commitmentId = commitmentId;
        openCount--;
        uint256 premium = r.premium;
        emit RequestFilled(id, msg.sender, commitmentId, underwriter, premium);
        if (premium != 0) musd.safeTransfer(underwriter, premium);
    }

    function _matches(Request storage r, ParVault.Commitment memory c) internal view returns (bool) {
        if (
            c.status != ParVault.CStatus.Active || c.paidOut != 0 || uint8(c.kind) != uint8(r.kind)
                || c.beneficiary != r.beneficiary || c.principal != r.requester || c.cap != r.cap
                || c.expiry != r.expiry
        ) return false;
        if (r.kind == RKind.Scheduled) {
            return c.installment == r.installment && c.start == r.start && c.period == r.period && c.grace == r.grace
                && c.count == r.count;
        }
        return c.arbiter == r.arbiter && c.challengeWindow == r.challengeWindow;
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function getRequest(uint256 id) external view returns (Request memory) {
        return requests[id];
    }
}

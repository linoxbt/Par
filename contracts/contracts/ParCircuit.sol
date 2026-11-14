// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ParVault} from "./ParVault.sol";

/// @title ParCircuit
/// @notice Trade-credit clearing for a closed group of businesses ("circle").
///         The contract is the central counterparty: every accepted invoice moves
///         the creditor's net up and the debtor's net down, so multilateral netting
///         is maintained incrementally (O(1) per invoice, no off-chain solver needed
///         for amounts). At the end of each cycle only net debtors pay, only net
///         creditors receive. A net debtor who misses the settlement window is
///         force-settled from the ClearingLine commitment in their ParVault.
///
///         Line accounting: a ClearingLine (vault, lineId) can back at most ONE membership
///         at a time (across all circles). `outstanding[vault][lineId]` is the sum of that
///         member's unsettled negative nets over ALL cycles, kept incrementally, and every
///         accepted invoice keeps it <= the line's available() amount. So every obligation
///         the circuit records can be drawn, however late the keeper runs.
///
///         Terminal fallback: a cycle is final at finalAt = close + settleWindow + cycleLength.
///         From then on creditors may claim pro-rata (credit * collected / totalOwed) even if
///         some debtor could never be collected; later settlements still count and creditors
///         claim the difference, so claim order never matters.
contract ParCircuit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Circle {
        address admin;
        uint64 genesis;
        uint64 cycleLength; // e.g. 7 days in prod, 10 minutes in the demo
        uint64 settleWindow; // time after cycle close for voluntary settlement
        bool exists;
    }

    struct Member {
        address vault;
        uint256 lineId; // ClearingLine commitment id inside the member's vault
        bool active;
    }

    struct Invite {
        address vault;
        uint256 lineId;
        bool open;
    }

    enum InvStatus {
        None,
        Pending,
        Accepted,
        Rejected
    }

    struct Invoice {
        uint256 circleId;
        address creditor;
        address debtor;
        uint128 amount;
        uint64 cycle;
        InvStatus status;
        bytes32 ref; // hash of off-chain invoice doc / metadata
    }

    IERC20 public immutable musd;

    uint256 public nextCircleId;
    uint256 public nextInvoiceId;
    mapping(uint256 => Circle) public circles;
    mapping(uint256 => mapping(address => Member)) public members;
    mapping(uint256 => address[]) public memberList; // everyone who ever joined (see members(c, m).active)
    mapping(uint256 => mapping(address => bool)) internal listed;
    mapping(uint256 => mapping(address => Invite)) public invites;
    mapping(uint256 => Invoice) public invoices;

    // circleId => cycle => member => net (positive = receives, negative = owes)
    mapping(uint256 => mapping(uint64 => mapping(address => int256))) public net;
    mapping(uint256 => mapping(uint64 => uint256)) public gross; // total accepted invoice volume
    mapping(uint256 => mapping(uint64 => uint256)) public totalOwed; // sum of negative nets
    mapping(uint256 => mapping(uint64 => uint256)) public collected;
    // debtor: paid (voluntarily or forced). creditor: claimed in full.
    mapping(uint256 => mapping(uint64 => mapping(address => bool))) public settled;
    mapping(uint256 => mapping(uint64 => mapping(address => uint256))) public claimed; // creditor => paid so far
    mapping(uint256 => mapping(uint64 => bool)) public finalized; // set on the first pro-rata claim

    // vault => lineId => unsettled obligations across all cycles
    mapping(address => mapping(uint256 => uint256)) public outstanding;
    // vault => lineId => currently backs a membership
    mapping(address => mapping(uint256 => bool)) public lineBound;

    event CircleCreated(uint256 indexed circleId, address admin, uint64 cycleLength, uint64 settleWindow);
    event MemberInvited(uint256 indexed circleId, address indexed member, address vault, uint256 lineId);
    event MemberJoined(uint256 indexed circleId, address indexed member, address vault, uint256 lineId);
    event MemberRemoved(uint256 indexed circleId, address indexed member);
    event InvoiceCreated(
        uint256 indexed id,
        uint256 indexed circleId,
        address creditor,
        address debtor,
        uint256 amount,
        uint64 cycle,
        bytes32 ref
    );
    event InvoiceAccepted(uint256 indexed id, uint256 indexed circleId, uint64 cycle);
    event InvoiceRejected(uint256 indexed id);
    event Settled(uint256 indexed circleId, uint64 indexed cycle, address indexed debtor, uint256 amount, bool forced);
    event Claimed(uint256 indexed circleId, uint64 indexed cycle, address indexed creditor, uint256 amount);
    event CycleFinalized(uint256 indexed circleId, uint64 indexed cycle, uint256 collected, uint256 totalOwed);

    error NotMember();
    error NotAdmin();
    error BadParams();
    error WrongCycle();
    error OverLimit(uint256 limit, uint256 wouldOwe);
    error NotYet();
    error Done();
    error NotInvited();
    error LineInUse();
    error HasObligations();
    error LineExpiresTooSoon(uint256 expiry, uint256 needed);

    constructor(IERC20 _musd) {
        musd = _musd;
    }

    // ---------------- Circles & members ----------------

    function createCircle(uint64 cycleLength, uint64 settleWindow) external returns (uint256 id) {
        if (cycleLength == 0 || settleWindow > cycleLength) revert BadParams();
        id = nextCircleId++;
        circles[id] = Circle(msg.sender, uint64(block.timestamp), cycleLength, settleWindow, true);
        emit CircleCreated(id, msg.sender, cycleLength, settleWindow);
    }

    /// @notice Admin invites `member` to join with a specific ClearingLine. Membership is
    ///         consent-based: it only takes effect when the member calls join() with the same
    ///         vault and line. Re-inviting an existing member proposes a new line (re-pointing).
    function addMember(uint256 circleId, address member, address vault, uint256 lineId) external {
        if (msg.sender != circles[circleId].admin) revert NotAdmin();
        _checkLine(circleId, member, vault, lineId);
        invites[circleId][member] = Invite(vault, lineId, true);
        emit MemberInvited(circleId, member, vault, lineId);
    }

    /// @notice Member accepts the admin's invite. The line must be an active ClearingLine of
    ///         the member's own vault pointed at this contract, not backing any other membership,
    ///         and live until at least the current cycle's settlement deadline. Re-pointing an
    ///         existing membership requires no exposure on the old line (see removeMember).
    function join(uint256 circleId, address vault, uint256 lineId) external {
        Invite storage inv = invites[circleId][msg.sender];
        if (!inv.open || inv.vault != vault || inv.lineId != lineId) revert NotInvited();
        _checkLine(circleId, msg.sender, vault, lineId);
        if (lineBound[vault][lineId]) revert LineInUse();
        Member storage m = members[circleId][msg.sender];
        if (m.active) {
            _requireNoExposure(circleId, msg.sender);
            lineBound[m.vault][m.lineId] = false;
        }
        delete invites[circleId][msg.sender];
        lineBound[vault][lineId] = true;
        members[circleId][msg.sender] = Member(vault, lineId, true);
        if (!listed[circleId][msg.sender]) {
            listed[circleId][msg.sender] = true;
            memberList[circleId].push(msg.sender);
        }
        emit MemberJoined(circleId, msg.sender, vault, lineId);
    }

    /// @notice Admin removes a member, or a member leaves. Only with no outstanding obligations
    ///         and a zero net in the current and previous cycle. Frees the line.
    function removeMember(uint256 circleId, address member) external {
        if (msg.sender != circles[circleId].admin && msg.sender != member) revert NotAdmin();
        Member storage m = members[circleId][member];
        if (!m.active) revert NotMember();
        _requireNoExposure(circleId, member);
        lineBound[m.vault][m.lineId] = false;
        m.active = false;
        emit MemberRemoved(circleId, member);
    }

    function _checkLine(uint256 circleId, address member, address vault, uint256 lineId) internal view {
        Circle storage c = circles[circleId];
        if (!c.exists || ParVault(payable(vault)).owner() != member) revert BadParams();
        (ParVault.Kind kind, ParVault.CStatus status, address beneficiary,,, uint64 expiry) =
            ParVault(payable(vault)).commitmentInfo(lineId);
        if (kind != ParVault.Kind.ClearingLine || status != ParVault.CStatus.Active || beneficiary != address(this)) {
            revert BadParams();
        }
        uint256 needed = cycleClose(circleId, currentCycle(circleId)) + c.settleWindow;
        if (expiry < needed) revert LineExpiresTooSoon(expiry, needed);
    }

    function _requireNoExposure(uint256 circleId, address member) internal view {
        Member storage m = members[circleId][member];
        uint64 cyc = currentCycle(circleId);
        if (
            outstanding[m.vault][m.lineId] != 0 || net[circleId][cyc][member] != 0
                || (cyc > 0 && net[circleId][cyc - 1][member] != 0)
        ) revert HasObligations();
    }

    function currentCycle(uint256 circleId) public view returns (uint64) {
        Circle storage c = circles[circleId];
        return uint64((block.timestamp - c.genesis) / c.cycleLength);
    }

    function cycleClose(uint256 circleId, uint64 cycle) public view returns (uint256) {
        Circle storage c = circles[circleId];
        return uint256(c.genesis) + uint256(cycle + 1) * c.cycleLength;
    }

    /// @notice After this time a cycle is final: creditors may claim pro-rata of what was collected.
    function finalAt(uint256 circleId, uint64 cycle) public view returns (uint256) {
        Circle storage c = circles[circleId];
        return cycleClose(circleId, cycle) + c.settleWindow + c.cycleLength;
    }

    /// @notice What the member's line can still pay (0 if closed, expired or the trove is not active).
    function creditLimit(uint256 circleId, address member) public view returns (uint256) {
        Member storage m = members[circleId][member];
        if (!m.active) return 0;
        return ParVault(payable(m.vault)).available(m.lineId);
    }

    /// @notice creditLimit minus everything the member already owes across all cycles.
    function lineHeadroom(uint256 circleId, address member) external view returns (uint256) {
        Member storage m = members[circleId][member];
        uint256 limit = creditLimit(circleId, member);
        uint256 owes = outstanding[m.vault][m.lineId];
        return limit > owes ? limit - owes : 0;
    }

    // ---------------- Invoices ----------------

    function createInvoice(uint256 circleId, address debtor, uint128 amount, bytes32 ref)
        external
        returns (uint256 id)
    {
        if (!members[circleId][msg.sender].active || !members[circleId][debtor].active) revert NotMember();
        if (amount == 0 || debtor == msg.sender) revert BadParams();
        uint64 cyc = currentCycle(circleId);
        id = nextInvoiceId++;
        invoices[id] = Invoice(circleId, msg.sender, debtor, amount, cyc, InvStatus.Pending, ref);
        emit InvoiceCreated(id, circleId, msg.sender, debtor, amount, cyc, ref);
    }

    /// @notice Debtor accepts. Nets update incrementally. If the debtor ends up a net debtor
    ///         for the cycle, everything they owe across all cycles must fit their line, and the
    ///         line must stay live until this cycle's settlement deadline.
    function acceptInvoice(uint256 id) external {
        Invoice storage inv = invoices[id];
        if (inv.status != InvStatus.Pending) revert BadParams();
        if (msg.sender != inv.debtor) revert NotMember();
        uint256 cid = inv.circleId;
        uint64 cyc = inv.cycle;
        if (currentCycle(cid) != cyc) revert WrongCycle(); // stale invoices must be re-issued
        Member storage d = members[cid][msg.sender];
        if (!d.active || !members[cid][inv.creditor].active) revert NotMember();
        ParVault vault = ParVault(payable(d.vault));
        if (vault.owner() != msg.sender) revert NotMember(); // vault was transferred away
        inv.status = InvStatus.Accepted;

        int256 amt = int256(uint256(inv.amount));
        _applyDelta(cid, cyc, msg.sender, -amt);
        _applyDelta(cid, cyc, inv.creditor, amt);
        gross[cid][cyc] += inv.amount;

        if (net[cid][cyc][msg.sender] < 0) {
            (,,,,, uint64 expiry) = vault.commitmentInfo(d.lineId);
            uint256 needed = cycleClose(cid, cyc) + circles[cid].settleWindow;
            if (expiry < needed) revert LineExpiresTooSoon(expiry, needed);
            // available() is what the line pays out; the borrowing fee on top is already
            // covered by the vault's health check when the line was reserved.
            uint256 owes = outstanding[d.vault][d.lineId];
            uint256 limit = vault.available(d.lineId);
            if (owes > limit) revert OverLimit(limit, owes);
        }
        emit InvoiceAccepted(id, cid, cyc);
    }

    function rejectInvoice(uint256 id) external {
        Invoice storage inv = invoices[id];
        if (inv.status != InvStatus.Pending) revert BadParams();
        if (msg.sender != inv.debtor && msg.sender != inv.creditor) revert NotMember();
        inv.status = InvStatus.Rejected;
        emit InvoiceRejected(id);
    }

    /// @dev Moves `who`'s net and keeps totalOwed and the line's outstanding in step with the
    ///      negative part of that net. Only current-cycle nets change here, and a member can only
    ///      re-point with a zero current-cycle net, so the line booked is the line settled later.
    function _applyDelta(uint256 cid, uint64 cyc, address who, int256 delta) internal {
        int256 before = net[cid][cyc][who];
        int256 afterNet = before + delta;
        net[cid][cyc][who] = afterNet;
        uint256 negBefore = before < 0 ? uint256(-before) : 0;
        uint256 negAfter = afterNet < 0 ? uint256(-afterNet) : 0;
        if (negAfter == negBefore) return;
        totalOwed[cid][cyc] = totalOwed[cid][cyc] + negAfter - negBefore;
        Member storage m = members[cid][who];
        outstanding[m.vault][m.lineId] = outstanding[m.vault][m.lineId] + negAfter - negBefore;
    }

    // ---------------- Settlement ----------------

    /// @notice Net debtor settles voluntarily after the cycle closes (approve MUSD first).
    ///         Late settlement (even after the cycle is final) is accepted and paid out pro-rata.
    function settle(uint256 circleId, uint64 cycle) external nonReentrant {
        if (block.timestamp < cycleClose(circleId, cycle)) revert NotYet();
        uint256 owed = _markSettled(circleId, cycle, msg.sender);
        musd.safeTransferFrom(msg.sender, address(this), owed);
        emit Settled(circleId, cycle, msg.sender, owed, false);
    }

    /// @notice Permissionless after the settlement window: draw the debtor's clearing line.
    function forceSettle(uint256 circleId, uint64 cycle, address debtor, address up, address lo)
        external
        nonReentrant
    {
        if (block.timestamp < cycleClose(circleId, cycle) + circles[circleId].settleWindow) revert NotYet();
        Member storage m = members[circleId][debtor];
        uint256 owed = _markSettled(circleId, cycle, debtor);
        uint256 beforeBal = musd.balanceOf(address(this));
        ParVault(payable(m.vault)).drawLine(m.lineId, owed, up, lo);
        require(musd.balanceOf(address(this)) - beforeBal == owed, "line draw short");
        emit Settled(circleId, cycle, debtor, owed, true);
    }

    function _markSettled(uint256 circleId, uint64 cycle, address debtor) internal returns (uint256 owed) {
        int256 n = net[circleId][cycle][debtor];
        if (n >= 0 || settled[circleId][cycle][debtor]) revert Done();
        owed = uint256(-n);
        settled[circleId][cycle][debtor] = true;
        collected[circleId][cycle] += owed;
        Member storage m = members[circleId][debtor];
        outstanding[m.vault][m.lineId] -= owed;
    }

    /// @notice Net creditors claim. In full once every net debtor has settled; after finalAt,
    ///         pro-rata: credit * collected / totalOwed, minus what was already claimed. Can be
    ///         called again if more is collected later. Totals are fixed once the cycle closes
    ///         (invoices can only be accepted during their cycle), so the sum of claims never
    ///         exceeds collected and claim order does not matter.
    function claim(uint256 circleId, uint64 cycle) external nonReentrant {
        int256 n = net[circleId][cycle][msg.sender];
        if (n <= 0 || settled[circleId][cycle][msg.sender]) revert Done();
        uint256 credit = uint256(n);
        uint256 owed = totalOwed[circleId][cycle];
        uint256 got = collected[circleId][cycle];
        uint256 entitled = credit;
        if (got < owed) {
            if (block.timestamp < finalAt(circleId, cycle)) revert NotYet();
            if (!finalized[circleId][cycle]) {
                finalized[circleId][cycle] = true;
                emit CycleFinalized(circleId, cycle, got, owed);
            }
            entitled = (credit * got) / owed;
        }
        uint256 already = claimed[circleId][cycle][msg.sender];
        if (entitled <= already) revert NotYet();
        uint256 pay = entitled - already;
        claimed[circleId][cycle][msg.sender] = entitled;
        if (entitled == credit) settled[circleId][cycle][msg.sender] = true;
        musd.safeTransfer(msg.sender, pay);
        emit Claimed(circleId, cycle, msg.sender, pay);
    }

    // ---------------- Views ----------------

    function members_(uint256 circleId) external view returns (address[] memory) {
        return memberList[circleId];
    }

    /// @notice Netting efficiency in bps: share of gross volume that never needed money.
    function nettingEfficiencyBps(uint256 circleId, uint64 cycle) external view returns (uint256) {
        uint256 g = gross[circleId][cycle];
        if (g == 0) return 0;
        return ((g - totalOwed[circleId][cycle]) * 10_000) / g;
    }
}

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
contract ParCircuit is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Circle {
        address admin;
        uint64 genesis;
        uint64 cycleLength; // e.g. 7 days in prod, 3 minutes in the demo
        uint64 settleWindow; // time after cycle close for voluntary settlement
        bool exists;
    }

    struct Member {
        address vault;
        uint256 lineId; // ClearingLine commitment id inside the member's vault
        bool active;
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
    mapping(uint256 => address[]) public memberList;
    mapping(uint256 => Invoice) public invoices;

    // circleId => cycle => member => net (positive = receives, negative = owes)
    mapping(uint256 => mapping(uint64 => mapping(address => int256))) public net;
    mapping(uint256 => mapping(uint64 => uint256)) public gross; // total accepted invoice volume
    mapping(uint256 => mapping(uint64 => uint256)) public totalOwed; // sum of negative nets
    mapping(uint256 => mapping(uint64 => uint256)) public collected;
    mapping(uint256 => mapping(uint64 => mapping(address => bool))) public settled; // debtor paid / creditor claimed

    event CircleCreated(uint256 indexed circleId, address admin, uint64 cycleLength, uint64 settleWindow);
    event MemberJoined(uint256 indexed circleId, address indexed member, address vault, uint256 lineId);
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

    error NotMember();
    error NotAdmin();
    error BadParams();
    error WrongCycle();
    error OverLimit(uint256 limit, uint256 wouldOwe);
    error NotYet();
    error Done();

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

    /// @notice Admin-gated join (a circle is a closed trade group). Member must own the
    ///         vault and the vault must hold an active ClearingLine pointed at this contract.
    function addMember(uint256 circleId, address member, address vault, uint256 lineId) external {
        Circle storage c = circles[circleId];
        if (!c.exists) revert BadParams();
        if (msg.sender != c.admin) revert NotAdmin();
        if (ParVault(payable(vault)).owner() != member) revert BadParams();
        (ParVault.Kind kind, ParVault.CStatus status, address beneficiary,,,) =
            ParVault(payable(vault)).commitmentInfo(lineId);
        if (kind != ParVault.Kind.ClearingLine || status != ParVault.CStatus.Active || beneficiary != address(this)) {
            revert BadParams();
        }
        if (!members[circleId][member].active) memberList[circleId].push(member);
        members[circleId][member] = Member(vault, lineId, true);
        emit MemberJoined(circleId, member, vault, lineId);
    }

    function currentCycle(uint256 circleId) public view returns (uint64) {
        Circle storage c = circles[circleId];
        return uint64((block.timestamp - c.genesis) / c.cycleLength);
    }

    function cycleClose(uint256 circleId, uint64 cycle) public view returns (uint256) {
        Circle storage c = circles[circleId];
        return uint256(c.genesis) + uint256(cycle + 1) * c.cycleLength;
    }

    function creditLimit(uint256 circleId, address member) public view returns (uint256) {
        Member storage m = members[circleId][member];
        if (!m.active) return 0;
        return ParVault(payable(m.vault)).available(m.lineId);
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

    /// @notice Debtor accepts. Nets update incrementally; debtor's net payable for the
    ///         cycle may never exceed their pledged clearing line.
    function acceptInvoice(uint256 id) external {
        Invoice storage inv = invoices[id];
        if (inv.status != InvStatus.Pending) revert BadParams();
        if (msg.sender != inv.debtor) revert NotMember();
        uint256 cid = inv.circleId;
        if (currentCycle(cid) != inv.cycle) revert WrongCycle(); // stale invoices must be re-issued
        inv.status = InvStatus.Accepted;

        int256 amt = int256(uint256(inv.amount));
        _applyDelta(cid, inv.cycle, inv.debtor, -amt);
        _applyDelta(cid, inv.cycle, inv.creditor, amt);
        gross[cid][inv.cycle] += inv.amount;

        int256 dNet = net[cid][inv.cycle][inv.debtor];
        if (dNet < 0) {
            uint256 owes = uint256(-dNet);
            // settleWindow <= cycleLength, so at most the previous cycle can still be unsettled
            if (inv.cycle > 0) {
                int256 prev = net[cid][inv.cycle - 1][inv.debtor];
                if (prev < 0 && !settled[cid][inv.cycle - 1][inv.debtor]) owes += uint256(-prev);
            }
            uint256 limit = creditLimit(cid, inv.debtor);
            if (owes > limit) revert OverLimit(limit, owes);
        }
        emit InvoiceAccepted(id, cid, inv.cycle);
    }

    function rejectInvoice(uint256 id) external {
        Invoice storage inv = invoices[id];
        if (inv.status != InvStatus.Pending) revert BadParams();
        if (msg.sender != inv.debtor && msg.sender != inv.creditor) revert NotMember();
        inv.status = InvStatus.Rejected;
        emit InvoiceRejected(id);
    }

    function _applyDelta(uint256 cid, uint64 cyc, address who, int256 delta) internal {
        int256 before = net[cid][cyc][who];
        int256 afterNet = before + delta;
        net[cid][cyc][who] = afterNet;
        uint256 negBefore = before < 0 ? uint256(-before) : 0;
        uint256 negAfter = afterNet < 0 ? uint256(-afterNet) : 0;
        totalOwed[cid][cyc] = totalOwed[cid][cyc] + negAfter - negBefore;
    }

    // ---------------- Settlement ----------------

    /// @notice Net debtor settles voluntarily after the cycle closes (approve MUSD first).
    function settle(uint256 circleId, uint64 cycle) external nonReentrant {
        if (block.timestamp < cycleClose(circleId, cycle)) revert NotYet();
        int256 n = net[circleId][cycle][msg.sender];
        if (n >= 0 || settled[circleId][cycle][msg.sender]) revert Done();
        uint256 owed = uint256(-n);
        settled[circleId][cycle][msg.sender] = true;
        collected[circleId][cycle] += owed;
        musd.safeTransferFrom(msg.sender, address(this), owed);
        emit Settled(circleId, cycle, msg.sender, owed, false);
    }

    /// @notice Permissionless after the settlement window: draw the debtor's clearing line.
    function forceSettle(uint256 circleId, uint64 cycle, address debtor, address up, address lo)
        external
        nonReentrant
    {
        Circle storage c = circles[circleId];
        if (block.timestamp < cycleClose(circleId, cycle) + c.settleWindow) revert NotYet();
        int256 n = net[circleId][cycle][debtor];
        if (n >= 0 || settled[circleId][cycle][debtor]) revert Done();
        uint256 owed = uint256(-n);
        settled[circleId][cycle][debtor] = true;
        Member storage m = members[circleId][debtor];
        uint256 beforeBal = musd.balanceOf(address(this));
        ParVault(payable(m.vault)).drawLine(m.lineId, owed, up, lo);
        require(musd.balanceOf(address(this)) - beforeBal == owed, "line draw short");
        collected[circleId][cycle] += owed;
        emit Settled(circleId, cycle, debtor, owed, true);
    }

    /// @notice Net creditors claim once every net debtor has settled (voluntarily or forced).
    function claim(uint256 circleId, uint64 cycle) external nonReentrant {
        int256 n = net[circleId][cycle][msg.sender];
        if (n <= 0 || settled[circleId][cycle][msg.sender]) revert Done();
        if (collected[circleId][cycle] < totalOwed[circleId][cycle]) revert NotYet();
        settled[circleId][cycle][msg.sender] = true;
        musd.safeTransfer(msg.sender, uint256(n));
        emit Claimed(circleId, cycle, msg.sender, uint256(n));
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

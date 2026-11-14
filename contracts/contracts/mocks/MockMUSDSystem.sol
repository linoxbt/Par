// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ITroveManager} from "../interfaces/IMezo.sol";

/// @notice Test-only MUSD token. Only the trove system can mint/burn.
contract MockMUSD is ERC20 {
    address public immutable system;

    constructor(address _system) ERC20("Mezo USD (mock)", "MUSD") {
        system = _system;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == system, "MockMUSD: only system");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == system, "MockMUSD: only system");
        _burn(from, amount);
    }
}

/// @notice Test-only price feed. `fetchPrice` is a view, like the real Mezo PriceFeed.
contract MockPriceFeed {
    uint256 public price = 50_000e18;
    address public immutable owner = msg.sender;

    function setPrice(uint256 p) external {
        require(msg.sender == owner, "MockPriceFeed: only owner");
        price = p;
    }

    function fetchPrice() external view returns (uint256) {
        return price;
    }
}

interface IPriceSource {
    function fetchPrice() external view returns (uint256);
}

/// @title MockMUSDSystem
/// @notice A compact, single-contract model of the MUSD trove system that Par integrates with.
///         It implements the BorrowerOperations, TroveManager and InterestRateManager surfaces
///         Par calls, and copies the rules Par depends on from
///         github.com/mezo-org/musd/solidity/contracts/BorrowerOperations.sol:
///           - maxBorrowingCapacity = coll * price / 1.1, snapshotted at open (and refinance)
///           - collateral withdrawal lowers capacity to min(current, new); top-ups never raise it
///           - every debt increase requires debt + change <= maxBorrowingCapacity
///           - Normal Mode: new ICR >= 110% and new TCR >= 150%
///           - Recovery Mode (TCR < 150%): no coll withdrawal; a debt increase requires
///             new ICR >= 150% AND new ICR >= old ICR; no borrowing fee is charged
///           - 200 MUSD gas compensation added at open, 0.1% borrowing fee, 1,800 MUSD min net debt
///           - simple per-second interest on principal at the trove's rate (fixed at open)
///           - the trove belongs to msg.sender; withdrawMUSD mints to the borrower
///           - liquidation (TroveManager.liquidate): allowed when ICR < MCR, or in Recovery Mode
///             when ICR < TCR. Below MCR all collateral is seized; between MCR and TCR (Recovery
///             Mode) the seized collateral is capped at debt * MCR / price and the rest is a
///             surplus the borrower pulls with BorrowerOperations.claimCollateral()
///         It does not model redemptions, the stability pool or sorted-list hints (the debt of a
///         liquidated trove simply leaves the system).
///         Integration against the real contracts is done by scripts/run-musd-integration.sh.
contract MockMUSDSystem {
    struct Trove {
        ITroveManager.Status status;
        uint256 coll;
        uint256 principal;
        uint256 interest;
        uint256 lastUpdate;
        uint16 rate;
        uint256 maxBorrowingCapacity;
    }

    uint256 public constant MCR = 1.1e18;
    uint256 public constant CCR = 1.5e18;
    uint256 public constant MUSD_GAS_COMPENSATION = 200e18;
    uint256 public constant BORROWING_RATE = 1e15; // 0.1%
    uint256 public constant REFINANCING_FEE_PERCENTAGE = 20;
    uint256 private constant SECONDS_IN_A_YEAR = 365 days;
    address public constant PCV = address(0x9C5);

    MockMUSD public immutable musd;
    IPriceSource public immutable priceFeed;
    uint256 public minNetDebt = 1800e18;
    uint16 public interestRate = 100; // bps, global rate for new troves
    address public immutable owner = msg.sender;

    mapping(address => Trove) public troves;
    mapping(address => uint256) public collSurplus; // CollSurplusPool balances
    address[] public troveOwners;
    mapping(address => bool) private known;

    constructor(IPriceSource _pf) {
        priceFeed = _pf;
        musd = new MockMUSD(address(this));
    }

    function setInterestRate(uint16 r) external {
        require(msg.sender == owner, "only owner");
        interestRate = r;
    }

    // ------------------------------------------------------------------ BorrowerOperations

    function openTrove(uint256 _debtAmount, address, address) external payable {
        require(troves[msg.sender].status != ITroveManager.Status.active, "BorrowerOps: Trove is active");
        uint256 price = priceFeed.fetchPrice();
        bool rm = checkRecoveryMode(price);
        uint256 fee = rm ? 0 : getBorrowingFee(_debtAmount);
        uint256 netDebt = _debtAmount + fee;
        require(netDebt >= minNetDebt, "BorrowerOps: Trove's net debt must be greater than minimum");
        uint256 composite = netDebt + MUSD_GAS_COMPENSATION;
        uint256 icr = (msg.value * price) / composite;
        if (rm) {
            require(icr >= CCR, "BorrowerOps: Operation must leave trove with ICR >= CCR");
        } else {
            require(icr >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
            require(_newTCR(price, msg.value, true, composite, true) >= CCR, "BorrowerOps: TCR < CCR");
        }
        troves[msg.sender] = Trove({
            status: ITroveManager.Status.active,
            coll: msg.value,
            principal: composite,
            interest: 0,
            lastUpdate: block.timestamp,
            rate: interestRate,
            maxBorrowingCapacity: (msg.value * price) / MCR
        });
        if (!known[msg.sender]) {
            known[msg.sender] = true;
            troveOwners.push(msg.sender);
        }
        musd.mint(msg.sender, _debtAmount);
        if (fee > 0) musd.mint(PCV, fee);
        musd.mint(address(this), MUSD_GAS_COMPENSATION);
    }

    function addColl(address, address) external payable {
        _adjust(msg.sender, 0, 0, false);
    }

    function withdrawColl(uint256 _amount, address, address) external {
        _adjust(msg.sender, _amount, 0, false);
    }

    function withdrawMUSD(uint256 _amount, address, address) external {
        _adjust(msg.sender, 0, _amount, true);
    }

    function repayMUSD(uint256 _amount, address, address) external {
        _adjust(msg.sender, 0, _amount, false);
    }

    function adjustTrove(uint256 _collWithdrawal, uint256 _debtChange, bool _isDebtIncrease, address, address)
        external
        payable
    {
        _adjust(msg.sender, _collWithdrawal, _debtChange, _isDebtIncrease);
    }

    function closeTrove() external {
        Trove storage t = troves[msg.sender];
        require(t.status == ITroveManager.Status.active, "BorrowerOps: Trove does not exist or is closed");
        _accrue(t);
        uint256 price = priceFeed.fetchPrice();
        require(!checkRecoveryMode(price), "BorrowerOps: Operation not permitted during Recovery Mode");
        uint256 debt = t.principal + t.interest;
        uint256 coll = t.coll;
        require(_newTCR(price, coll, false, debt, false) >= CCR, "BorrowerOps: TCR < CCR");
        musd.burn(msg.sender, debt - MUSD_GAS_COMPENSATION);
        musd.burn(address(this), MUSD_GAS_COMPENSATION);
        t.status = ITroveManager.Status.closedByOwner;
        t.coll = 0;
        t.principal = 0;
        t.interest = 0;
        t.maxBorrowingCapacity = 0;
        _send(msg.sender, coll);
    }

    function refinance(address, address) external {
        Trove storage t = troves[msg.sender];
        require(t.status == ITroveManager.Status.active, "BorrowerOps: Trove does not exist or is closed");
        uint256 price = priceFeed.fetchPrice();
        require(!checkRecoveryMode(price), "BorrowerOps: Operation not permitted during Recovery Mode");
        _accrue(t);
        uint256 netDebt = t.principal + t.interest - MUSD_GAS_COMPENSATION;
        uint256 fee = getBorrowingFee((REFINANCING_FEE_PERCENTAGE * netDebt) / 100);
        t.principal += fee;
        if (fee > 0) musd.mint(PCV, fee);
        t.rate = interestRate;
        t.maxBorrowingCapacity = (t.coll * price) / MCR;
        require((t.coll * price) / (t.principal + t.interest) >= MCR, "BorrowerOps: ICR < MCR");
    }

    function claimCollateral() external {
        uint256 amount = collSurplus[msg.sender];
        require(amount > 0, "CollSurplusPool: No collateral available to claim");
        collSurplus[msg.sender] = 0;
        _send(msg.sender, amount);
    }

    function getBorrowingFee(uint256 _debt) public pure returns (uint256) {
        return (_debt * BORROWING_RATE) / 1e18;
    }

    // ------------------------------------------------------------------ TroveManager

    function getEntireDebtAndColl(address _borrower)
        external
        view
        returns (
            uint256 coll,
            uint256 principal,
            uint256 interest,
            uint256 pendingCollateral,
            uint256 pendingPrincipal,
            uint256 pendingInterest
        )
    {
        Trove storage t = troves[_borrower];
        return (t.coll, t.principal, t.interest, 0, 0, _pendingInterest(t));
    }

    function getTroveStatus(address _borrower) external view returns (ITroveManager.Status) {
        return troves[_borrower].status;
    }

    function getTroveMaxBorrowingCapacity(address _borrower) external view returns (uint256) {
        return troves[_borrower].maxBorrowingCapacity;
    }

    function getTroveInterestRate(address _borrower) external view returns (uint16) {
        return troves[_borrower].rate;
    }

    function getCurrentICR(address _borrower, uint256 _price) external view returns (uint256) {
        Trove storage t = troves[_borrower];
        uint256 debt = _debtOf(t);
        return debt == 0 ? type(uint256).max : (t.coll * _price) / debt;
    }

    function getTCR(uint256 _price) public view returns (uint256) {
        (uint256 c, uint256 d) = _totals();
        return d == 0 ? type(uint256).max : (c * _price) / d;
    }

    function checkRecoveryMode(uint256 _price) public view returns (bool) {
        return getTCR(_price) < CCR;
    }

    function getEntireSystemColl() public view returns (uint256 c) {
        (c,) = _totals();
    }

    function getEntireSystemDebt() public view returns (uint256 d) {
        (, d) = _totals();
    }

    /// @notice Liquidate one trove (permissionless, like TroveManager.liquidate).
    function liquidate(address _borrower) external {
        Trove storage t = troves[_borrower];
        require(t.status == ITroveManager.Status.active, "TroveManager: Trove does not exist or is closed");
        uint256 price = priceFeed.fetchPrice();
        uint256 debt = _debtOf(t);
        uint256 icr = (t.coll * price) / debt;
        uint256 tcr = getTCR(price);
        bool rm = tcr < CCR;
        require(icr < MCR || (rm && icr < tcr), "TroveManager: nothing to liquidate");
        uint256 surplus;
        if (icr >= MCR) {
            uint256 gasComp = t.coll / 200; // 0.5% collateral gas compensation
            uint256 capped = (debt * MCR) / price;
            if (t.coll > capped + gasComp) surplus = t.coll - capped - gasComp;
        }
        collSurplus[_borrower] += surplus;
        t.status = ITroveManager.Status.closedByLiquidation;
        t.coll = 0;
        t.principal = 0;
        t.interest = 0;
        t.maxBorrowingCapacity = 0;
    }

    function getTroveOwnersCount() external view returns (uint256) {
        return troveOwners.length;
    }

    // ------------------------------------------------------------------ internals

    struct AdjustVars {
        uint256 price;
        bool rm;
        uint256 fee;
        uint256 netDebtChange;
        uint256 debt;
        uint256 coll;
        uint256 collChange;
        bool collInc;
        uint256 newColl;
        uint256 newDebt;
        uint256 oldICR;
        uint256 newICR;
    }

    function _adjust(address borrower, uint256 collW, uint256 change, bool isInc) internal {
        Trove storage t = troves[borrower];
        require(t.status == ITroveManager.Status.active, "BorrowerOps: Trove does not exist or is closed");
        require(msg.value == 0 || collW == 0, "BorrowerOperations: Cannot withdraw and add coll");
        require(
            msg.value != 0 || collW != 0 || change != 0,
            "BorrowerOps: There must be either a collateral change or a debt change"
        );
        if (isInc) require(change > 0, "BorrowerOps: Debt increase requires non-zero debtChange");
        _accrue(t);

        AdjustVars memory v;
        v.price = priceFeed.fetchPrice();
        v.rm = checkRecoveryMode(v.price);
        v.fee = (isInc && !v.rm) ? getBorrowingFee(change) : 0;
        v.netDebtChange = change + v.fee;
        v.debt = t.principal + t.interest;
        v.coll = t.coll;
        v.collInc = msg.value > 0;
        v.collChange = v.collInc ? msg.value : collW;
        require(collW <= v.coll, "BorrowerOps: coll withdrawal exceeds coll");
        v.newColl = v.collInc ? v.coll + v.collChange : v.coll - v.collChange;
        v.newDebt = isInc ? v.debt + v.netDebtChange : v.debt - v.netDebtChange;
        v.oldICR = (v.coll * v.price) / v.debt;
        v.newICR = v.newDebt == 0 ? type(uint256).max : (v.newColl * v.price) / v.newDebt;

        if (v.rm) {
            require(collW == 0, "BorrowerOps: Collateral withdrawal not permitted Recovery Mode");
            if (isInc) {
                require(v.newICR >= CCR, "BorrowerOps: Operation must leave trove with ICR >= CCR");
                require(v.newICR >= v.oldICR, "BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode");
            }
        } else {
            require(v.newICR >= MCR, "BorrowerOps: An operation that would result in ICR < MCR is not permitted");
            require(
                _newTCR(v.price, v.collChange, v.collInc, v.netDebtChange, isInc) >= CCR,
                "BorrowerOps: An operation that would result in TCR < CCR is not permitted"
            );
        }

        if (isInc) {
            require(
                t.maxBorrowingCapacity >= v.netDebtChange + v.debt,
                "BorrowerOps: An operation that exceeds maxBorrowingCapacity is not permitted"
            );
        }

        if (!isInc && change > 0) {
            require(
                v.debt - MUSD_GAS_COMPENSATION - change >= minNetDebt,
                "BorrowerOps: Trove's net debt must be greater than minimum"
            );
            require(musd.balanceOf(borrower) >= change, "BorrowerOps: Caller doesnt have enough mUSD to make repayment");
            // interest first, then principal
            uint256 toInterest = change < t.interest ? change : t.interest;
            t.interest -= toInterest;
            t.principal -= change - toInterest;
            musd.burn(borrower, change);
        }

        t.coll = v.newColl;
        if (isInc) {
            t.principal += v.netDebtChange;
            musd.mint(borrower, change);
            if (v.fee > 0) musd.mint(PCV, v.fee);
        }

        if (!v.collInc && v.collChange > 0) {
            uint256 newCap = (v.newColl * v.price) / MCR;
            if (newCap < t.maxBorrowingCapacity) t.maxBorrowingCapacity = newCap;
            _send(borrower, v.collChange);
        }
    }

    function _accrue(Trove storage t) internal {
        t.interest += _pendingInterest(t);
        t.lastUpdate = block.timestamp;
    }

    function _pendingInterest(Trove storage t) internal view returns (uint256) {
        if (t.status != ITroveManager.Status.active) return 0;
        return (t.principal * t.rate * (block.timestamp - t.lastUpdate)) / (10_000 * SECONDS_IN_A_YEAR);
    }

    function _debtOf(Trove storage t) internal view returns (uint256) {
        return t.principal + t.interest + _pendingInterest(t);
    }

    function _totals() internal view returns (uint256 c, uint256 d) {
        for (uint256 i = 0; i < troveOwners.length; i++) {
            Trove storage t = troves[troveOwners[i]];
            if (t.status != ITroveManager.Status.active) continue;
            c += t.coll;
            d += _debtOf(t);
        }
    }

    function _newTCR(uint256 price, uint256 collChange, bool collInc, uint256 debtChange, bool debtInc)
        internal
        view
        returns (uint256)
    {
        (uint256 c, uint256 d) = _totals();
        c = collInc ? c + collChange : c - collChange;
        d = debtInc ? d + debtChange : d - debtChange;
        return d == 0 ? type(uint256).max : (c * price) / d;
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "send failed");
    }
}

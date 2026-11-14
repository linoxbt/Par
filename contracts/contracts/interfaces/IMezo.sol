// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Minimal interfaces for the MUSD system on Mezo.
/// Signatures copied from github.com/mezo-org/musd (solidity/contracts/interfaces).

interface IBorrowerOperations {
    function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) external payable;
    function addColl(address _upperHint, address _lowerHint) external payable;
    function withdrawColl(uint256 _amount, address _upperHint, address _lowerHint) external;
    function withdrawMUSD(uint256 _amount, address _upperHint, address _lowerHint) external;
    function repayMUSD(uint256 _amount, address _upperHint, address _lowerHint) external;
    function adjustTrove(
        uint256 _collWithdrawal,
        uint256 _debtChange,
        bool _isDebtIncrease,
        address _upperHint,
        address _lowerHint
    ) external payable;
    function closeTrove() external;
    function refinance(address _upperHint, address _lowerHint) external;
    function claimCollateral() external;
    function getBorrowingFee(uint256 _debt) external view returns (uint256);
}

interface ITroveManager {
    enum Status {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

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
        );

    function getTroveStatus(address _borrower) external view returns (Status);
    function getTroveMaxBorrowingCapacity(address _borrower) external view returns (uint256);
    function checkRecoveryMode(uint256 _price) external view returns (bool);
    /// LiquityBase views (TroveManager inherits LiquityBase): active + default pool totals.
    function getEntireSystemColl() external view returns (uint256);
    function getEntireSystemDebt() external view returns (uint256);
}

interface IPriceFeed {
    /// 1e18-scaled USD per BTC. View. Reverts if the oracle is stale.
    function fetchPrice() external view returns (uint256);
}

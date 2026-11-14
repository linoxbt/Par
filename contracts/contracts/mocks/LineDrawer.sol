// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IParVaultLine {
    function drawLine(uint256 id, uint256 amount, address up, address lo) external;
}

/// @notice Test-only clearing-line beneficiary: lets tests draw a ParVault ClearingLine directly.
contract LineDrawer {
    function draw(address vault, uint256 id, uint256 amount) external {
        IParVaultLine(vault).drawLine(id, amount, address(0), address(0));
    }
}

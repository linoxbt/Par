// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ParVault} from "./ParVault.sol";
import {IBorrowerOperations, ITroveManager, IPriceFeed} from "./interfaces/IMezo.sol";

/// @title ParFactory
/// @notice Deploys one ParVault clone per user. A vault address can hold exactly one trove.
contract ParFactory {
    address public immutable implementation;
    IBorrowerOperations public immutable borrowerOps;
    ITroveManager public immutable troveManager;
    IPriceFeed public immutable priceFeed;
    IERC20 public immutable musd;
    uint256 public immutable stressBps;
    uint256 public immutable targetIcr;

    mapping(address => address[]) public vaultsOf;
    address[] public allVaults;

    event VaultCreated(address indexed owner, address vault);

    constructor(
        IBorrowerOperations _bo,
        ITroveManager _tm,
        IPriceFeed _pf,
        IERC20 _musd,
        uint256 _stressBps,
        uint256 _targetIcr
    ) {
        implementation = address(new ParVault());
        borrowerOps = _bo;
        troveManager = _tm;
        priceFeed = _pf;
        musd = _musd;
        stressBps = _stressBps;
        targetIcr = _targetIcr;
    }

    function createVault() external returns (address vault) {
        vault = Clones.clone(implementation);
        ParVault(payable(vault)).initialize(
            msg.sender, borrowerOps, troveManager, priceFeed, musd, stressBps, targetIcr
        );
        vaultsOf[msg.sender].push(vault);
        allVaults.push(vault);
        emit VaultCreated(msg.sender, vault);
    }

    function vaultCount(address owner) external view returns (uint256) {
        return vaultsOf[owner].length;
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}

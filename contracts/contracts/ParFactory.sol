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
    mapping(address => bool) public isVault;
    mapping(address => uint256) private ownerIndex; // vault => position in vaultsOf[owner]

    event VaultCreated(address indexed owner, address vault);
    event VaultOwnerChanged(address indexed vault, address indexed from, address indexed to);

    error NotVault();

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
        isVault[vault] = true;
        ownerIndex[vault] = vaultsOf[msg.sender].length;
        vaultsOf[msg.sender].push(vault);
        allVaults.push(vault);
        emit VaultCreated(msg.sender, vault);
    }

    /// @notice Called by a vault when its two-step ownership transfer completes, so
    ///         vaultsOf(newOwner) lists it and vaultsOf(oldOwner) no longer does.
    function onVaultOwnerChanged(address from, address to) external {
        address vault = msg.sender;
        if (!isVault[vault]) revert NotVault();
        address[] storage list = vaultsOf[from];
        uint256 i = ownerIndex[vault];
        address last = list[list.length - 1];
        list[i] = last;
        ownerIndex[last] = i;
        list.pop();
        ownerIndex[vault] = vaultsOf[to].length;
        vaultsOf[to].push(vault);
        emit VaultOwnerChanged(vault, from, to);
    }

    function vaultCount(address owner) external view returns (uint256) {
        return vaultsOf[owner].length;
    }

    function allVaultsLength() external view returns (uint256) {
        return allVaults.length;
    }
}

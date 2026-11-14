// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal Multicall3 (aggregate3 + getBlockNumber/getCurrentBlockTimestamp) for local chains
///         that mimic Mezo (where viem expects Multicall3 at 0xcA11bde05977b3631167028862bE2a173976CA11).
contract Multicall3 {
    struct Call3 {
        address target;
        bool allowFailure;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3(Call3[] calldata calls) external payable returns (Result[] memory returnData) {
        returnData = new Result[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool ok, bytes memory ret) = calls[i].target.call(calls[i].callData);
            if (!ok && !calls[i].allowFailure) {
                assembly {
                    revert(add(ret, 32), mload(ret))
                }
            }
            returnData[i] = Result(ok, ret);
        }
    }

    function getBlockNumber() external view returns (uint256) {
        return block.number;
    }

    function getCurrentBlockTimestamp() external view returns (uint256) {
        return block.timestamp;
    }
}

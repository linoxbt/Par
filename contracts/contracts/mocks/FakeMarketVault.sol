// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ParVault, IParMarket} from "../ParVault.sol";

/// @notice Test-only look-alike vault: reports a commitment that matches a market request exactly,
///         without reserving anything, and tries to collect the premium via onFill.
contract FakeMarketVault {
    address public owner = msg.sender;
    ParVault.Commitment internal c;

    function getCommitment(uint256) external view returns (ParVault.Commitment memory) {
        return c;
    }

    function attack(address market, uint256 requestId) external {
        IParMarket.Request memory r = IParMarket(market).getRequest(requestId);
        c.kind = ParVault.Kind(uint8(r.kind));
        c.status = ParVault.CStatus.Active;
        c.beneficiary = r.beneficiary;
        c.principal = r.requester;
        c.arbiter = r.arbiter;
        c.expiry = r.expiry;
        c.cap = r.cap;
        c.installment = r.installment;
        c.start = r.start;
        c.period = r.period;
        c.grace = r.grace;
        c.count = r.count;
        c.challengeWindow = r.challengeWindow;
        IParMarket(market).onFill(requestId, 0);
    }
}

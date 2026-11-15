The **Manage** panel on [Vault](/vault) has one tab per action. Anything that would leave the vault unable to honour its promises (withdrawing collateral, borrowing more) is refused by the contract with `Unhealthy()`.

| Action | Contract call | What it does |
| --- | --- | --- |
| Top up | `topUp(up, lo)` | Adds BTC collateral. Improves safety; does not raise capacity. Anyone can top up any vault. |
| Reserve | send BTC to the vault | Parks idle BTC in the vault for Recovery Mode payouts. Withdraw with `withdrawIdleBTC` (locked in Recovery Mode while commitments are reserved). |
| Buffer | `withdrawMUSDBuffer(amount, to)` | Withdraws MUSD from the buffer. |
| Repay | `repay(amount, up, lo)` | Repays trove debt from MUSD held by the vault. |
| Circuit line | `createClearingLine(circuit, cap, expiry)` | Pledges a clearing line to Par Circuit. |
| Collateral | `withdrawCollateral(amount, up, lo)` | Takes BTC collateral back to your wallet, if the vault still passes the stress test. |
| Borrow | `borrow(amount, to, up, lo)` | Draws MUSD from the trove to your wallet, if the vault still passes the stress test. |
| Refinance | `refinance(up, lo)` | Moves the trove to the current rate and re-snapshots capacity at today's price. |
| Ownership | `transferOwnership(newOwner)` | Proposes a new owner; they accept on the Vault page. |
| Close | `closeTrove()` | Repays the trove from the vault's MUSD and returns all BTC, once nothing is reserved. |

## Top up {#top-up}

Adding collateral raises the trove's collateral ratio and every certificate's "holds even if BTC falls" number. It does not raise capacity, because capacity was fixed when the trove opened. Use it when the keeper warns that the vault no longer passes the stress test.

## Recovery Mode reserve {#reserve}

In Recovery Mode the vault can only mint if it adds collateral at the same time. It takes that BTC from its own balance (idle BTC, not trove collateral). Send BTC to the vault address to fund the reserve (the **Reserve** tab does this). While Mezo is in Recovery Mode, the vault page shows a banner with how much BTC the reserve needs to pay every reserved commitment beyond the buffer, computed with `recoveryTopUp`. Withdraw idle BTC with `withdrawIdleBTC(amount)`. While Mezo is in Recovery Mode and any commitment is reserved, it reverts with `ReserveLocked()`: that BTC is what lets a pending payout go through.

## Buffer {#buffer}

The buffer is the MUSD the vault holds. Withdrawing it is allowed at any time, Recovery Mode included. It starts as the 1,800 MUSD minimum loan, and anyone can add to it by sending MUSD to the vault. Payouts use it before minting. It is not counted in health checks, so withdrawing it never makes the vault unhealthy; it only means the next payout is minted.

## Repay {#repay}

`repay` burns MUSD held by the vault against the trove's debt. Send MUSD to the vault first (or use the buffer). Repaying lowers debt and raises the collateral ratio; it does not change capacity.

## Withdraw collateral and borrow

`withdrawCollateral(amount, up, lo)` and `borrow(amount, to, up, lo)` are owner-only and run the stress test afterwards. If the vault would fail it, they revert with `Unhealthy()`.

## Refinance

`refinance(up, lo)` re-snapshots capacity at the current price and sets the current global rate. It must pass the stress test afterwards.

## Transfer ownership

Ownership moves in two steps so a typo cannot lose the vault: the owner calls `transferOwnership(newOwner)`, then the new owner calls `acceptOwnership()`. The factory updates `vaultsOf` for both addresses and emits `VaultOwnerChanged`. In the app: the owner uses **Manage → Ownership**; the new owner pastes the vault address under **Accept a vault transfer** on the Vault page.

:::warning Circuit memberships do not follow the vault
A circle member's invoices are checked against the vault's current owner. After a transfer, the old owner can no longer accept invoices with that vault.
:::

## After a liquidation or redemption

If the trove is liquidated or fully redeemed, MUSD may hold a collateral surplus for the vault. The owner calls `claimCollateral()` to pull it into the vault (the Vault page shows **Recover surplus collateral** when the trove is no longer active), then `withdrawIdleBTC` to take it out (the **Reserve** tab).

## Close

`closeTrove()` is only possible once no commitment reserves capacity (`reserved == 0`); otherwise it reverts with `ReservedCommitments()`. The vault must hold enough MUSD to repay the debt minus the 200 MUSD gas compensation. All BTC in the vault is then returned to you. In the app, **Manage → Close** shows how much MUSD the vault needs, offers to send any shortfall from your wallet, then closes the trove.

:::note Hints
Several calls take `up` and `lo` hint addresses for MUSD's sorted trove list. The app and keeper compute them from HintHelpers and SortedTroves; zero addresses also work, at a higher gas cost.
:::

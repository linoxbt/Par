A Par vault is a small contract you own. It holds one MUSD trove and a list of commitments that reserve the trove's undrawn capacity. This page walks through each piece.

:::flow
Vault | Your own contract, one per user
Trove | BTC collateral, MUSD debt, fixed capacity
Capacity | Collateral × price ÷ 1.1, locked at open
Commitments | Promises that reserve capacity
Payout | Buffer first, then mint
:::

## Vault

`ParFactory.createVault()` deploys an EIP-1167 clone of `ParVault` for the caller. The vault is the borrower of record for its trove, so only the vault (and through it, you) can manage the trove. One vault holds exactly one trove. Ownership can be handed over in two steps (`transferOwnership`, then `acceptOwnership` by the new owner); the factory keeps its `vaultsOf` list in sync.

## Trove

The vault opens a MUSD trove with `openTrove(seedDraw, up, lo)`, sending all the BTC you want to pledge. MUSD requires a minimum loan of **1,800 MUSD**. Par draws it at open and keeps it inside the vault as a liquid **buffer**.

The opening debt is the buffer plus a **0.1%** borrowing fee plus a **200 MUSD** gas compensation reserve. The gas compensation is held by MUSD and returned when the trove closes. Interest accrues at the global MUSD rate fixed at open (1% at the time of writing), and only on drawn debt.

## Capacity

When the trove opens, MUSD snapshots its **maximum borrowing capacity**:

```text
capacity = collateral × price ÷ 1.1
```

Capacity is fixed. Adding BTC later raises the collateral ratio (safety) but not capacity. Only `refinance` re-snapshots capacity, at the current price and the current global rate. This is why you open the trove with all the BTC you intend to pledge.

## Commitments

A commitment reserves part of the undrawn capacity. There are three kinds:

| Kind | Created with | Pays out when |
| --- | --- | --- |
| Scheduled | `createScheduled` | An installment is unpaid after its due date plus grace. |
| Claim | `createClaim` | A claim is undisputed after the challenge window, or approved by the arbiter. |
| ClearingLine | `createClearingLine` | ParCircuit force-settles the owner's net debt in a circle. |

Each commitment has a **cap** (the most the vault will ever pay on it) and an **expiry**. The vault tracks `reserved`, the sum of `cap − paidOut` over active commitments. A commitment is irrevocable for the owner: only the beneficiary can release it early, and anyone can close it after expiry (never while a claim is open).

Before a commitment is created, the vault checks that every reserved MUSD can still be minted under capacity, and that the vault stays above **160%** collateralised if BTC fell **40%** and every commitment were called at once. See [The stress test](/docs/learn/risk#the-stress-test).

## Payout waterfall {#payout-waterfall}

When a commitment is called, `_payout` pays the beneficiary in this order:

:::steps
@step From the MUSD buffer
If the vault holds enough MUSD (the opening buffer, or MUSD anyone sent to it), it pays from there. No new debt.
@step Mint the shortfall (Normal Mode)
If the buffer is short and Mezo is in Normal Mode, the vault mints the rest from the trove with `withdrawMUSD`, as long as the draw keeps the trove at or above 110% and the whole system at or above 150%. The 0.1% fee is added to the debt.
@step Otherwise: top up and mint
In Recovery Mode, or when a Normal Mode draw would push the system under 150% (or the trove under 110%), MUSD only allows new debt together with a collateral top-up. The vault computes the BTC needed with `recoveryTopUp`, takes it from its idle BTC reserve, and calls `adjustTrove`. If the reserve is short, the call reverts with `RecoveryModeNeedsReserve(btcNeeded)` and nothing changes; the keeper alerts you and retries.
:::

Every payout emits `Payout(id, to, amount, fromBuffer, minted)`, so you can see how much came from the buffer and how much was minted.

## What it costs

- **Opening:** the 0.1% fee on the 1,800 MUSD buffer, plus interest on the buffer while the trove is open. The 200 MUSD gas compensation comes back when the trove closes.
- **Each commitment:** nothing until it is called.
- **Each payout:** if minted, the 0.1% borrowing fee, then interest on the new debt.

## A worked example

Assume BTC is at $100,000 and you open with 0.1 BTC ($10,000 of collateral).

| Quantity | Value |
| --- | --- |
| Capacity | 10,000 ÷ 1.1 ≈ **9,091 MUSD** |
| Opening debt | 1,800 + 1.8 fee + 200 gas ≈ **2,002 MUSD** |
| Stressed price (−40%) | $60,000, so collateral is worth $6,000 |
| Most debt allowed at 160% under stress | 6,000 ÷ 1.6 = **3,750 MUSD** |
| Room for commitments (after fees) | ≈ **1,746 MUSD** |
| Payable in practice | ≈ 1,746 + 1,800 buffer ≈ **3,546 MUSD** |

Here the stress test, not capacity, is the binding limit. More BTC raises the room for commitments roughly in proportion.

A Par promise is only as good as the trove behind it. This page explains the checks Par runs, the MUSD thresholds it respects, and what the numbers on a certificate mean.

## The numbers at a glance

| Parameter | Value | Set by |
| --- | --- | --- |
| Stress drop | 40% (`stressBps = 4000`) | ParFactory, at deploy |
| Target ratio under stress | 160% (`targetIcr = 1.6e18`) | ParFactory, at deploy |
| MCR (liquidation line) | 110% | MUSD |
| CCR (Recovery Mode line) | 150% | MUSD |
| Borrowing fee | 0.1% | MUSD |

## The stress test

Every new commitment, and every owner action that could weaken the vault, must pass `health()`:

```text
need       = reserved + newCap + fee(reserved + newCap)
debtAfter  = debt + need
(a) capOk  : debtAfter <= capacity
(b) stress : collateral × price × (1 − 40%) ÷ debtAfter >= 160%
```

In words: if every reserved MUSD were minted right now, it must still fit under the trove's capacity, **and** the trove must stay at or above 160% even if BTC fell 40% at the same moment. The MUSD buffer is ignored, which makes the check conservative.

If the check fails, the transaction reverts with `Unhealthy()`. This applies to creating commitments, withdrawing collateral, borrowing and refinancing.

:::info The test runs at creation
Existing commitments are irrevocable. If BTC later falls past the stress level, the vault simply cannot make new promises, and the keeper warns you to add collateral. Existing promises are still honoured.
:::

## Mezo's thresholds: 110% and 150%

- **MCR, 110%.** A trove below 110% can be liquidated. A liquidated trove loses its collateral and its promises fail.
- **CCR, 150%.** When the whole MUSD system's collateral ratio (TCR) is below 150%, Mezo is in **Recovery Mode**. In Recovery Mode, troves below 150% are at risk, and new debt is only allowed together with a collateral top-up.

## Recovery Mode

In Recovery Mode the vault cannot simply mint. Par's payout waterfall handles it:

1. The vault computes, with `recoveryTopUp(draw, price)`, how much BTC must be added so the trove ends at or above 150% and better than before.
2. It takes that BTC from its **idle reserve**: BTC you sent to the vault itself, not trove collateral.
3. If the reserve is short, the payout reverts with `RecoveryModeNeedsReserve(btcNeeded)`. The installment or claim stays payable, the keeper alerts you with the exact amount, and retries every tick.

The same top-up path is used in Normal Mode when a plain draw would push the whole system's ratio under 150% (which would tip Mezo into Recovery Mode) or the trove under 110%. In that case `recoveryTopUp` returns just enough BTC to keep both above their lines.

While Mezo is in Recovery Mode and any commitment is reserved, the idle reserve is locked: `withdrawIdleBTC` reverts with `ReserveLocked()`, because that BTC is exactly what lets a pending payout go through. Withdrawing buffer MUSD is still allowed, since the health check never counts the buffer.

:::warning Keep the reserve funded near expiry
A missed installment can only be triggered before the guarantee's expiry. If Mezo is in Recovery Mode and your reserve is empty, fund it promptly so the payout goes through in time.
:::

## What "still covered if BTC falls X%" means

Certificates and the vault page show **Holds even if BTC falls X%**. It assumes the worst case, every reserved commitment called at once, and computes the BTC drop at which the trove would reach **150%** after all those draws:

```text
X = 1 − 150% × (debt + reserved + fee(reserved)) ÷ (collateral × price)
```

It is the drop to the **150% line**, not to liquidation at 110%. Above 150% the vault stays clear of Recovery Mode trouble and can still pay. Liquidation happens at a larger drop, which the vault page shows separately as the **liquidation price**.

| Example (0.1 BTC at $100,000, fully reserved) | Value |
| --- | --- |
| Debt after every commitment is drawn | ≈ 3,750 MUSD |
| Holds even if BTC falls | ≈ 44% (to about $56,200) |
| Liquidation if every commitment is drawn | at about $41,200 (a 59% drop) |

## Other risks

- **Liquidation or redemption of the trove.** If the trove stops being active (liquidated, fully redeemed or closed), `available()` returns 0 for every commitment and nothing more can be paid. The keeper raises a `trove-inactive` alert. Any collateral surplus MUSD keeps for the vault can be pulled back with `claimCollateral()` and then withdrawn as idle BTC.
- **Redemptions.** MUSD redemptions hit the lowest-ratio troves first. Par vaults run high ratios, so exposure is low.
- **Arbiter trust.** Disputed bond claims depend on the arbiter both sides chose.
- **Keeper liveness.** Payouts are permissionless, so anyone can trigger them, but in practice a keeper does. If it is down, beneficiaries can trigger payouts themselves from the app or a block explorer.
- **Smart-contract risk.** The contracts are unaudited. See [Security](/security).

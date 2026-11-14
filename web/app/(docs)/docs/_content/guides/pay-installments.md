The payer pays each installment through the vault, so the guarantee knows it was paid and does not fire.

:::steps
@step Open the pay link
Open `/pay/<vault>/<id>` and connect the wallet you pay from. Anyone can pay; it does not have to be the principal.
@step Approve MUSD
Approve the vault to spend the installment amount of MUSD. One approval can cover several installments.
@step Pay
Press pay. The vault calls `payInstallment(id, index)`, which sends the MUSD straight to the beneficiary and marks that installment settled. The vault never holds the payment.
:::

## When a payment is missed

After an installment's **due time plus the grace period**, anyone can call `triggerMissed(id, index, up, lo)`. Par runs a keeper that checks every 15 seconds and does this automatically.

The vault pays that installment, or whatever is left of the cover cap if less, through the payout waterfall:

1. From its MUSD buffer.
2. If the buffer is short, it mints the rest from the trove.
3. If Mezo is in **Recovery Mode**, MUSD only allows new debt alongside a collateral top-up. The vault uses idle BTC parked as a reserve. If the reserve is short, the payment waits and the owner is told exactly how much BTC to add; the keeper retries every tick.

## Rules

| Rule | Error if broken |
| --- | --- |
| Each installment can be settled once (paid or triggered). | `AlreadySettled()` |
| A miss can only be triggered after due + grace. | `TooEarly()` |
| A miss can only be triggered before expiry. | `TooLate()` |
| The index must be below the installment count. | `BadParams()` |
| The commitment must be an active installment guarantee. | `NotActive()` |

:::note Paying late
An installment can still be paid by the payer after its due date, as long as nobody has triggered it yet. Once the vault has paid it, it is settled and cannot be paid again.
:::

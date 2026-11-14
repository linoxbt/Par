Open [New guarantee](/vault/new-guarantee) from your vault. Pick **Rent / installments** or **Bond / claim**, fill in the form, and the builder shows the stress-test result live before you sign.

:::info You need an open vault
Guarantees reserve your trove's undrawn capacity. [Open a vault](/docs/guides/open-vault) first.
:::

## Installment guarantee

:::steps
@step Who gets paid
The beneficiary: landlord, supplier or client. Any Mezo address.
@step Who pays
The tenant or buyer who pays each installment. Defaults to you.
@step Amount and count
The installment in MUSD and the number of installments.
@step Schedule
**Monthly** (every 30 days, 3-day grace), **Weekly** (every 7 days, 1-day grace) or **Demo · 2 min** (every 120 s, 10 s grace).
@step Cover cap
The most the vault will ever pay in total. It can be less than the full schedule, for example three months of a twelve-month lease. It cannot exceed installment × count.
@step First due date
By default the first installment is due one period from now (60 s for the demo schedule). You can set it in seconds; the app requires at least 30 s so the start is still in the future when the transaction is mined (the contract rejects a start in the past).
@step Review and create
The summary shows the stress test. If it passes, sign. The app calls `createScheduled(beneficiary, principal, installment, start, period, grace, count, coverCap, expiry)`.
:::

The app sets the expiry so it covers every installment plus its grace period, with 7 days of margin (600 s for the demo schedule). The contract requires the expiry to be at least 300 s (`MIN_TRIGGER_WINDOW`) after the last due time plus grace, so the last installment can still be triggered.

## Claim bond

:::steps
@step Who gets paid
The beneficiary, who can file claims.
@step Principal
The party whose performance is bonded. They can dispute claims. Defaults to you.
@step Arbiter
An address both sides trust to decide disputed claims. It cannot be you (the owner), the beneficiary or the principal. Agree on it before you create the bond.
@step Cover, validity and challenge window
Cover in MUSD, how many days the bond is valid, and the challenge window in hours. The contract requires a window of at least 60 seconds.
@step Review and create
The app calls `createClaim(beneficiary, principal, arbiter, cap, expiry, challengeWindow)`.
:::

## The stress test

Before a guarantee is created, the vault checks that every reserved MUSD, including the new cap, can still be minted under capacity, and that the vault would stay at or above **160%** if BTC fell **40%** and every promise were called at once. If not, the transaction reverts with `Unhealthy()`. The builder runs the same check (`health(newCap)`) before you sign, so you see the result first.

If you hit the limit: lower the cover cap, close commitments you no longer need, or open a new vault with more BTC. Topping up adds safety and can help pass the 160% check, but it does not add capacity.

## Share it

After creation you get two links:

| Link | For | What it does |
| --- | --- | --- |
| `/c/<vault>/<id>` | The beneficiary | Public certificate with live status and cover. See [Read a certificate](/docs/guides/read-certificate). |
| `/pay/<vault>/<id>` | The payer | Pay installments. See [Pay installments](/docs/guides/pay-installments). |

:::note A guarantee is irrevocable
You cannot cancel a guarantee. Only the beneficiary can release it early. After expiry anyone can close it and the unused cover returns to your vault.
:::

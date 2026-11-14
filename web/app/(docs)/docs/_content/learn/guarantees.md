A guarantee is a commitment in your vault that pays a named beneficiary if a promise breaks. Par has two kinds: **installment guarantees**, where the contract can see whether a payment arrived, and **claim bonds**, where someone has to say that a promise was broken.

## Roles

| Role | Who | What they can do |
| --- | --- | --- |
| Owner | You, the vault owner | Creates the guarantee. Can dispute claims. Cannot cancel it. |
| Beneficiary | Landlord, supplier, client | Receives payouts. Files claims on a bond. Can release the guarantee early. |
| Principal / payer | Tenant, buyer, contractor | Pays installments. Can dispute claims on a bond. Defaults to you. |
| Arbiter | Someone both sides trust (bonds only). Cannot be the owner, the beneficiary or the principal. | Approves or rejects a disputed claim within 7 days. |
| Anyone | Usually the keeper | Triggers a missed installment, executes an undisputed (or unresolved) claim, closes an expired guarantee. |

## Installment guarantees

Use these for rent, buy-now-pay-later and supplier terms: a fixed amount due on a fixed schedule.

| Field | Meaning |
| --- | --- |
| Installment | MUSD due each period. |
| Count | Number of installments. |
| Start | Due time of installment #0, not in the past. Installment `i` is due at `start + i × period`. |
| Period | Seconds between installments. The app offers monthly (30 days), weekly (7 days) and a 2-minute demo. |
| Grace | Seconds after the due time before a miss can be triggered. The app uses 3 days, 1 day and 10 seconds respectively. |
| Cover cap | The most the vault will ever pay in total. At most installment × count. |
| Expiry | At least 300 s (`MIN_TRIGGER_WINDOW`) after the last due time plus grace, so the last installment can actually be triggered. After expiry, no more misses can be triggered and anyone can close the guarantee. |

**How it pays:** the payer pays each installment through the vault (`payInstallment`), which sends the MUSD straight to the beneficiary and marks it settled. If an installment is still unsettled after `due + grace`, anyone can call `triggerMissed`, and the vault pays that installment (or whatever is left of the cover cap, if less) through the [payout waterfall](/docs/learn/how-it-works#payout-waterfall). Each installment can be settled once, either way.

:::note Partial cover is normal
A 12-month lease with a 3-month cover cap is a common setup: the landlord is protected against a few missed months, and you reserve far less capacity than the full lease.
:::

## Claim bonds

Use these for performance bonds, deposits and anything where a breach is a judgement call.

| Field | Meaning |
| --- | --- |
| Cover (cap) | The most the vault will pay across all claims. |
| Principal | The party whose performance is bonded. May dispute claims. |
| Arbiter | Decides disputed claims. Must not be the owner, the beneficiary or the principal. Agree on it before you create the bond. |
| Challenge window | Seconds after a claim is filed during which it can be disputed. At least 60 seconds. |
| Expiry | After this, no new claims can be filed. |

**How it pays:**

:::flow
File | Beneficiary files an amount and evidence
Challenge | Principal or owner may dispute within the window
Execute | Undisputed: anyone executes after the window
Arbitrate | Disputed: the arbiter decides within 7 days
:::

Only one claim can be open at a time. If the arbiter does not decide within **7 days** of the dispute, anyone can execute the claim and it pays: you chose the arbiter, so an absent arbiter is your risk, not the beneficiary's. A rejected claim leaves the cover intact; the beneficiary may file again after waiting one challenge window, until expiry. See [File, dispute and resolve a claim](/docs/guides/claims).

## Closing and expiry

- The **beneficiary** can release a guarantee at any time with `closeCommitment`. The unused cover is returned to the vault's capacity.
- After **expiry**, anyone can close it. Exception: an expired Circuit clearing line can't be closed while the circuit is still owed on it (`LineOwed()`); debt booked while the line was live stays drawable after expiry.
- Nobody can close it while a claim is open (`ClaimOpen()`): the open claim must be executed or resolved first.
- A guarantee closes automatically when its cap has been paid out in full.

## What the beneficiary sees

Every guarantee has a public certificate at `/c/<vault>/<id>`: status, cover remaining, how far BTC can fall before the cover is at risk, the installment timeline and every payout with an explorer link. See [Read a certificate](/docs/guides/read-certificate).

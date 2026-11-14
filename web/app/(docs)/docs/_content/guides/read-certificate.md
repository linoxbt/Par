Every commitment has a public certificate at `/c/<vault>/<id>`. It reads live from the chain, is built to be read on a phone, and can be shared on any messenger. Nobody needs a wallet to view it.

## Status

| Status | Meaning |
| --- | --- |
| **Guaranteed** (Active) | The commitment is active and before expiry. A green badge means the vault passes the stress test; amber means it no longer does and the owner has been asked to top up. Existing cover is still valid. |
| **Expired** | Past expiry. No new misses or claims can be triggered. Anyone can close it. |
| **Paid in full** | The vault has paid out the whole cap. |
| **Released** | Closed before the cap was paid out: released by the beneficiary, or closed after expiry. |

## The numbers

| Field | Meaning |
| --- | --- |
| Cover remaining | `cap − paidOut`: what the vault can still pay on this commitment. |
| Holds even if BTC falls | The BTC price drop the vault can absorb, with every reserved commitment called at once, before its collateral ratio reaches 150%. |
| Valid until | The commitment's expiry. |

:::info "Holds even if BTC falls X%" is a conservative number
It measures the drop to the **150% line** (Mezo's Recovery Mode threshold), not to liquidation at 110%. Liquidation needs a larger drop. It also assumes every commitment in the vault is called at the same moment, which is the worst case. See [Risk and safety](/docs/learn/risk#what-still-covered-if-btc-falls-x-means).
:::

## Installment timeline

For an installment guarantee, each installment shows its due date and one of:

- **Paid by tenant**: the payer paid it through the pay link.
- **Covered by vault**: it was missed and the vault paid it.
- **Settled**: marked settled onchain.
- A countdown while it is due or in its grace period.

## Payout history

Every payout is listed with its amount and an explorer link to the transaction. The `Payout` event records how much came from the buffer and how much was minted.

## Claims

For a claim bond, the certificate shows the open claim (amount, evidence reference, filing time, whether it is disputed) and the actions available to whoever is connected: dispute, execute or resolve. See [File, dispute and resolve a claim](/docs/guides/claims).

## Verify it yourself

Everything on the certificate comes from the vault contract. To check independently, read `getCommitment(id)`, `available(id)` and `health(0)` on the vault address in the [explorer]({{explorer}}).

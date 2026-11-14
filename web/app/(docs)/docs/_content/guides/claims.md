Claim bonds pay after a claim that nobody disputes, or that the arbiter approves. All actions are on the bond's certificate page.

:::flow
File | Beneficiary: amount + evidence
Challenge window | Principal or owner may dispute
Execute | Undisputed: anyone, after the window
Resolve | Disputed: arbiter decides within 7 days
:::

## File a claim

The **beneficiary** files with an amount and evidence: a link or file reference. Only its hash (`bytes32`) is stored onchain, so keep the original. This calls `fileClaim(id, amount, evidence)`.

- The amount must be more than zero and no more than the cover remaining, or the call reverts with `ExceedsCap()`.
- Only one claim can be open at a time (`BadParams()` otherwise).
- Claims can only be filed before expiry (`TooLate()` after).
- After a rejection, the beneficiary must wait one challenge window before filing again (`TooEarly()`).

## Dispute a claim

The **principal** or the **vault owner** can dispute during the challenge window with `disputeClaim(id)`. After the window, the claim can no longer be disputed (`TooLate()`). The dispute time is recorded; it starts the arbiter's 7-day clock.

## Execute a claim

**Anyone** can call `executeClaim(id, up, lo)`, and the keeper does it automatically:

- an **undisputed** claim, once the challenge window has passed;
- a **disputed** claim the arbiter left unresolved for more than **7 days** (`RESOLVE_WINDOW`). The default outcome is to pay.

The vault pays the claim through the [payout waterfall](/docs/learn/how-it-works#payout-waterfall).

## Resolve a disputed claim

The **arbiter** calls `resolveClaim(id, approve, up, lo)` within 7 days of the dispute (`TooLate()` after):

- **Approve:** the vault pays the claim.
- **Reject:** the claim is closed and the cover stays intact. The beneficiary may file a new claim after one challenge window, before expiry.

## Who can do what

| Action | Beneficiary | Principal | Owner | Arbiter | Anyone |
| --- | --- | --- | --- | --- | --- |
| File | Yes | | | | |
| Dispute (within window) | | Yes | Yes | | |
| Execute (undisputed, after window) | Yes | Yes | Yes | Yes | Yes |
| Execute (disputed, after 7 days unresolved) | Yes | Yes | Yes | Yes | Yes |
| Resolve (disputed, within 7 days) | | | | Yes | |
| Release the bond early (no open claim) | Yes | | | | |

## Timeline example

With a 48-hour challenge window:

| Time | Event |
| --- | --- |
| Day 0 | Beneficiary files a 500 MUSD claim. |
| Day 1 | Principal disputes. The arbiter has until day 8. |
| Day 3 | Arbiter rejects. Cover is intact. |
| Day 5 | Earliest the beneficiary can file again (one window after the rejection). |

If the arbiter had done nothing, anyone could execute the claim after day 8 and it would pay.

:::warning Choose the arbiter carefully
A disputed claim depends on the arbiter, and an absent arbiter means the claim pays by default. The arbiter cannot be the vault owner, the beneficiary or the principal. Pick someone both sides trust, and agree on it before the bond is created.
:::

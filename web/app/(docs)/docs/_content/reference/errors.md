Par uses Solidity custom errors. Wallets and the app decode them by name; the keeper simulates every call first, so an error there just means the job is not due.

## ParVault

| Error | When | What to do |
| --- | --- | --- |
| `NotOwner()` | An owner-only function was called by someone else. | Connect the wallet that owns the vault. |
| `NotAuthorized()` | Wrong caller: filing a claim as non-beneficiary, disputing as neither principal nor owner, resolving as non-arbiter, drawing a line as non-circuit, closing before expiry as non-beneficiary, or accepting ownership as non-pending owner. | Use the right account, or wait for expiry to close. |
| `AlreadyInitialized()` | `initialize` was called twice, or on the implementation. | Vaults are created only through `ParFactory.createVault()`. |
| `BadParams()` | Invalid inputs when creating a commitment, an index past the installment count, or filing while a claim is already open. | Check the rules in [ParVault](/docs/reference/par-vault#creating-commitments-owner): start not in the past, expiry at least 300 s (`MIN_TRIGGER_WINDOW`) after the last due time plus grace, cover ≤ installment × count, arbiter not the owner, beneficiary or principal, challenge window ≥ 60 s, circuit is a contract. |
| `NotActive()` | The commitment is not active or is the wrong kind; no open claim (or wrong dispute state); `recoveryTopUp` without an active trove. | Check the commitment status and claim state on its certificate. |
| `Unhealthy()` | The action would fail the stress test (capacity or 160% at a 40% drop). | Lower the cap, close unused commitments, top up, or open a larger vault. |
| `TooEarly()` | Triggering a miss before due + grace; executing a claim before its window (or before the 7-day resolve window for a disputed claim); refiling within one challenge window of a rejection. | Wait. The keeper retries automatically. |
| `TooLate()` | Triggering a miss or filing a claim after expiry; disputing after the challenge window; resolving more than 7 days after the dispute. (Clearing lines have no expiry check on draws: debt booked while the line was live stays collectable.) | The window has passed. A lapsed arbiter's claim can be executed by anyone. |
| `AlreadySettled()` | The installment was already paid or triggered. | Nothing to do. |
| `ExceedsCap()` | A claim or payout larger than the cover remaining, or a zero claim. | Claim at most `cap − paidOut`. |
| `RecoveryModeNeedsReserve(uint256 btcNeeded)` | A payout needs a collateral top-up (Recovery Mode, or a draw that would push the system under 150%) and the vault's idle BTC is short. | Owner: send at least `btcNeeded` BTC to the vault. The keeper retries every tick. |
| `ReservedCommitments()` | `closeTrove` while commitments still reserve capacity. | Wait for commitments to expire or be released, and close them. |
| `ClaimOpen()` | `closeCommitment` while a claim is open. | Execute or resolve the claim first. |
| `ReserveLocked()` | `withdrawIdleBTC` in Recovery Mode while commitments are reserved. | Wait until Mezo leaves Recovery Mode, or until no commitment is reserved. |
| `LineOwed()` | Closing an expired clearing line while its circuit still has debt booked on it. | Wait until that debt is settled (by the member, or by `forceSettle`, which draws the line), then close. |

## ParCircuit

| Error | When | What to do |
| --- | --- | --- |
| `NotAdmin()` | `addMember` or `setSuspended` by a non-admin, or `removeMember` by someone who is neither the admin nor the member. | Use the admin account. |
| `NotMember()` | Creditor or debtor is not an active member; accepting as someone other than the debtor; the debtor's vault was transferred away; removing or suspending a non-member. | Join the circle, or use the member's account. |
| `NotInvited()` | `join` without an open invite matching this vault and line. | Ask the admin to invite you with exactly this vault and line id. |
| `NotParVault()` | The vault was not created by ParFactory. | Use a Par vault. |
| `Suspended()` | Creating or accepting an invoice when the creditor or debtor is suspended in the circle. | Ask the admin to reinstate the member. A suspended member can still settle and claim. |
| `LineInUse()` | The line already backs another membership. | Pledge a new clearing line, or leave the other circle first. |
| `LineExpiresTooSoon(uint256 expiry, uint256 needed)` | The line expires before the current cycle's close plus settle window (at invite, join, or when accepting as net debtor). | Pledge a new line with a later expiry and re-join with it. |
| `HasObligations()` | Leaving or re-pointing with outstanding debt or a non-zero net in the current or previous cycle. | Settle, and wait for the nets to clear. |
| `BadParams()` | Bad circle parameters; the circle does not exist; the member does not own the vault; the line is not an active ClearingLine to ParCircuit; zero or self invoice; invoice not pending. | Check the inputs. |
| `WrongCycle()` | Accepting an invoice after its cycle ended. | The creditor issues a new invoice. |
| `OverLimit(uint256 limit, uint256 wouldOwe)` | Accepting would make the debtor owe more than the line can pay. | Settle earlier cycles, reject some invoices, or pledge a larger line. |
| `NotYet()` | Settling before close; force-settling before close + window; claiming before everything is collected and before `finalAt`; claiming again with nothing new collected. | Wait. |
| `Done()` | Settling when not a net debtor or already settled; claiming when not a net creditor or already paid in full. | Nothing to do. |

## ParFactory

| Error | When |
| --- | --- |
| `NotVault()` | `onVaultOwnerChanged` called by an address that is not one of the factory's vaults. |

:::note MUSD errors
Calls into MUSD can also revert with MUSD's own messages, for example when a draw would leave the trove under the minimum ratio, or when `openTrove` is called with less than the minimum debt.
:::

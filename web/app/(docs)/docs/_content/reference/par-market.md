`ParMarket` is the underwriting market: requesters post cover requests and escrow a premium in MUSD; a vault owner fills a request from their vault in one transaction and receives the premium.

Source: [`contracts/contracts/ParMarket.sol`](https://github.com/linoxbt/par/blob/main/contracts/contracts/ParMarket.sol) · Address: [`{{ParMarket}}`]({{explorer}}/address/{{ParMarket}})

The constructor takes the `ParFactory`; MUSD is read from it. Only vaults created by that factory can fill a request.

## Types

| Type | Values |
| --- | --- |
| `RKind` | `Scheduled` (0), `Claim` (1) |
| `RStatus` | `None` (0), `Open` (1), `Filled` (2), `Cancelled` (3) |

`Request` fields, in `getRequest` order: `requester`, `kind`, `status`, `deadline`, `beneficiary`, `start`, `period`, `arbiter`, `grace`, `count`, `challengeWindow`, `vault`, `expiry`, `installment`, `cap`, `premium`, `commitmentId`, `ref`. `vault` and `commitmentId` are set when the request is filled.

## Requesting

Both functions pull `premium` MUSD from the caller (approve ParMarket first; a premium of 0 is allowed) and emit `RequestCreated`. The caller becomes the guarantee's principal.

| Function | Rules (else `BadParams`) |
| --- | --- |
| `requestScheduled(beneficiary, uint128 installment, uint64 start, uint32 period, uint32 grace, uint16 count, uint128 cap, uint64 expiry, uint128 premium, uint64 deadline, bytes32 ref) → id` | Same rules as the vault's `createScheduled`: non-zero beneficiary, installment, count, period and cap; `cap ≤ installment × count`; `start ≥ now`; `expiry ≥ start + (count − 1) × period + grace + 300`. Also: the beneficiary isn't the caller, and `now ≤ deadline ≤ start`, so the request can't be filled after the first payment is due. |
| `requestClaim(beneficiary, arbiter, uint128 cap, uint64 expiry, uint32 challengeWindow, uint128 premium, uint64 deadline, bytes32 ref) → id` | Non-zero beneficiary and arbiter; the beneficiary isn't the caller; the arbiter is neither the caller nor the beneficiary; non-zero cap; expiry in the future; `challengeWindow ≥ 60`; `now ≤ deadline < expiry`. |
| `cancel(uint256 id)` | Requester only (`NotRequester`), while open (`NotOpen`). Refunds the premium. Works after the deadline too. Emits `RequestCancelled`. |

`ref` is an arbitrary reference, usually the hash of an off-chain note. It is stored, not interpreted.

## Filling

A request is filled through the underwriter's vault, never directly:

| Function | Access | Description |
| --- | --- | --- |
| `ParVault.fillRequest(address market, uint256 id) → commitmentId` | Vault owner | Reverts `NotActive` if the request isn't open. Reads the request, creates the matching commitment (the requester as principal), runs the stress test with the new cap (`Unhealthy` otherwise), then calls `market.onFill(id, commitmentId)`. Reverts `BadParams` for a bond whose arbiter is the vault owner. |
| `onFill(uint256 id, uint256 commitmentId)` | Factory vaults only (`NotParVault`) | Requires the request to be open (`NotOpen`) and not past its deadline (`Expired`); the vault owner isn't the requester (`SelfFill`); and the commitment is active, unpaid and matches every term of the request (`Mismatch`). Marks it filled, records the vault and commitment, pays the premium to the vault owner and emits `RequestFilled`. |

Everything happens in one transaction: if any check fails, no commitment is created and no premium moves.

## Views

| Function | Returns |
| --- | --- |
| `getRequest(uint256 id) → Request` | The full request. |
| `nextRequestId() → uint256` | The id the next request will get; ids start at 0. |
| `openCount() → uint256` | Requests currently open (including past-deadline ones not yet cancelled). |
| `factory() → address`, `musd() → address` | Wiring. |
| `MIN_TRIGGER_WINDOW`, `MIN_CHALLENGE_WINDOW` | 300 s and 60 s, the same as the vault's. |

## Events

| Event | When |
| --- | --- |
| `RequestCreated(id, requester, kind, beneficiary, cap, premium, deadline)` | A request is posted. |
| `RequestCancelled(id)` | The requester cancels. |
| `RequestFilled(id, vault, commitmentId, underwriter, premium)` | A vault fills it. |

## Errors

| Error | Meaning |
| --- | --- |
| `BadParams()` | The request's terms break a rule above. |
| `NotRequester()` | Only the requester can cancel. |
| `NotOpen()` | Already filled or cancelled. |
| `Expired()` | Past the request's deadline. |
| `NotParVault()` | `onFill` was not called by a factory vault. |
| `SelfFill()` | The underwriter is the requester. |
| `Mismatch()` | The commitment doesn't match the request exactly. |

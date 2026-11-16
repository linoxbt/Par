`ParVault` is one user's vault: an EIP-1167 clone created by [ParFactory](/docs/reference/par-factory). It is the borrower of its MUSD trove, holds the user's commitments, runs the health check and pays out through the waterfall.

Source: [`contracts/contracts/ParVault.sol`](https://github.com/linoxbt/par/blob/main/contracts/contracts/ParVault.sol) · Implementation: [`{{ParVaultImplementation}}`]({{explorer}}/address/{{ParVaultImplementation}})

:::info Hints
Functions that touch the trove take `up` and `lo`: hint addresses for MUSD's sorted trove list. Compute them with HintHelpers and SortedTroves, or pass the zero address (works, costs more gas).
:::

## Types

| Type | Values |
| --- | --- |
| `Kind` | `Scheduled` (0), `Claim` (1), `ClearingLine` (2) |
| `CStatus` | `None` (0), `Active` (1), `Closed` (2) |

`Commitment` fields: `kind`, `status`, `beneficiary`, `principal`, `arbiter`, `expiry`, `cap`, `paidOut`, `installment`, `start`, `period`, `grace`, `count`, `challengeWindow`.

`PendingClaim` fields: `amount`, `filedAt`, `disputed`, `open`, `evidence`, `disputedAt`, `rejectedAt`.

## Trove management (owner)

| Function | Description |
| --- | --- |
| `openTrove(uint256 seedDraw, address up, address lo)` payable | Opens the trove with all BTC sent. `seedDraw` must be at least MUSD's minimum net debt (1,800 MUSD); it stays in the vault as the buffer. Capacity and rate are snapshotted. Emits `TroveOpened`. |
| `topUp(address up, address lo)` payable | Adds collateral. **Anyone** may call it. |
| `withdrawCollateral(uint256 amount, address up, address lo)` | Withdraws collateral to the owner. Must stay healthy. |
| `borrow(uint256 amount, address to, address up, address lo)` | Mints MUSD to `to`. Must stay healthy. |
| `repay(uint256 amount, address up, address lo)` | Repays debt from MUSD held by the vault. |
| `refinance(address up, address lo)` | Re-snapshots capacity at the current price and rate. Must stay healthy. |
| `claimCollateral()` | Pulls a collateral surplus MUSD keeps after a liquidation or redemption into the vault. Emits `CollateralClaimed`. |
| `closeTrove()` | Closes the trove and sends all BTC to the owner. Requires `reserved == 0`; the vault must hold the debt minus 200 MUSD. |
| `withdrawMUSDBuffer(uint256 amount, address to)` | Sends buffer MUSD. Allowed in any mode. |
| `withdrawIdleBTC(uint256 amount)` | Sends idle BTC (not collateral) to the owner. Reverts `ReserveLocked` in Recovery Mode while commitments are reserved. |

## Ownership

| Function | Description |
| --- | --- |
| `transferOwnership(address newOwner)` | Owner only. Sets `pendingOwner`. Emits `OwnershipTransferStarted`. |
| `acceptOwnership()` | Pending owner only. Completes the transfer, notifies the factory, emits `OwnershipTransferred`. |

## Creating commitments (owner)

All three run the stress test with the new cap (`health(cap)`) and revert `Unhealthy` if it fails.

| Function | Rules (else `BadParams`) |
| --- | --- |
| `createScheduled(beneficiary, principal, uint128 installment, uint64 start, uint32 period, uint32 grace, uint16 count, uint128 coverCap, uint64 expiry) → id` | Non-zero beneficiary, installment, count, period and cover; `coverCap ≤ installment × count`; `start ≥ now`; `expiry ≥ start + (count − 1) × period + grace + MIN_TRIGGER_WINDOW` (300 s), so the last installment stays triggerable for at least five minutes. |
| `createClaim(beneficiary, principal, arbiter, uint128 cap, uint64 expiry, uint32 challengeWindow) → id` | Non-zero beneficiary and arbiter; the arbiter must differ from the owner, the beneficiary and the principal; non-zero cap; expiry in the future; `challengeWindow ≥ 60`. |
| `createClearingLine(address circuit, uint128 cap, uint64 expiry) → id` | `circuit` must be a contract; non-zero cap; expiry in the future. The principal is the owner. |

**From the market.** `fillRequest(address market, uint256 requestId) → id` (owner) backs an open [ParMarket](/docs/reference/par-market) request: it creates the scheduled guarantee or claim bond the request describes, with the requester as principal, under the same rules and stress test as above. The market then checks the terms match and pays the escrowed premium to the owner. Reverts `NotActive` if the request isn't open; any failure reverts the whole fill.

## Installments

| Function | Access | Description |
| --- | --- | --- |
| `payInstallment(uint256 id, uint256 index)` | Anyone | Transfers `installment` MUSD from the caller straight to the beneficiary (approve the vault first) and marks the index settled. Emits `InstallmentPaid`. |
| `triggerMissed(uint256 id, uint256 index, address up, address lo)` | Anyone | After `dueTime + grace` and before expiry, marks the index settled and pays `min(installment, cap − paidOut)`. Emits `InstallmentMissed` and `Payout`. |
| `dueTime(uint256 id, uint256 index) → uint256` | View | `start + index × period`. |
| `installmentSettled(uint256 id, uint256 index) → bool` | View | Whether an installment was paid or triggered. |

## Claims

| Function | Access | Description |
| --- | --- | --- |
| `fileClaim(uint256 id, uint128 amount, bytes32 evidence)` | Beneficiary | Opens a claim before expiry. One open claim at a time; after a rejection, wait one challenge window. Emits `ClaimFiled`. |
| `disputeClaim(uint256 id)` | Principal or owner | Within the challenge window. Starts the 7-day resolve window. Emits `ClaimDisputed`. |
| `resolveClaim(uint256 id, bool approve, address up, address lo)` | Arbiter | Within 7 days of the dispute. Approve pays; reject records `rejectedAt`. Emits `ClaimResolved`. |
| `executeClaim(uint256 id, address up, address lo)` | Anyone | Pays an undisputed claim after the challenge window, or a disputed claim left unresolved past `disputedAt + RESOLVE_WINDOW`. Emits `ClaimResolved(id, true)` and `Payout`. |
| `pendingClaims(uint256 id)` | View | The `PendingClaim` for a commitment. |

## Clearing lines and closing

| Function | Access | Description |
| --- | --- | --- |
| `drawLine(uint256 id, uint256 amount, address up, address lo)` | The line's circuit | Pays `amount` to the circuit through the waterfall. No expiry check: the circuit only books new debt on a line while it is live, and debt booked before expiry stays collectable after it, however late the force-settle runs. |
| `closeCommitment(uint256 id)` | Beneficiary any time; anyone after expiry | Releases `cap − paidOut` from `reserved`. Never while a claim is open (`ClaimOpen`). An expired clearing line can't be closed by anyone but its circuit while the circuit still has debt booked on it (`outstanding > 0`, `LineOwed`). Emits `CommitmentClosed`. |

## Views

| Function | Returns |
| --- | --- |
| `health(uint256 extraReserve) → (bool ok, uint256 stressedIcr, uint256 headroom)` | The stress test with `extraReserve` added. `ok` is false if the trove is not active. |
| `troveState() → (uint256 coll, uint256 debt, uint256 capacity)` | Collateral, total debt (principal + interest, including pending) and capacity. |
| `recoveryTopUp(uint256 draw, uint256 price) → uint256` | BTC to add alongside a draw so MUSD accepts it. 0 in Normal Mode when the plain draw keeps the trove ≥ 110% and the system ≥ 150%. Reverts `NotActive` without an active trove. |
| `available(uint256 id) → uint256` | `cap − paidOut`, or 0 if the commitment is closed, expired, or the trove is not active. |
| `getCommitment(uint256 id) → Commitment` | The full struct. |
| `commitmentInfo(uint256 id) → (kind, status, beneficiary, cap, paidOut, expiry)` | A compact view used by ParCircuit. |
| `reserved() → uint256` | Sum of `cap − paidOut` over active commitments. |
| `nextId() → uint256` | The id the next commitment will get. |
| `owner()`, `pendingOwner()`, `factory()` | Addresses. |
| `stressBps()`, `targetIcr()`, `CCR()`, `MCR()`, `MIN_CHALLENGE_WINDOW()` (60 s), `MIN_TRIGGER_WINDOW()` (300 s), `RESOLVE_WINDOW()` (7 days) | Parameters. |

## Events

| Event | Emitted when |
| --- | --- |
| `TroveOpened(uint256 collateral, uint256 seedDraw)` | The trove opens. |
| `CommitmentCreated(uint256 indexed id, Kind kind, address indexed beneficiary, uint256 cap, uint64 expiry)` | A commitment is created. |
| `InstallmentPaid(uint256 indexed id, uint256 indexed index, address payer, uint256 amount)` | An installment is paid by the payer. |
| `InstallmentMissed(uint256 indexed id, uint256 indexed index, uint256 amount)` | A missed installment is triggered. |
| `ClaimFiled(uint256 indexed id, uint256 amount, bytes32 evidence)` | A claim is filed. |
| `ClaimDisputed(uint256 indexed id)` | A claim is disputed. |
| `ClaimResolved(uint256 indexed id, bool approved)` | A claim is resolved, executed or rejected. |
| `Payout(uint256 indexed id, address indexed to, uint256 amount, uint256 fromBuffer, uint256 minted)` | The vault pays out. |
| `CommitmentClosed(uint256 indexed id, uint256 released)` | A commitment is closed early or after expiry. |
| `OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)` | A transfer is proposed. |
| `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)` | A transfer completes. |
| `CollateralClaimed(uint256 amount)` | Surplus collateral is pulled in. |

## Errors

See [Errors](/docs/reference/errors) for what each error means and what to do.

`NotOwner`, `NotAuthorized`, `AlreadyInitialized`, `BadParams`, `NotActive`, `Unhealthy`, `TooEarly`, `TooLate`, `AlreadySettled`, `ExceedsCap`, `RecoveryModeNeedsReserve(uint256 btcNeeded)`, `ReservedCommitments`, `ClaimOpen`, `ReserveLocked`, `LineOwed`.

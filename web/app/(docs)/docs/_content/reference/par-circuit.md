`ParCircuit` is the central counterparty for trade-credit circles: membership, invoices, incremental netting, settlement and claims. One contract serves every circle.

Source: [`contracts/contracts/ParCircuit.sol`](https://github.com/linoxbt/par/blob/main/contracts/contracts/ParCircuit.sol) · Address: [`{{ParCircuit}}`]({{explorer}}/address/{{ParCircuit}})

The constructor takes the `ParFactory`; MUSD is read from it. Only vaults created by that factory can back a membership.

## Types

| Type | Fields |
| --- | --- |
| `Circle` | `admin`, `genesis`, `cycleLength`, `settleWindow`, `exists` |
| `Member` | `vault`, `lineId`, `active` |
| `Invite` | `vault`, `lineId`, `open` |
| `Invoice` | `circleId`, `creditor`, `debtor`, `amount`, `cycle`, `status`, `ref` |
| `InvStatus` | `None` (0), `Pending` (1), `Accepted` (2), `Rejected` (3) |

## Circles and members

| Function | Access | Description |
| --- | --- | --- |
| `createCircle(uint64 cycleLength, uint64 settleWindow) → id` | Anyone | Caller becomes admin; genesis is now. Requires `cycleLength > 0` and `settleWindow ≤ cycleLength`. Emits `CircleCreated`. |
| `addMember(uint256 circleId, address member, address vault, uint256 lineId)` | Admin | Creates (or replaces) an invite for `member` with this vault and line, after checking the line. Emits `MemberInvited`. |
| `join(uint256 circleId, address vault, uint256 lineId)` | Invited member | Accepts the invite. Checks the line again, and that it is not bound to another membership. Re-pointing an existing membership requires no exposure on the old line. Emits `MemberJoined`. |
| `removeMember(uint256 circleId, address member)` | Admin or the member | Only with zero `outstanding` and a zero net in the current and previous cycle. Frees the line. Emits `MemberRemoved`. |

**Line checks** (at invite, at join): the vault is a factory vault (`NotParVault`); the circle exists and the member owns the vault (`BadParams`); the commitment is an active ClearingLine whose beneficiary is ParCircuit (`BadParams`); and its expiry is at least `cycleClose(current cycle) + settleWindow` (`LineExpiresTooSoon`).

## Invoices

| Function | Access | Description |
| --- | --- | --- |
| `createInvoice(uint256 circleId, address debtor, uint128 amount, bytes32 ref) → id` | Active member | Bills another active member in the current cycle. Emits `InvoiceCreated`. |
| `acceptInvoice(uint256 id)` | Debtor | Same cycle only (`WrongCycle`). Updates both nets, `gross`, `totalOwed` and the debtor's `outstanding`. If the debtor ends up a net debtor: the line must live until this cycle's settle deadline (`LineExpiresTooSoon`) and `outstanding ≤ available()` (`OverLimit`). Emits `InvoiceAccepted`. |
| `rejectInvoice(uint256 id)` | Debtor or creditor | Rejects a pending invoice. Emits `InvoiceRejected`. |

## Settlement

| Function | Access | Description |
| --- | --- | --- |
| `settle(uint256 circleId, uint64 cycle)` | Net debtor | After `cycleClose`. Pulls the owed MUSD (approve first). Late settlement is accepted, even after the cycle is final. Emits `Settled(..., false)`. |
| `forceSettle(uint256 circleId, uint64 cycle, address debtor, address up, address lo)` | Anyone | After `cycleClose + settleWindow`. Draws the debtor's clearing line for exactly the amount owed. Emits `Settled(..., true)`. |
| `claim(uint256 circleId, uint64 cycle)` | Net creditor | In full once `collected ≥ totalOwed`; otherwise, after `finalAt`, pro rata `credit × collected ÷ totalOwed` minus what was already claimed. Can be called again as more is collected. Emits `Claimed`, and `CycleFinalized` on the first pro-rata claim. |

## Views

| Function | Returns |
| --- | --- |
| `currentCycle(uint256 circleId) → uint64` | `(now − genesis) ÷ cycleLength`. |
| `cycleClose(uint256 circleId, uint64 cycle) → uint256` | `genesis + (cycle + 1) × cycleLength`. |
| `finalAt(uint256 circleId, uint64 cycle) → uint256` | `cycleClose + settleWindow + cycleLength`. |
| `creditLimit(uint256 circleId, address member) → uint256` | What the member's line can still pay (`available(lineId)`), or 0. |
| `lineHeadroom(uint256 circleId, address member) → uint256` | `creditLimit − outstanding`, floored at 0. |
| `nettingEfficiencyBps(uint256 circleId, uint64 cycle) → uint256` | `(gross − totalOwed) × 10000 ÷ gross`. |
| `members_(uint256 circleId) → address[]` | Everyone who ever joined (check `members(c, m).active`). |
| `circles(id)`, `members(circleId, member)`, `invites(circleId, member)`, `invoices(id)` | Struct getters. |
| `net(circleId, cycle, member) → int256` | Positive receives, negative owes. |
| `gross`, `totalOwed`, `collected` `(circleId, cycle) → uint256` | Cycle totals. |
| `settled(circleId, cycle, member) → bool` | Debtor paid, or creditor claimed in full. |
| `claimed(circleId, cycle, creditor) → uint256` | What a creditor has received so far. |
| `finalized(circleId, cycle) → bool` | Set on the first pro-rata claim. |
| `outstanding(vault, lineId) → uint256` | Unsettled obligations on a line across all cycles. |
| `lineBound(vault, lineId) → bool` | Whether the line currently backs a membership. |
| `musd()`, `factory()`, `nextCircleId()`, `nextInvoiceId()` | Addresses and counters. |

## Events

| Event | Emitted when |
| --- | --- |
| `CircleCreated(uint256 indexed circleId, address admin, uint64 cycleLength, uint64 settleWindow)` | A circle is created. |
| `MemberInvited(uint256 indexed circleId, address indexed member, address vault, uint256 lineId)` | The admin invites a member. |
| `MemberJoined(uint256 indexed circleId, address indexed member, address vault, uint256 lineId)` | A member accepts. |
| `MemberRemoved(uint256 indexed circleId, address indexed member)` | A member leaves or is removed. |
| `InvoiceCreated(uint256 indexed id, uint256 indexed circleId, address creditor, address debtor, uint256 amount, uint64 cycle, bytes32 ref)` | An invoice is created. |
| `InvoiceAccepted(uint256 indexed id, uint256 indexed circleId, uint64 cycle)` | The debtor accepts. |
| `InvoiceRejected(uint256 indexed id)` | Either side rejects. |
| `Settled(uint256 indexed circleId, uint64 indexed cycle, address indexed debtor, uint256 amount, bool forced)` | A debtor settles or is force-settled. |
| `Claimed(uint256 indexed circleId, uint64 indexed cycle, address indexed creditor, uint256 amount)` | A creditor claims. |
| `CycleFinalized(uint256 indexed circleId, uint64 indexed cycle, uint256 collected, uint256 totalOwed)` | The first pro-rata claim on a cycle. |

## Errors

`NotMember`, `NotAdmin`, `BadParams`, `WrongCycle`, `OverLimit(uint256 limit, uint256 wouldOwe)`, `NotYet`, `Done`, `NotInvited`, `LineInUse`, `HasObligations`, `LineExpiresTooSoon(uint256 expiry, uint256 needed)`, `NotParVault`. See [Errors](/docs/reference/errors).

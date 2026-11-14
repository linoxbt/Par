Par Circuit clears trade credit inside a closed group of businesses, called a **circle**. Members log invoices to each other during a cycle. At the end of the cycle only **net** positions move money: net debtors pay, net creditors receive. A net debtor who does not pay is **force-settled** from the clearing line in their vault, so creditors are paid anyway.

## Why netting

Businesses that sell to each other on credit owe each other in circles. If A owes B, B owes C and C owes A, most of that money never needs to move. In the demo circle, **2,900 MUSD** of invoices settle with **100 MUSD** actually moving (96.55% netted).

`ParCircuit` is the central counterparty. Every accepted invoice moves the creditor's net up and the debtor's net down by the same amount, so netting is maintained as invoices arrive, with no off-chain solver.

## Building blocks

| Piece | What it is |
| --- | --- |
| Circle | A group with an admin, a `cycleLength` and a `settleWindow`. Cycles are numbered from the circle's creation time. |
| Clearing line | A commitment created with `createClearingLine(circuit, cap, expiry)` in a Par vault. Only ParCircuit can draw it. |
| Member | An address, its Par vault, and the id of a clearing line in that vault. One line backs at most one membership. |
| Invoice | Creditor, debtor, amount, cycle and a reference hash. Pending until the debtor accepts or either side rejects. |
| Net | Per member, per cycle: positive means the member receives, negative means it owes. |
| Outstanding | Per line: everything the member still owes across all cycles. Never more than what the line can pay. |

## Membership is by consent

Joining takes two signatures. The circle admin **invites** a member with a specific vault and line (`addMember`), and the member **accepts** with `join`. Nobody can be added to a circle, or have their line pledged, without signing themselves. The vault must be a Par vault created by the factory, owned by the member, and the line must be live until at least the end of the current cycle's settle window.

A member can leave, or the admin can remove them, once they owe nothing and have a zero net in the current and previous cycle.

The admin can also **suspend** a member (for example, a defaulter) with `setSuspended(circleId, member, true)`. A suspended member can't create or accept invoices, and nobody can bill them (`Suspended`), but they can still settle, be force-settled and claim what they are owed. `suspended(circleId, member)` reads the flag; `MemberSuspended` is emitted on every change.

## The cycle

:::flow
Invoice | Creditors bill members
Accept | Debtors accept; nets update
Close | Cycle ends at genesis + (n+1) × length
Settle | Net debtors pay within the window
Force-settle | Late debtors are drawn from their line
Claim | Net creditors withdraw
:::

- An invoice belongs to the cycle in which it was created, and must be accepted in that same cycle. A stale invoice must be re-issued.
- When a debtor accepts and ends up a net debtor, everything they owe across all cycles must fit what their line can still pay. Otherwise the acceptance reverts with `OverLimit(limit, wouldOwe)`. The line must also stay live until this cycle's settle deadline.
- After the cycle closes, net debtors call `settle`. After the settle window, anyone can call `forceSettle` for a debtor who has not paid.
- Net creditors call `claim` once everything owed for that cycle has been collected.

## If a debtor cannot be collected

A cycle becomes **final** one full cycle after its settle window ends:

```text
finalAt = cycleClose + settleWindow + cycleLength
```

If some debt is still uncollected by then (for example, a debtor's trove was liquidated), creditors can claim **pro rata**: `credit × collected ÷ totalOwed`. Debt settled later still counts, and creditors can claim the difference, so the order of claims never matters.

## Timing

| | Production | Demo circle |
| --- | --- | --- |
| Cycle length | e.g. 7 days | 600 s (10 minutes) |
| Settle window | e.g. 1 day | 60 s |

The settle window can never exceed the cycle length.

## Why it is safe for creditors

Every obligation the circuit records fits inside a clearing line that already passed the vault's [stress test](/docs/learn/risk#the-stress-test), and a line can only back one membership, so it is never promised twice. New debt is only booked on a line while it is live, but debt booked before expiry stays drawable after it: an expired line can't be closed while the circuit is still owed on it (`LineOwed`). If a debtor disappears, the keeper force-settles them after the window and their vault pays through the normal payout waterfall.

See [Join a circle and post invoices](/docs/guides/join-circle) and [Settle a cycle](/docs/guides/settle-cycle) for the step-by-step flows.

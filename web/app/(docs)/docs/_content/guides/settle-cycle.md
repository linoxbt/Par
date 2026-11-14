After a cycle closes, money moves once per member: net debtors pay, net creditors claim. Times below use the demo circle (600 s cycle, 60 s settle window).

:::flow
Cycle closes | genesis + (n+1) × cycleLength
Settle window | Net debtors call settle (60 s in the demo)
Force-settle | Anyone, for debtors who did not pay
Claim | Net creditors withdraw
:::

## As a net debtor: settle

:::steps
@step Wait for the cycle to close
`cycleClose(circleId, cycle)` returns the close time. Settling earlier reverts with `NotYet()`.
@step Approve MUSD
Approve ParCircuit for the amount you owe (your negative net for the cycle).
@step Settle
Press settle in **Your position** on the circle page, which calls `settle(circleId, cycle)`. The circuit pulls exactly what you owe and emits `Settled(circleId, cycle, debtor, amount, false)`.
:::

Settle within the settle window to avoid a forced draw on your clearing line. A forced draw is paid by your vault like any other payout: from the MUSD buffer first, then minted from the trove.

## Force-settle

After `cycleClose + settleWindow`, **anyone** can call `forceSettle(circleId, cycle, debtor, up, lo)` for a net debtor who has not paid. The circuit draws the debtor's clearing line for exactly the amount owed and emits `Settled(..., true)`. The Par keeper does this automatically every 15 seconds, and anyone can do it from the members list on the circle page once the window is over.

| Rule | Error |
| --- | --- |
| Only after the cycle closes plus the settle window. | `NotYet()` |
| The address must be a net debtor for that cycle that has not settled. | `Done()` |

## As a net creditor: claim

Press **Claim** in **Your position** on the circle page, which calls `claim(circleId, cycle)`.

- **Everyone paid:** once `collected` equals `totalOwed` for the cycle, you receive your full net credit.
- **Someone could not be collected:** after the cycle is final (`finalAt = cycleClose + settleWindow + cycleLength`), you can claim pro rata: `credit × collected ÷ totalOwed`. The first such claim emits `CycleFinalized`. If more is collected later, call `claim` again to receive the difference.

`claimed(circleId, cycle, creditor)` shows how much you have received so far. Claiming again before anything new was collected reverts with `NotYet()`; claiming after you were paid in full reverts with `Done()`.

## Reading a cycle

| View | Returns |
| --- | --- |
| `currentCycle(circleId)` | The cycle number now. |
| `net(circleId, cycle, member)` | Positive: receives. Negative: owes. |
| `gross(circleId, cycle)` | Total accepted invoice volume. |
| `totalOwed(circleId, cycle)` | Sum of negative nets: what actually has to move. |
| `collected(circleId, cycle)` | What has been paid in so far. |
| `nettingEfficiencyBps(circleId, cycle)` | Share of gross volume that never needed money, in basis points. |

In the demo circle, 2,900 MUSD of gross invoices net to 100 MUSD owed: an efficiency of 9,655 bps (96.55%).

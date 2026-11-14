To trade in a circle you need a Par vault with a clearing line, an invite from the circle's admin, and your own `join` transaction.

:::steps
@step Pledge a clearing line
In your vault, open **Manage → Circuit line** and choose a cap and an expiry. This calls `createClearingLine(circuit, cap, expiry)` with the ParCircuit address as beneficiary. The line must pass the same [stress test](/docs/learn/risk#the-stress-test) as any guarantee. Note the line's commitment id.
@step Send the admin your details
Send the circle admin your address, your vault address and the line id.
@step The admin invites you
The admin opens the circle page and uses **Invite a member** (your address, your vault and the line number). This calls `addMember(circleId, member, vault, lineId)`, which only creates an invite (`MemberInvited`); nothing is pledged yet.
@step Accept the invite
Open the circle page with the invited wallet. A **You're invited** card shows the vault and line; press **Join circle**. This calls `join(circleId, vault, lineId)` with exactly the vault and line from the invite. You are now a member (`MemberJoined`).
:::

## What `join` checks

| Check | Error |
| --- | --- |
| There is an open invite for you with this vault and line. | `NotInvited()` |
| The vault was created by ParFactory. | `NotParVault()` |
| You own the vault, and the line is an active ClearingLine pointed at ParCircuit. | `BadParams()` |
| The line does not already back another membership, in any circle. | `LineInUse()` |
| The line lives until at least the current cycle's close plus the settle window. | `LineExpiresTooSoon(expiry, needed)` |

:::tip Give the line a long expiry
Every time you accept an invoice as a net debtor, the line must still be live until that cycle's settle deadline. A line that expires next week stops you from trading next week. Pick an expiry that covers the period you plan to trade, and remember that the expiry of a commitment cannot be extended.
:::

## Post an invoice

Open the circle's **Invoices** page and **Bill a member**: choose the debtor, the amount in MUSD and a reference. This calls `createInvoice(circleId, debtor, amount, ref)`. The reference is stored as a hash; keep the original document.

## Accept or reject

Invoices billed to you appear under **Billed to you**.

- **Accept** (`acceptInvoice(id)`): your net for the cycle goes down by the amount and the creditor's goes up. If you end up a net debtor, everything you owe across all cycles must fit what your line can still pay, otherwise it reverts with `OverLimit(limit, wouldOwe)`.
- **Reject** (`rejectInvoice(id)`): either side can reject a pending invoice.

An invoice must be accepted in the cycle it was created in. After the cycle closes, accepting reverts with `WrongCycle()` and the creditor must issue a new invoice.

:::note Your headroom
`lineHeadroom(circleId, member)` returns what your line can still pay minus everything you already owe. It is the most you can still accept as a net debtor.
:::

## Leave a circle

You can leave (or the admin can remove you from the members list on the circle page) with `removeMember(circleId, member)` once you owe nothing (`outstanding` is zero) and your net is zero in the current and previous cycle. Otherwise it reverts with `HasObligations()`. Leaving frees the line for another circle, or for closing.

To move to a different line, the admin sends a new invite with the new line and you `join` again; the same no-exposure rule applies.

## Start your own circle

Anyone can call `createCircle(cycleLength, settleWindow)` and becomes its admin. The settle window must not exceed the cycle length. The demo circle uses a 600 s cycle and a 60 s settle window.

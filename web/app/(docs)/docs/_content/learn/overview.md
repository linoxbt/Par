Par turns **undrawn Bitcoin credit into a promise you can hand to anyone**. You lock BTC in your own vault on Mezo. The vault opens a MUSD trove, which gives it a fixed borrowing capacity at a locked rate. You then reserve part of that unused capacity against **commitments**: rent guarantees, supplier terms, performance bonds, or a credit line pledged to a trade network.

Nothing is borrowed and no interest is paid on a commitment until it is called. When a promise breaks, the vault pays the person who is owed: first from its MUSD buffer, then by minting new MUSD from the trove.

:::warning Testnet, unaudited
Par runs on Mezo testnet with testnet BTC. The contracts have not been audited. Do not use funds you cannot afford to lose on any network.
:::

## Two products, one vault

:::cards 2
@card title="Par Guarantees" href="/docs/learn/guarantees" icon="file"
Installment guarantees that pay automatically when a payment is missed, and bonds that pay after an uncontested claim.
@card title="Par Circuit" href="/docs/learn/circuit" icon="circuit"
Businesses that sell to each other log invoices. Only net debts settle at the end of each cycle, and a defaulter is paid for by their vault.
:::

Both products draw on the same vault. A vault can back many commitments at once, as long as all of them together pass the [stress test](/docs/learn/risk#the-stress-test).

## Who it is for

- **Tenants and the people who sponsor them.** Rent paid one to two years upfront is idle money. A Par guarantee lets a landlord accept monthly rent with the risk covered.
- **Freelancers, P2P merchants and OTC desks** who need to show a counterparty that they are good for a payment.
- **Small businesses that trade on credit** with each other. Circuit replaces chains of IOUs with one netted settlement per cycle.

## Why MUSD makes this work

Par relies on three properties of Mezo's MUSD:

1. **Capacity is fixed at open.** A trove's maximum borrowing capacity (collateral × price ÷ 1.1) and its interest rate are snapshotted when it opens. Undrawn capacity is a rate-locked promise that nobody else can borrow away.
2. **Interest is paid only on drawn debt.** A commitment costs nothing until it is called.
3. **MUSD is minted, not borrowed from a pool.** A payout depends only on your own Bitcoin and your own trove.

## What happens, in one picture

:::flow
Lock BTC | Your vault opens a MUSD trove
Reserve capacity | Commitments reserve undrawn MUSD
Share the certificate | The beneficiary sees live cover
Promise breaks | Buffer pays first, then MUSD is minted
:::

## Where to go next

:::cards 3
@card title="Quickstart" href="/docs/learn/quickstart" icon="rocket"
Make your first guarantee.
@card title="How it works" href="/docs/learn/how-it-works" icon="layers"
The full model, step by step.
@card title="Contracts" href="/docs/reference/par-vault" icon="code"
Functions, events and errors.
:::

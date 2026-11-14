## Product

:::details Isn't this just credit delegation on a lending pool?
No. On a lending pool the rate floats and the pool can be fully borrowed by other people right when a claim arrives, so a promise can fail for reasons that have nothing to do with you. MUSD is minted, not borrowed from a pool, and a Mezo trove locks its rate across its whole capacity at open. A Par promise only depends on your own Bitcoin and your own trove, and the vault checks that it survives a 40% Bitcoin drop before you can make it.
:::

:::details What does a guarantee cost?
Nothing until it is called. Opening a vault costs the 0.1% fee on the 1,800 MUSD buffer plus interest on that buffer. A payout that has to be minted adds the 0.1% fee and interest on the new debt.
:::

:::details Why does a vault borrow 1,800 MUSD at the start?
That is MUSD's minimum loan. Par keeps it in the vault as a buffer that pays the first claims without new debt. You can withdraw it, in which case later payouts are minted instead.
:::

:::details Why would a landlord accept MUSD?
Today the first users are crypto-native counterparties: P2P merchants, OTC desks and freelance clients. MUSD bridges to other chains, so an automatic off-ramp is a natural next step.
:::

:::details Can I cancel a guarantee?
No. A guarantee is irrevocable for the owner. The beneficiary can release it early, and after expiry anyone can close it.
:::

## Safety

:::details What happens if Bitcoin crashes?
Every commitment must pass the stress test when it is created: if Bitcoin fell 40% and every promise were called at once, the vault must still be above 160%. If the price later falls past that, the vault cannot make new promises and the owner is warned to add collateral. If it falls far enough for liquidation, the guarantee can fail. Every certificate shows how far Bitcoin can fall before the vault reaches 150%. See [Risk and safety](/docs/learn/risk).
:::

:::details What about Recovery Mode?
In Recovery Mode, MUSD only allows new debt together with a collateral top-up. The claim stays valid, the vault computes exactly how much BTC it needs, pays from its idle reserve, and if the reserve is short the keeper alerts the owner and retries.
:::

:::details Who decides disputed claims?
For installments, nobody: the contract can see whether the payment arrived. For bonds there is a challenge window, and only disputed claims go to an arbiter that both sides agreed on when the bond was created. The arbiter cannot be the owner, the beneficiary or the principal, and has 7 days to decide; after that the claim pays by default.
:::

:::details What if the keeper is down?
Every keeper action is permissionless. Beneficiaries, creditors or anyone else can trigger the same calls from the app or a block explorer, and anyone can run their own keeper.
:::

:::details Are the contracts audited?
No. Par runs on Mezo testnet only. See [Security](/security).
:::

## Circuit

:::details Can a circle admin pledge my vault without my consent?
No. The admin can only invite. Membership starts when you call `join` yourself with your own vault and line.
:::

:::details What if a debtor's vault cannot pay?
After the cycle is final (one full cycle after the settle window ends), creditors claim pro rata from what was collected. Anything collected later is paid out to them too.
:::

:::details Can one clearing line back several circles?
No. A line backs at most one membership at a time, so it is never promised twice.
:::

## Developers

:::details Where are the contract addresses?
On [Deployed addresses](/docs/reference/addresses), generated from `contracts/deployments/matsnet.json` into `web/lib/deployments.ts`.
:::

:::details Is there an API?
The contracts are the API. Read them with any EVM library; the ABIs are in `web/lib/abi.ts`. Every page of these docs can also be copied as Markdown with **Copy page**.
:::

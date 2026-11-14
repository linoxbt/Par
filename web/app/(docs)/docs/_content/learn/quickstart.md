This walks you from a wallet to a live guarantee with a shareable certificate. It takes a few minutes on Mezo testnet.

:::info Before you start
You need testnet BTC on Mezo testnet (chain {{chainId}}). BTC is also the gas token on Mezo, so keep a little aside for transactions. About 0.1 BTC is enough to open a vault and back a few hundred to a couple of thousand MUSD of promises, depending on the BTC price.
:::

:::steps
@step Connect a wallet
Open the app and press **Connect**. Choose an Ethereum wallet (through Reown) or a Bitcoin wallet such as Xverse, Unisat or OKX (through Mezo Passport). See [Connect a wallet](/docs/guides/connect-wallet).
@step Create your vault
On [Vault](/vault), press **Create your vault**. This deploys your own vault contract, a small clone that only you control.
@step Open the trove
Enter all the BTC you intend to pledge and confirm. The trove's capacity and rate are fixed at this moment, so adding BTC later adds safety, not capacity. The vault draws the 1,800 MUSD minimum loan and keeps it as a buffer. See [Open a vault](/docs/guides/open-vault).
@step Make a guarantee
Press **New guarantee**. For a quick test, choose **Rent / installments**, a small installment, and the **Demo · 2 min** schedule. The builder runs the stress test live and refuses anything the vault cannot back. See [Make a guarantee](/docs/guides/make-guarantee).
@step Share the certificate
Copy the certificate link (`/c/<vault>/<id>`) and send it to the person it protects. Send the pay link (`/pay/<vault>/<id>`) to whoever pays the installments.
@step Watch it work
Pay the first installment from the pay link, then let the second one lapse. After the grace period the keeper triggers the missed payment and the payout appears on the certificate with an explorer link.
:::

## What you just did

- Your BTC is locked in a trove you control. Nothing beyond the 1,800 MUSD buffer was borrowed.
- The guarantee reserved part of the trove's undrawn capacity. It costs nothing until it is called.
- The missed installment was paid from the buffer. Once the buffer runs out, payouts are minted from the trove. See [How it works](/docs/learn/how-it-works#payout-waterfall).

:::tip To see a mint on camera
With 0.1 BTC, the 1,800 MUSD buffer pays the first claims without new debt. To show MUSD being minted, withdraw most of the buffer first (**Vault → Manage → Buffer**), so the next missed payment has to be minted.
:::

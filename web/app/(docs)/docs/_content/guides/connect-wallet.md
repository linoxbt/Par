Press **Connect** in the app and choose how you want to sign. Par supports Ethereum (EVM) wallets through Reown, and Bitcoin wallets through Mezo Passport.

| Option | Wallets | How it works |
| --- | --- | --- |
| Ethereum wallet (Reown) | MetaMask, Rabby, OKX, Trust and any WalletConnect wallet by QR | Your EVM address signs Mezo transactions directly and owns your vault. |
| Bitcoin wallet (Mezo Passport) | Xverse, Unisat, OKX | Your Bitcoin wallet signs. Passport routes each transaction through a Mezo smart account, which owns your vault. |

:::tabs
@tab Ethereum wallet
:::steps
@step Press Connect, then Ethereum wallet
The Reown dialog opens.
@step Pick your wallet
On desktop, choose a browser extension. On a phone, choose a wallet app or scan the QR code with any WalletConnect wallet.
@step Switch to Mezo testnet
Approve adding or switching to Mezo testnet (chain {{chainId}}) if your wallet asks.
:::
@tab Bitcoin wallet
:::steps
@step Press Connect, then Bitcoin wallet
Choose Xverse, Unisat or OKX.
@step Approve the connection
Your Bitcoin wallet asks you to sign in. Mezo Passport derives a Mezo smart account from your Bitcoin address.
@step Sign transactions as usual
Each Par transaction is signed by your Bitcoin wallet and executed by the smart account.
:::
:::

## On a phone

Bitcoin wallets connect from inside their own app browser; there is no mobile deep link. On a phone:

1. Open your wallet app (Xverse, OKX or Unisat) and find its built-in browser.
2. Open the Par site there (in Unisat, paste the link into the browser's address bar).
3. Tap **Connect** again and choose the Bitcoin wallet.

The app offers a shortcut that reopens the current page inside Xverse or OKX. EVM wallets on a phone work through WalletConnect without this step.

:::warning Keep using the same wallet
A vault belongs to the address that created it. If you connect with a different wallet (or switch between your EVM address and your Bitcoin wallet), you will see a different, empty vault.
:::

## Troubleshooting

:::details The app shows the wrong network
Switch your wallet to Mezo testnet (chain {{chainId}}, RPC `{{rpc}}`). The app asks to switch when a transaction is sent from the wrong chain.
:::
:::details My Bitcoin wallet does not appear on a phone
Open the site inside the wallet's own browser, as described above. Mobile browsers like Safari or Chrome cannot reach Bitcoin wallet extensions.
:::
:::details Transactions fail with an out-of-gas or insufficient-funds error
Gas on Mezo is paid in BTC. Keep a small amount of BTC outside the trove for transactions.
:::

Par is three Solidity contracts, a keeper and this Next.js app. Everything runs locally against a model of the MUSD rules Par relies on.

## Repository layout

| Folder | What it holds |
| --- | --- |
| `contracts/` | `ParFactory`, `ParVault`, `ParCircuit`, a MUSD model for tests (`contracts/mocks`), Hardhat tests and deploy scripts. |
| `keeper/` | The [keeper](/docs/reference/keeper) bot (TypeScript, viem). |
| `web/` | This app (Next.js 14, wagmi, Reown AppKit, Mezo Passport). |
| `scripts/` | `dev-local.sh`, the one-command local demo. |

## Run the tests

```bash
git clone https://github.com/linoxbt/par && cd par/contracts
npm install
npm test
```

The suite runs against the MUSD model. To run it against the real MUSD contracts, which the script clones and deploys on its fixtures:

```bash
npm run test:musd
```

## One-command local demo

```bash
./scripts/dev-local.sh
```

This starts a Hardhat node, deploys the MUSD model and Par, seeds the Circuit demo (three shops, a 600 s cycle with a 60 s settle window) and a guarantee, then starts the keeper and the app. Open `http://localhost:3000`, connect a wallet to `http://127.0.0.1:8545` (chain 31337) and import a Hardhat test key: account #0 owns the guarantee demo vault, accounts #1 to #3 are the Circuit shops.

:::tip Time travel
On the local chain you can skip ahead to a due date or a cycle close:

```bash
curl -s -X POST localhost:8545 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"evm_increaseTime","params":[300]}'
```
:::

## Deploy to Mezo testnet

```bash
cd contracts
MATSNET_PRIVATE_KEY=<deployer key> npm run deploy:matsnet
```

The script deploys ParFactory (with `stressBps = 4000` and `targetIcr = 1.6e18`) and ParCircuit, writes `contracts/deployments/matsnet.json`, and prints the frontend and keeper environment. `npm run abis` then regenerates `web/lib/deployments.ts`, which these docs read their [addresses](/docs/reference/addresses) from.

## Regenerate ABIs

```bash
cd contracts && npm run abis
```

This compiles and writes `web/lib/abi.ts`, `keeper/src/abi.ts` and `web/lib/deployments.ts`.

## Run the app

```bash
cd web
npm install --legacy-peer-deps
NEXT_PUBLIC_CHAIN=testnet \
NEXT_PUBLIC_FACTORY=<factory> \
NEXT_PUBLIC_CIRCUIT=<circuit> \
NEXT_PUBLIC_FACTORY_BLOCK=<block> \
NEXT_PUBLIC_REOWN_PROJECT_ID=<project id> \
npm run dev
```

The Reown project id is public (create one at cloud.reown.com). The marketing, docs and legal pages are server-rendered and load no wallet code.

## Seed the testnet demo

`contracts/scripts/seed-demo.ts` creates three shop vaults with clearing lines, a circle with a 600 s cycle and 60 s settle window, and a tangled invoice graph (2,900 MUSD gross, 100 MUSD net). It needs an admin key and three shop keys; see the header of the script for the variables.

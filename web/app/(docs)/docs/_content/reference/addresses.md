Par runs on **Mezo testnet**. Addresses on this page come from `web/lib/deployments.ts`, which is generated from `contracts/deployments/{{network}}.json` on every deploy, so they always match the latest deployment.

## Network

| Parameter | Value |
| --- | --- |
| Network | Mezo testnet |
| Chain ID | `{{chainId}}` |
| Currency (gas) | BTC (18 decimals) |
| RPC URL | `{{rpc}}` |
| Explorer | [explorer.test.mezo.org]({{explorer}}) |

## Par contracts

| Contract | Address |
| --- | --- |
| ParFactory | [`{{ParFactory}}`]({{explorer}}/address/{{ParFactory}}) |
| ParVault implementation | [`{{ParVaultImplementation}}`]({{explorer}}/address/{{ParVaultImplementation}}) |
| ParCircuit | [`{{ParCircuit}}`]({{explorer}}/address/{{ParCircuit}}) |

The factory was deployed at block `{{factoryBlock}}`. Indexers and the app scan events from this block. Each user's vault is its own clone; find it with `vaultsOf(owner, i)` on the factory.

:::note Never send funds to the implementation
The ParVault implementation is locked and only exists to be cloned. Your vault is a separate address, shown in the app.
:::

## MUSD contracts

Par integrates with the official MUSD deployment (`@mezo-org/musd-contracts` 1.1.0).

| Contract | Address |
| --- | --- |
| BorrowerOperations | [`{{musd.BorrowerOperations}}`]({{explorer}}/address/{{musd.BorrowerOperations}}) |
| TroveManager | [`{{musd.TroveManager}}`]({{explorer}}/address/{{musd.TroveManager}}) |
| PriceFeed | [`{{musd.PriceFeed}}`]({{explorer}}/address/{{musd.PriceFeed}}) |
| MUSD token | [`{{musd.MUSD}}`]({{explorer}}/address/{{musd.MUSD}}) |
| HintHelpers | [`{{musd.HintHelpers}}`]({{explorer}}/address/{{musd.HintHelpers}}) |
| SortedTroves | [`{{musd.SortedTroves}}`]({{explorer}}/address/{{musd.SortedTroves}}) |
| InterestRateManager | [`{{musd.InterestRateManager}}`]({{explorer}}/address/{{musd.InterestRateManager}}) |

## Frontend and keeper environment

The deploy script prints these after `deploy-par.ts`:

```bash
NEXT_PUBLIC_CHAIN=testnet
NEXT_PUBLIC_FACTORY={{ParFactory}}
NEXT_PUBLIC_CIRCUIT={{ParCircuit}}
NEXT_PUBLIC_FACTORY_BLOCK={{factoryBlock}}
```

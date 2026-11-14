`ParFactory` deploys one `ParVault` clone (EIP-1167) per call and stores the risk parameters every vault is initialised with. It also keeps a registry of vaults, which ParCircuit uses to accept only genuine Par vaults.

Source: [`contracts/contracts/ParFactory.sol`](https://github.com/linoxbt/par/blob/main/contracts/contracts/ParFactory.sol) · Address: [`{{ParFactory}}`]({{explorer}}/address/{{ParFactory}})

## Functions

| Function | Access | Description |
| --- | --- | --- |
| `createVault() → address vault` | Anyone | Clones the implementation, initialises it with the caller as owner and the factory's parameters, registers it, and emits `VaultCreated`. |
| `onVaultOwnerChanged(address from, address to)` | Vaults only | Called by a vault when a two-step ownership transfer completes. Moves the vault from `vaultsOf[from]` to `vaultsOf[to]`. Reverts `NotVault()` for any other caller. |
| `vaultCount(address owner) → uint256` | View | Number of vaults owned by `owner`. |
| `allVaultsLength() → uint256` | View | Number of vaults ever created. |

## State

| Name | Type | Description |
| --- | --- | --- |
| `implementation` | `address` (immutable) | The `ParVault` implementation every clone points to. Locked at deploy so it can never be initialised. |
| `borrowerOps` | `IBorrowerOperations` (immutable) | MUSD BorrowerOperations. |
| `troveManager` | `ITroveManager` (immutable) | MUSD TroveManager. |
| `priceFeed` | `IPriceFeed` (immutable) | MUSD PriceFeed. |
| `musd` | `IERC20` (immutable) | The MUSD token. |
| `stressBps` | `uint256` (immutable) | Stress drop in basis points: `4000` (40%). |
| `targetIcr` | `uint256` (immutable) | Ratio required under stress: `1.6e18` (160%). |
| `vaultsOf(address, uint256)` | `address` | The vaults owned by an address, by index. |
| `allVaults(uint256)` | `address` | Every vault ever created, by index. |
| `isVault(address)` | `bool` | True for vaults created by this factory. |

## Events

| Event | Emitted when |
| --- | --- |
| `VaultCreated(address indexed owner, address vault)` | A vault is created. |
| `VaultOwnerChanged(address indexed vault, address indexed from, address indexed to)` | A vault's ownership transfer completes. |

## Errors

| Error | Meaning |
| --- | --- |
| `NotVault()` | `onVaultOwnerChanged` was called by an address that is not a vault from this factory. |

## Example: find a user's vault

```ts
import { createPublicClient, http } from "viem"
import { mezoTestnet } from "viem/chains"
import { parFactoryAbi } from "./abi" // generated: web/lib/abi.ts

const client = createPublicClient({ chain: mezoTestnet, transport: http() })
const factory = "{{ParFactory}}"

const count = await client.readContract({ address: factory, abi: parFactoryAbi, functionName: "vaultCount", args: [user] })
const vault = count > 0n
  ? await client.readContract({ address: factory, abi: parFactoryAbi, functionName: "vaultsOf", args: [user, count - 1n] })
  : undefined
```

ABIs are exported to `web/lib/abi.ts` and `keeper/src/abi.ts` by `npm run abis` in `contracts/`.

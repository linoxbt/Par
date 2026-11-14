import { defineChain, type Address, type Chain } from "viem"
import { mezoTestnet } from "viem/chains"

export type Network = "testnet" | "mainnet" | "local"
export const NETWORK = (process.env.NEXT_PUBLIC_CHAIN ?? "testnet") as Network

const ZERO = "0x0000000000000000000000000000000000000000" as Address
const addr = (v: string | undefined) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : ZERO)

export const FACTORY = addr(process.env.NEXT_PUBLIC_FACTORY)
export const CIRCUIT = addr(process.env.NEXT_PUBLIC_CIRCUIT)
export const FACTORY_BLOCK = BigInt(process.env.NEXT_PUBLIC_FACTORY_BLOCK || "0")
export const WC_PROJECT_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "par-dev"
export const CONFIGURED = FACTORY !== ZERO

export const mezoMainnet = defineChain({
  id: 31612,
  name: "Mezo",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-http.mezo.boar.network"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.mezo.org" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
})

export const localChain = defineChain({
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
})

export const chain: Chain = NETWORK === "mainnet" ? mezoMainnet : NETWORK === "local" ? localChain : mezoTestnet
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || chain.rpcUrls.default.http[0]
export const EXPLORER = chain.blockExplorers?.default.url ?? ""
export const HAS_MULTICALL = Boolean(chain.contracts?.multicall3)

const IRM: Record<Network, Address | undefined> = {
  testnet: "0xD4D6c36A592A2c5e86035A6bca1d57747a567f37",
  mainnet: "0x4a453700d157717Fe02fB62E7700ED7845048285",
  local: undefined, // MockMUSDSystem serves interestRate() at the BorrowerOperations address
}
export const INTEREST_RATE_MANAGER = process.env.NEXT_PUBLIC_INTEREST_RATE_MANAGER
  ? addr(process.env.NEXT_PUBLIC_INTEREST_RATE_MANAGER)
  : IRM[NETWORK]

export const txUrl = (h: string) => (EXPLORER ? `${EXPLORER}/tx/${h}` : "#")
export const addrUrl = (a: string) => (EXPLORER ? `${EXPLORER}/address/${a}` : "#")

/** MUSD protocol constants (spec section 3.3) */
export const MCR = 1_100_000_000_000_000_000n
export const CCR = 1_500_000_000_000_000_000n
export const GAS_COMP = 200n * 10n ** 18n

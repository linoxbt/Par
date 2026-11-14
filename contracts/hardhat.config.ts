import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "dotenv/config"

const MATSNET_PRIVATE_KEY = process.env.MATSNET_PRIVATE_KEY
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY
// Extra funded keys for scripts/seed-demo.ts (three Circuit shops), comma-separated.
const DEMO_KEYS = (process.env.MATSNET_DEMO_KEYS || "").split(",").filter(Boolean)

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "london", // Mezo: no PUSH0
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: { hardfork: "london", initialBaseFeePerGas: 0 },
    matsnet: {
      url: process.env.MATSNET_RPC_URL || "https://rpc.test.mezo.org",
      chainId: 31611,
      accounts: MATSNET_PRIVATE_KEY ? [MATSNET_PRIVATE_KEY, ...DEMO_KEYS] : [],
    },
    mezo: {
      url: process.env.MAINNET_RPC_URL || "https://rpc-http.mezo.boar.network",
      chainId: 31612,
      accounts: MAINNET_PRIVATE_KEY ? [MAINNET_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: { matsnet: "empty", mezo: "empty" },
    customChains: [
      {
        network: "matsnet",
        chainId: 31611,
        urls: {
          apiURL: "https://api.explorer.test.mezo.org/api",
          browserURL: "https://explorer.test.mezo.org",
        },
      },
      {
        network: "mezo",
        chainId: 31612,
        urls: {
          apiURL: "https://api.explorer.mezo.org/api",
          browserURL: "https://explorer.mezo.org",
        },
      },
    ],
  },
  sourcify: { enabled: false },
}

export default config

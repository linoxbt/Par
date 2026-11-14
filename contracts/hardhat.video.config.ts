// Local chain that mimics Mezo testnet (chain 31611) for recording the demo video. Not used in CI.
import base from "./hardhat.config"
const config = {
  ...base,
  networks: {
    ...base.networks,
    hardhat: { hardfork: "london", initialBaseFeePerGas: 0, chainId: 31611, mining: { auto: true } },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31611 },
  },
}
export default config

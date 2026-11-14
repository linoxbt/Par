// Offline-solc variant of the MUSD repo config (spec Appendix C).
// Copy next to musd/solidity/hardhat.config.ts if the solc download is blocked:
//   npx hardhat --config hardhat.par.config.ts test test/par/Par.test.ts
import path from "path"
import { subtask } from "hardhat/config"
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names"
import config from "./hardhat.config"

// Offline compiler: use solcjs 0.8.24 from node_modules instead of downloading solc.
subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args: any, _hre, runSuper) => {
  if (args.solcVersion === "0.8.24") {
    return {
      compilerPath: path.join(__dirname, "node_modules", "solc", "soljson.js"),
      isSolcJs: true,
      version: args.solcVersion,
      longVersion: "0.8.24+commit.e11b9ed9",
    }
  }
  return runSuper()
})

export default config

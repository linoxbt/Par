// Local dev: deploys the mock MUSD system + Par to a running `npx hardhat node`, so the
// frontend and keeper can be exercised without testnet BTC.
//   npx hardhat node            (terminal 1)
//   npx hardhat run scripts/deploy-local.ts --network localhost
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"
import { STRESS_BPS, TARGET_ICR } from "./addresses"

async function main() {
  const [deployer] = await ethers.getSigners()
  const priceFeed = await (await ethers.getContractFactory("MockPriceFeed")).deploy()
  const system = await (await ethers.getContractFactory("MockMUSDSystem")).deploy(await priceFeed.getAddress())
  const musd = await system.musd()
  const factory = await (await ethers.getContractFactory("ParFactory")).deploy(
    await system.getAddress(),
    await system.getAddress(),
    await priceFeed.getAddress(),
    musd,
    STRESS_BPS,
    TARGET_ICR,
  )
  const circuit = await (await ethers.getContractFactory("ParCircuit")).deploy(await factory.getAddress())
  const factoryBlock = (await factory.deploymentTransaction()!.wait())!.blockNumber

  // background system debt so TCR is realistic
  const amount = ethers.parseEther("100000")
  const total = amount + (await system.getBorrowingFee(amount)) + ethers.parseEther("200")
  await system.connect(deployer).openTrove(amount, ethers.ZeroAddress, ethers.ZeroAddress, {
    value: (3n * total * 10n ** 18n) / (await priceFeed.fetchPrice()),
  })

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    ParFactory: await factory.getAddress(),
    ParVaultImplementation: await factory.implementation(),
    ParCircuit: await circuit.getAddress(),
    factoryBlock,
    musd: {
      BorrowerOperations: await system.getAddress(),
      TroveManager: await system.getAddress(),
      PriceFeed: await priceFeed.getAddress(),
      MUSD: musd,
      InterestRateManager: await system.getAddress(),
    },
  }
  fs.writeFileSync(path.join(__dirname, "..", "deployments", "localhost.json"), JSON.stringify(out, null, 2) + "\n")
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

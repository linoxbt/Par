// Deploy Par to Mezo testnet (matsnet, chain 31611) or mainnet using the official MUSD deployment.
//   MATSNET_PRIVATE_KEY=0x... npx hardhat run scripts/deploy-par.ts --network matsnet
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"
import { MUSD_ADDRESSES, STRESS_BPS, TARGET_ICR } from "./addresses"

async function main() {
  const net = network.name as keyof typeof MUSD_ADDRESSES
  const A = MUSD_ADDRESSES[net]
  if (!A) throw new Error(`No MUSD addresses for network ${network.name}; use --network matsnet|mezo`)

  // Refuse to deploy if the RPC is not the chain this network name claims to be.
  const chainId = Number((await ethers.provider.getNetwork()).chainId)
  if (chainId !== A.chainId) {
    throw new Error(`chainId mismatch: --network ${network.name} expects ${A.chainId}, RPC reports ${chainId}`)
  }

  const [deployer] = await ethers.getSigners()
  console.log("deployer", deployer.address, "chainId", chainId)

  // The vault implementation is deployed in its own transaction so the explorer indexes (and can
  // verify) it; the factory checks that it is locked before cloning it.
  const impl = await (await ethers.getContractFactory("ParVault")).deploy()
  await impl.waitForDeployment()
  console.log("ParVault implementation", await impl.getAddress())
  const Factory = await ethers.getContractFactory("ParFactory")
  const factory = await Factory.deploy(await impl.getAddress(), A.BorrowerOperations, A.TroveManager, A.PriceFeed, A.MUSD, STRESS_BPS, TARGET_ICR)
  await factory.waitForDeployment()
  const factoryBlock = (await factory.deploymentTransaction()!.wait())!.blockNumber
  console.log("ParFactory", await factory.getAddress(), "block", factoryBlock)
  console.log("ParVault implementation", await factory.implementation())

  const Circuit = await ethers.getContractFactory("ParCircuit")
  const circuit = await Circuit.deploy(await factory.getAddress())
  await circuit.waitForDeployment()
  console.log("ParCircuit", await circuit.getAddress())

  const out = {
    network: network.name,
    chainId: A.chainId,
    ParFactory: await factory.getAddress(),
    ParVaultImplementation: await factory.implementation(),
    ParCircuit: await circuit.getAddress(),
    factoryBlock,
    musd: A,
  }
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`)
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n")
  console.log(`\nwrote ${file}\n\nFrontend / keeper env:`)
  console.log(`NEXT_PUBLIC_CHAIN=${network.name === "mezo" ? "mainnet" : "testnet"}`)
  console.log(`NEXT_PUBLIC_FACTORY=${out.ParFactory}`)
  console.log(`NEXT_PUBLIC_CIRCUIT=${out.ParCircuit}`)
  console.log(`NEXT_PUBLIC_FACTORY_BLOCK=${factoryBlock}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

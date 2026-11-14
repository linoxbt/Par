import { ethers, network } from "hardhat"
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers"

export const Z = ethers.ZeroAddress
export const to1e18 = (v: string | number) => ethers.parseEther(String(v))

export type User = { wallet: HardhatEthersSigner; address: string }

export async function fastForwardTime(seconds: number) {
  await network.provider.send("evm_increaseTime", [seconds])
  await network.provider.send("evm_mine")
}

export async function getLatestBlockTimestamp(): Promise<number> {
  const b = await ethers.provider.getBlock("latest")
  return Number(b!.timestamp)
}

/** Deploys the mock MUSD system (BorrowerOperations + TroveManager surface, PriceFeed, MUSD token). */
export async function setupTests() {
  const signers = await ethers.getSigners()
  const u = (i: number): User => ({ wallet: signers[i], address: signers[i].address })
  const [deployer, alice, bob, carol, dennis, eric, whale] = [0, 1, 2, 3, 4, 5, 6].map(u)

  const priceFeed = await (await ethers.getContractFactory("MockPriceFeed")).deploy()
  const system = await (await ethers.getContractFactory("MockMUSDSystem")).deploy(await priceFeed.getAddress())
  const musd = await ethers.getContractAt("MockMUSD", await system.musd())
  const contracts = {
    borrowerOperations: system,
    troveManager: system,
    priceFeed,
    mockAggregator: priceFeed,
    musd,
  }
  return { contracts, deployer, alice, bob, carol, dennis, eric, whale }
}

export type Contracts = Awaited<ReturnType<typeof setupTests>>["contracts"]

/** Same math as the MUSD repo helper: coll = ICR * (amount + fee + 200 gas comp) / price. */
export async function openTrove(
  contracts: Contracts,
  p: { musdAmount: string; ICR: string; sender: HardhatEthersSigner },
) {
  const amount = to1e18(p.musdAmount)
  const fee = await contracts.borrowerOperations.getBorrowingFee(amount)
  const total = amount + fee + to1e18(200)
  const price = await contracts.priceFeed.fetchPrice()
  const icr = to1e18(p.ICR) / 100n
  const value = (icr * total) / price
  return contracts.borrowerOperations.connect(p.sender).openTrove(amount, Z, Z, { value })
}

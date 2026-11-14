// Creates the guarantee demo (spec section 10) on any network: a vault with 0.1 BTC (local: 1 BTC)
// and a rent guarantee of 12 x 500 MUSD, cover 1,500, period 120 s, grace 10 s.
//   npx hardhat run scripts/seed-guarantee.ts --network localhost
// Env: LANDLORD (beneficiary, default signer #5), TENANT (principal, default signer #6),
//      DEMO_BTC, DEMO_SEED (1800), DEMO_PERIOD (120), DEMO_GRACE (10)
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"

const Z = ethers.ZeroAddress

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"))
  const signers = await ethers.getSigners()
  const owner = signers[0]
  const local = network.name === "localhost" || network.name === "hardhat"
  const landlord = process.env.LANDLORD || signers[5]?.address
  const tenant = process.env.TENANT || signers[6]?.address || owner.address
  const btc = ethers.parseEther(process.env.DEMO_BTC || (local ? "1" : "0.1"))
  const seed = ethers.parseEther(process.env.DEMO_SEED || "1800")
  const period = Number(process.env.DEMO_PERIOD || 120)
  const grace = Number(process.env.DEMO_GRACE || 10)

  const factory = await ethers.getContractAt("ParFactory", dep.ParFactory)
  const rc = await (await factory.connect(owner).createVault()).wait()
  const log = rc!.logs.map((l) => factory.interface.parseLog(l)).find((l) => l?.name === "VaultCreated")!
  const vault = await ethers.getContractAt("ParVault", log.args.vault)
  await (await vault.openTrove(seed, Z, Z, { value: btc })).wait()

  const now = (await ethers.provider.getBlock("latest"))!.timestamp
  const id = await vault.nextId()
  await (
    await vault.createScheduled(landlord, tenant, ethers.parseEther("500"), now + 30, period, grace, 12, ethers.parseEther("1500"), now + 86400 * 30)
  ).wait()
  const [ok, stressedIcr] = await vault.health(0)
  console.log(`vault ${await vault.getAddress()} guarantee #${id} -> landlord ${landlord}`)
  console.log(`health ok=${ok} stressedIcr=${ethers.formatEther(stressedIcr)}`)
  console.log(`certificate: /c/${await vault.getAddress()}/${id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

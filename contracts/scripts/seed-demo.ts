// Pre-creates the Circuit demo (spec section 10): three shops with vaults and clearing lines,
// a circle with a 180 s cycle / 60 s settle window, and a tangled invoice graph
// (2,900 MUSD gross, 100 MUSD net).
//
//   local:   npx hardhat run scripts/seed-demo.ts --network localhost
//   testnet: MATSNET_PRIVATE_KEY=<admin> MATSNET_DEMO_KEYS=<k1>,<k2>,<k3> \
//            npx hardhat run scripts/seed-demo.ts --network matsnet
//
// Env: DEMO_BTC (per vault, default 1 local / 0.1 testnet), DEMO_SEED (default 1800),
//      DEMO_LINE (clearing line cap, default 1500), DEMO_CYCLE (180), DEMO_WINDOW (60)
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"

const Z = ethers.ZeroAddress

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"))
  const signers = await ethers.getSigners()
  if (signers.length < 4) throw new Error("need 4 signers: admin + 3 shops (set MATSNET_DEMO_KEYS)")
  const [admin, importer, wholesaler, repairer] = signers
  const local = network.name === "localhost" || network.name === "hardhat"

  const btc = ethers.parseEther(process.env.DEMO_BTC || (local ? "1" : "0.1"))
  const seed = ethers.parseEther(process.env.DEMO_SEED || "1800")
  const line = ethers.parseEther(process.env.DEMO_LINE || "1500")
  const cycle = Number(process.env.DEMO_CYCLE || 180)
  const window = Number(process.env.DEMO_WINDOW || 60)

  const factory = await ethers.getContractAt("ParFactory", dep.ParFactory)
  const circuit = await ethers.getContractAt("ParCircuit", dep.ParCircuit)
  const expiry = Math.floor(Date.now() / 1000) + 86400 * 30

  const shops = [
    { name: "importer", s: importer },
    { name: "wholesaler", s: wholesaler },
    { name: "repairer", s: repairer },
  ]
  const vaults: string[] = []
  const lineIds: bigint[] = []
  for (const { name, s } of shops) {
    const rc = await (await factory.connect(s).createVault()).wait()
    const log = rc!.logs.map((l) => factory.interface.parseLog(l)).find((l) => l?.name === "VaultCreated")!
    const vault = await ethers.getContractAt("ParVault", log.args.vault)
    await (await vault.connect(s).openTrove(seed, Z, Z, { value: btc })).wait()
    const lineId = await vault.nextId()
    await (await vault.connect(s).createClearingLine(dep.ParCircuit, line, expiry)).wait()
    vaults.push(await vault.getAddress())
    lineIds.push(lineId)
    console.log(`${name}: ${s.address} vault ${await vault.getAddress()} line #${lineId}`)
  }

  const circleId = await circuit.nextCircleId()
  await (await circuit.connect(admin).createCircle(cycle, window)).wait()
  for (let i = 0; i < 3; i++) {
    await (await circuit.connect(admin).addMember(circleId, shops[i].s.address, vaults[i], lineIds[i])).wait()
  }
  console.log(`circle #${circleId} (cycle ${cycle}s, settle window ${window}s)`)

  // wholesaler owes importer 1000, repairer owes wholesaler 1000, importer owes repairer 900
  const graph: [number, number, string][] = [
    [0, 1, "1000"],
    [1, 2, "1000"],
    [2, 0, "900"],
  ]
  for (const [cr, db, amt] of graph) {
    const id = await circuit.nextInvoiceId()
    await (await circuit.connect(shops[cr].s).createInvoice(circleId, shops[db].s.address, ethers.parseEther(amt), ethers.id(`demo-${id}`))).wait()
    await (await circuit.connect(shops[db].s).acceptInvoice(id)).wait()
    console.log(`invoice #${id}: ${shops[db].name} owes ${shops[cr].name} ${amt} MUSD`)
  }
  const cyc = await circuit.currentCycle(circleId)
  console.log(
    `gross ${ethers.formatEther(await circuit.gross(circleId, cyc))} · owed ${ethers.formatEther(await circuit.totalOwed(circleId, cyc))} · efficiency ${await circuit.nettingEfficiencyBps(circleId, cyc)} bps`,
  )
  console.log(`\nOpen /circuit/${circleId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

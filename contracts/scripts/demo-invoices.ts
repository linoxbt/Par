// Posts a fresh round of the demo invoice graph into the CURRENT cycle of an existing circle,
// so the Circuit demo can be re-run before recording (2,900 MUSD gross, 100 MUSD net).
//   CIRCLE=0 npx hardhat run scripts/demo-invoices.ts --network matsnet
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"))
  const [, importer, wholesaler, repairer] = await ethers.getSigners()
  const shops = [
    { name: "importer", s: importer },
    { name: "wholesaler", s: wholesaler },
    { name: "repairer", s: repairer },
  ]
  const circleId = BigInt(process.env.CIRCLE || "0")
  const circuit = await ethers.getContractAt("ParCircuit", dep.ParCircuit)
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
  console.log(`cycle ${cyc}: gross ${ethers.formatEther(await circuit.gross(circleId, cyc))} · owed ${ethers.formatEther(await circuit.totalOwed(circleId, cyc))} · ${await circuit.nettingEfficiencyBps(circleId, cyc)} bps`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

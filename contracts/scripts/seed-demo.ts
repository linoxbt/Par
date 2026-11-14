// Pre-creates the Circuit demo (spec section 10): three shops with vaults and clearing lines,
// a circle with a 600 s cycle / 60 s settle window, and a tangled invoice graph
// (2,900 MUSD gross, 100 MUSD net).
//
//   local:   npx hardhat run scripts/seed-demo.ts --network localhost
//   testnet: MATSNET_PRIVATE_KEY=<admin> MATSNET_DEMO_KEYS=<k1>,<k2>,<k3> \
//            npx hardhat run scripts/seed-demo.ts --network matsnet
//
// Env: DEMO_BTC (per vault, default 1 local / 0.1 testnet), DEMO_SEED (default 1800),
//      DEMO_CHUNK (invoice chunk, default 100), DEMO_LINE (clearing line cap, default 1.5 x chunk),
//      DEMO_CYCLE (600), DEMO_WINDOW (60)
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"
import { postGraph } from "./demo-graph"

const Z = ethers.ZeroAddress

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"))
  const signers = await ethers.getSigners()
  if (signers.length < 4) throw new Error("need 4 signers: admin + 3 shops (set MATSNET_DEMO_KEYS)")
  const [admin, importer, wholesaler, repairer] = signers
  const local = network.name === "localhost" || network.name === "hardhat"

  const btc = ethers.parseEther(process.env.DEMO_BTC || (local ? "1" : "0.1"))
  const seed = ethers.parseEther(process.env.DEMO_SEED || "1800")
  const chunk = Number(process.env.DEMO_CHUNK || 100)
  const line = ethers.parseEther(process.env.DEMO_LINE || String(Math.ceil(chunk * 1.5)))
  const cycle = Number(process.env.DEMO_CYCLE || 600)
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
  // Resumable: reuses a shop's latest vault and skips steps already done. Trove-touching
  // calls get gas headroom because MUSD's sorted-list insert can exceed the estimate.
  const pad = async (est: Promise<bigint>) => ((await est) * 3n) / 2n
  for (const { name, s } of shops) {
    let addr: string
    const n = await factory.vaultCount(s.address)
    if (n > 0n) addr = await factory.vaultsOf(s.address, n - 1n)
    else {
      const rc = await (await factory.connect(s).createVault()).wait()
      addr = rc!.logs.map((l) => factory.interface.parseLog(l)).find((l) => l?.name === "VaultCreated")!.args.vault
    }
    const vault = await ethers.getContractAt("ParVault", addr)
    const [coll] = await vault.troveState()
    if (coll === 0n) {
      const gasLimit = await pad(vault.connect(s).openTrove.estimateGas(seed, Z, Z, { value: btc }))
      await (await vault.connect(s).openTrove(seed, Z, Z, { value: btc, gasLimit })).wait()
    }
    let lineId = -1n
    for (let i = 0n; i < (await vault.nextId()); i++) {
      const [kind, status, beneficiary] = await vault.commitmentInfo(i)
      if (Number(kind) === 2 && Number(status) === 1 && beneficiary.toLowerCase() === dep.ParCircuit.toLowerCase()) lineId = i
    }
    if (lineId < 0n) {
      lineId = await vault.nextId()
      const gasLimit = await pad(vault.connect(s).createClearingLine.estimateGas(dep.ParCircuit, line, expiry))
      await (await vault.connect(s).createClearingLine(dep.ParCircuit, line, expiry, { gasLimit })).wait()
    }
    vaults.push(addr)
    lineIds.push(lineId)
    console.log(`${name}: ${s.address} vault ${addr} line #${lineId}`)
  }

  const circleId = await circuit.nextCircleId()
  await (await circuit.connect(admin).createCircle(cycle, window)).wait()
  for (let i = 0; i < 3; i++) {
    await (await circuit.connect(admin).addMember(circleId, shops[i].s.address, vaults[i], lineIds[i])).wait()
  }
  console.log(`circle #${circleId} (cycle ${cycle}s, settle window ${window}s)`)

  await postGraph(circuit, circleId, shops, chunk)
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

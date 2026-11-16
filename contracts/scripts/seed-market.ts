// Underwriting market demo on any network: a tenant with no BTC posts a rent-guarantee request
// (12 x 500 MUSD, cover 1,500, premium 25 MUSD) for their landlord, and an underwriter fills it
// from their ParVault in one transaction (the premium goes to the underwriter).
//   npx hardhat run scripts/seed-market.ts --network localhost
//
// Signers: #0 = underwriter (reuses a vault that can carry the cover, or opens one),
//          #1 = requester / tenant (if absent, the request is only posted by #0 and not filled:
//               a requester can never fill their own request).
// Env: LANDLORD (beneficiary, default signer #2 or #0), DEMO_REF (request metadata, hashed;
//      default "par:demo-rent"), DEMO_PREMIUM (25), DEMO_START_DELAY (seconds until installment #0
//      and the fill deadline, default 1800), DEMO_PERIOD (120), DEMO_GRACE (10), DEMO_BTC / DEMO_SEED
//      (new vault only), REQUEST (resume this request id), FILL=0 (post only, fill later in the app).
//
// Resumable: an open request from the same requester with the same ref is reused, an existing
// vault of the underwriter that passes the stress test is reused, and a filled request is skipped.
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"

const Z = ethers.ZeroAddress
const OPEN = 1n
const FILLED = 2n

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"))
  if (!dep.ParMarket) throw new Error(`no ParMarket in deployments/${network.name}.json; redeploy first`)
  const signers = await ethers.getSigners()
  const underwriter = signers[0]
  const requester = signers[1] ?? signers[0]
  const local = network.name === "localhost" || network.name === "hardhat"
  const landlord = process.env.LANDLORD || signers[2]?.address || underwriter.address
  const ref = ethers.id(process.env.DEMO_REF || "par:demo-rent")
  const premium = ethers.parseEther(process.env.DEMO_PREMIUM || "25")
  const installment = ethers.parseEther("500")
  const count = 12
  const cap = ethers.parseEther("1500")
  const period = Number(process.env.DEMO_PERIOD || 120)
  const grace = Number(process.env.DEMO_GRACE || 10)
  const startDelay = Number(process.env.DEMO_START_DELAY || 1800)

  const factory = await ethers.getContractAt("ParFactory", dep.ParFactory)
  const market = await ethers.getContractAt("ParMarket", dep.ParMarket)
  const musd = await ethers.getContractAt("IERC20", await market.musd())
  const now = (await ethers.provider.getBlock("latest"))!.timestamp

  // 1) the request (resume REQUEST=<id>, or an open, unexpired one with the same requester + ref)
  let id: bigint | undefined = process.env.REQUEST !== undefined ? BigInt(process.env.REQUEST) : undefined
  if (id === undefined) {
    const n = await market.nextRequestId()
    for (let i = n - 1n; i >= 0n && i >= n - 50n; i--) {
      const r = await market.getRequest(i)
      if (r.requester === requester.address && r.ref === ref && r.status === OPEN && Number(r.deadline) > now) {
        id = i
        break
      }
    }
  }
  if (id === undefined) {
    if ((await musd.balanceOf(requester.address)) < premium) {
      if (requester.address === underwriter.address || (await musd.balanceOf(underwriter.address)) < premium) {
        throw new Error(`requester ${requester.address} needs ${ethers.formatEther(premium)} MUSD for the premium`)
      }
      await (await musd.connect(underwriter).transfer(requester.address, premium)).wait() // demo funding
    }
    if ((await musd.allowance(requester.address, dep.ParMarket)) < premium) {
      await (await musd.connect(requester).approve(dep.ParMarket, premium)).wait()
    }
    const start = now + startDelay
    const expiry = now + 86400 * 30
    id = await market.nextRequestId()
    await (
      await market
        .connect(requester)
        .requestScheduled(landlord, installment, start, period, grace, count, cap, expiry, premium, start, ref)
    ).wait()
    console.log(`posted request #${id}: ${count} x 500 MUSD to ${landlord}, cover 1,500, premium ${ethers.formatEther(premium)}`)
  } else {
    console.log(`resuming request #${id}`)
  }

  let r = await market.getRequest(id)
  if (r.status === FILLED) {
    console.log(`request #${id} already filled: vault ${r.vault} commitment #${r.commitmentId}`)
    console.log(`certificate: /c/${r.vault}/${r.commitmentId}`)
    return
  }
  if (r.status !== OPEN) throw new Error(`request #${id} is not open (status ${r.status})`)
  if (process.env.FILL === "0" || requester.address === underwriter.address) {
    console.log(`not filling (${process.env.FILL === "0" ? "FILL=0" : "need a second signer as requester"}); fill it in the app before ${new Date(Number(r.deadline) * 1000).toISOString()}`)
    return
  }

  // 2) an underwriter vault that can carry the cover (stress test included), else open one
  let vault: any
  const vc = await factory.vaultCount(underwriter.address)
  for (let i = 0n; i < vc; i++) {
    const v = await ethers.getContractAt("ParVault", await factory.vaultsOf(underwriter.address, i))
    if ((await v.health(r.cap))[0]) {
      vault = v
      break
    }
  }
  if (!vault) {
    const btc = ethers.parseEther(process.env.DEMO_BTC || (local ? "1" : "0.1"))
    const seed = ethers.parseEther(process.env.DEMO_SEED || "1800")
    const rc = await (await factory.connect(underwriter).createVault()).wait()
    const log = rc!.logs.map((l) => factory.interface.parseLog(l)).find((l) => l?.name === "VaultCreated")!
    vault = await ethers.getContractAt("ParVault", log.args.vault)
    await (await vault.connect(underwriter).openTrove(seed, Z, Z, { value: btc })).wait()
    console.log(`opened vault ${await vault.getAddress()} with ${ethers.formatEther(btc)} BTC`)
  }

  // 3) fill: commitment + premium in one transaction
  const before = await musd.balanceOf(underwriter.address)
  await (await vault.connect(underwriter).fillRequest(dep.ParMarket, id)).wait()
  r = await market.getRequest(id)
  const earned = (await musd.balanceOf(underwriter.address)) - before
  console.log(`filled request #${id} from vault ${r.vault}: commitment #${r.commitmentId}, premium ${ethers.formatEther(earned)} MUSD to ${underwriter.address}`)
  console.log(`certificate: /c/${r.vault}/${r.commitmentId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

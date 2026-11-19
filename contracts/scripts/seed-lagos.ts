// Lagos pilot market demo on testnet: open cover requests (rent and merchant bonds) with escrowed
// premiums, so the underwriting market has real listings to browse and back.
//
//   npx hardhat run scripts/seed-lagos.ts --network matsnet
//
// Signers: #0 = funder (opens a vault for its 1,800 MUSD buffer if it has none, and sends premium
// MUSD to the requesters), #1..#3 = requesters / landlords / arbiters (MATSNET_DEMO_KEYS).
// Optional: CONSOLIDATE=1 first sweeps spare BTC from the demo keys (leaving gas) and from
// KEEPER_PRIVATE_KEY (leaving KEEP_KEEPER, default 0.006) to the funder, so the vault can open.
// Env: VAULT_BTC (collateral for a new vault; default: all the funder can spare), MIN_ICR (1.4).
//
// Resumable: a request already open from the same requester with the same note is skipped.
// Amounts are MUSD (about US$1); naira figures in the notes use the rate at seeding time.
import fs from "fs"
import path from "path"
import { ethers, network } from "hardhat"

const Z = ethers.ZeroAddress
const DAY = 86400
const OPEN = 1n

async function main() {
  const dep = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", `${network.name}.json`), "utf8"))
  const signers = await ethers.getSigners()
  if (signers.length < 4) throw new Error("need 4 signers: funder + 3 demo keys (MATSNET_DEMO_KEYS)")
  const [funder, A, B, C] = signers
  const factory = await ethers.getContractAt("ParFactory", dep.ParFactory)
  const market = await ethers.getContractAt("ParMarket", dep.ParMarket)
  const musd = await ethers.getContractAt("IERC20", await market.musd())
  const e = ethers.parseEther
  const fmt = (v: bigint) => Number(ethers.formatEther(v)).toFixed(4)

  // 0) optional: sweep spare BTC to the funder
  if (process.env.CONSOLIDATE === "1") {
    const leave = e("0.0005")
    for (const s of [A, B, C]) {
      const bal = await ethers.provider.getBalance(s.address)
      if (bal > leave + e("0.0005")) {
        await (await s.sendTransaction({ to: funder.address, value: bal - leave - e("0.0001") })).wait()
        console.log(`swept ${fmt(bal - leave - e("0.0001"))} BTC from ${s.address}`)
      }
    }
    if (process.env.KEEPER_PRIVATE_KEY) {
      const keeper = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY, ethers.provider)
      const keep = e(process.env.KEEP_KEEPER || "0.006")
      const bal = await ethers.provider.getBalance(keeper.address)
      if (bal > keep + e("0.0005")) {
        await (await keeper.sendTransaction({ to: funder.address, value: bal - keep - e("0.0001") })).wait()
        console.log(`swept ${fmt(bal - keep - e("0.0001"))} BTC from the keeper (left ${fmt(keep)})`)
      }
    }
  }

  // 1) a funder vault with MUSD in its buffer
  let vault: any
  const n = await factory.vaultCount(funder.address)
  for (let i = 0n; i < n; i++) {
    const v = await ethers.getContractAt("ParVault", await factory.vaultsOf(funder.address, i))
    if ((await v.troveState())[1] > 0n) vault = v
  }
  if (!vault) {
    const vaultAddr =
      n > 0n
        ? await factory.vaultsOf(funder.address, n - 1n)
        : await (async () => {
            const rc = await (await factory.connect(funder).createVault()).wait()
            const log = rc!.logs.map((l) => { try { return factory.interface.parseLog(l) } catch { return null } }).find((l) => l?.name === "VaultCreated")!
            return log.args.vault as string
          })()
    vault = await ethers.getContractAt("ParVault", vaultAddr)
    const pf = await ethers.getContractAt("IPriceFeed", dep.musd.PriceFeed)
    const price = await pf.fetchPrice.staticCall()
    const bal = await ethers.provider.getBalance(funder.address)
    const coll = process.env.VAULT_BTC ? e(process.env.VAULT_BTC) : bal - e("0.0015")
    const debt = e("1800") + e("1.8") + e("200")
    const icr = Number((coll * price) / debt) / 1e18
    const minIcr = Number(process.env.MIN_ICR || 1.4)
    console.log(`opening trove: ${fmt(coll)} BTC at $${Number(ethers.formatEther(price)).toFixed(0)}, ICR ${(icr * 100).toFixed(0)}%`)
    if (icr < minIcr) throw new Error(`ICR ${(icr * 100).toFixed(0)}% is below MIN_ICR ${minIcr * 100}%: fund ${funder.address} first`)
    await (await vault.connect(funder).openTrove(e("1800"), Z, Z, { value: coll })).wait()
  }
  console.log(`funder vault ${await vault.getAddress()}`)

  // 2) the requests
  const now = (await ethers.provider.getBlock("latest"))!.timestamp
  const deadline = now + 30 * DAY
  const start = now + 31 * DAY
  const month = 30 * DAY
  const grace = 3 * DAY
  const rentExpiry = start + 11 * month + grace + 7 * DAY
  type Req =
    | { kind: "rent"; who: any; to: string; note: string; installment: string; cover: string; premium: string }
    | { kind: "bond"; who: any; to: string; arbiter: string; note: string; cover: string; days: number; premium: string }
  const reqs: Req[] = [
    { kind: "rent", who: A, to: B.address, note: "Lagos pilot · rent · Yaba 1-bed flat, ₦350,000/month", installment: "259", cover: "777", premium: "23" },
    { kind: "rent", who: B, to: C.address, note: "Lagos pilot · rent · Lekki studio, ₦600,000/month", installment: "443", cover: "1329", premium: "40" },
    { kind: "rent", who: C, to: A.address, note: "Lagos pilot · rent · Oshodi market stall, ₦120,000/month", installment: "89", cover: "267", premium: "8" },
    { kind: "bond", who: C, to: A.address, arbiter: B.address, note: "Lagos pilot · merchant bond · Computer Village phone importer, 60-day supplier terms", cover: "1000", days: 90, premium: "20" },
    { kind: "bond", who: A, to: C.address, arbiter: B.address, note: "Lagos pilot · merchant bond · Balogun fabric wholesale, 30-day terms", cover: "600", days: 60, premium: "12" },
  ]
  const next = await market.nextRequestId()
  const existing: { requester: string; ref: string }[] = []
  for (let i = 0n; i < next; i++) {
    const r = await market.getRequest(i)
    if (r.status === OPEN && Number(r.deadline) > now) existing.push({ requester: r.requester, ref: r.ref })
  }
  const todo = reqs.filter((q) => {
    const done = existing.some((x) => x.requester === q.who.address && x.ref === ethers.id(q.note))
    if (done) console.log(`exists: ${q.note}`)
    return !done
  })
  // premium MUSD to the requesters, from the funder vault's buffer, only for requests still to post
  for (const s of [A, B, C]) {
    const need = todo.filter((q) => q.who === s).reduce((t, q) => t + e(q.premium), 0n)
    const have = await musd.balanceOf(s.address)
    if (need > have) {
      await (await vault.connect(funder).withdrawMUSDBuffer(need - have, s.address)).wait()
      console.log(`sent ${fmt(need - have)} MUSD to ${s.address}`)
    }
  }
  for (const q of todo) {
    const ref = ethers.id(q.note)
    const premium = e(q.premium)
    if ((await musd.allowance(q.who.address, dep.ParMarket)) < premium) await (await musd.connect(q.who).approve(dep.ParMarket, premium)).wait()
    const id = await market.nextRequestId()
    if (q.kind === "rent") {
      await (
        await market.connect(q.who).requestScheduled(q.to, e(q.installment), start, month, grace, 12, e(q.cover), rentExpiry, premium, deadline, ref)
      ).wait()
    } else {
      await (await market.connect(q.who).requestClaim(q.to, q.arbiter, e(q.cover), deadline + q.days * DAY, 48 * 3600, premium, deadline, ref)).wait()
    }
    console.log(`#${id} ${q.note} (cover ${q.cover} MUSD, premium ${q.premium})`)
  }
  console.log(`open requests: ${await market.openCount()}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

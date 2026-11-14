import { expect } from "chai"
import { ethers, network } from "hardhat"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import {
  Contracts,
  fastForwardTime,
  getLatestBlockTimestamp,
  openTrove,
  setupTests,
  to1e18,
  User,
  Z,
} from "./helpers"

/**
 * Audit regressions (mock MUSD system only: uses MockMUSDSystem.liquidate and a LineDrawer helper).
 * Each auditor proof-of-concept is ported here inverted: it now proves the bug is gone.
 */
describe("Par audit regressions", () => {
  let contracts: Contracts
  let alice: User, bob: User, carol: User, dennis: User, eric: User, whale: User, deployer: User
  let factory: any
  let circuit: any
  let cAddr: string

  const STRESS_BPS = 4000n
  const TARGET_ICR = to1e18("1.6")
  const DAY = 86400

  async function newVault(owner: User, btc: bigint, seed: bigint, open = true) {
    const rc = await (await factory.connect(owner.wallet).createVault()).wait()
    const log = rc.logs.find((l: any) => l.fragment?.name === "VaultCreated")
    const vault = await ethers.getContractAt("ParVault", log.args.vault)
    if (open) await vault.connect(owner.wallet).openTrove(seed, Z, Z, { value: btc })
    return vault
  }

  async function addAndJoin(circleId: number, member: User, vault: any, lineId: number | bigint) {
    const v = await vault.getAddress()
    await circuit.connect(deployer.wallet).addMember(circleId, member.address, v, lineId)
    await circuit.connect(member.wallet).join(circleId, v, lineId)
  }

  async function line(vault: any, owner: User, cap: string, expiry: number | bigint) {
    const id = await vault.nextId()
    await vault.connect(owner.wallet).createClearingLine(cAddr, to1e18(cap), expiry)
    return id
  }

  /** I1: reserved == sum over Active commitments of (cap - paidOut); paidOut <= cap always. */
  async function expectReservedInvariant(vault: any, skipClosed?: Set<number>) {
    const n = Number(await vault.nextId())
    let sum = 0n
    for (let i = 0; i < n; i++) {
      if (skipClosed?.has(i)) continue
      const c = await vault.getCommitment(i)
      expect(c.paidOut).to.be.lessThanOrEqual(c.cap)
      if (Number(c.status) === 1) sum += (c.cap as bigint) - (c.paidOut as bigint)
      else skipClosed?.add(i) // Closed is terminal
    }
    expect(await vault.reserved()).to.equal(sum)
  }

  beforeEach(async () => {
    ;({ alice, bob, carol, dennis, eric, whale, deployer, contracts } = await setupTests())
    factory = await (await ethers.getContractFactory("ParFactory")).deploy(
      await contracts.borrowerOperations.getAddress(),
      await contracts.troveManager.getAddress(),
      await contracts.priceFeed.getAddress(),
      await contracts.musd.getAddress(),
      STRESS_BPS,
      TARGET_ICR,
    )
    circuit = await (await ethers.getContractFactory("ParCircuit")).deploy(await factory.getAddress())
    cAddr = await circuit.getAddress()
    await openTrove(contracts, { musdAmount: "100000", ICR: "300", sender: whale.wallet })
  })

  // ================================================================== C1

  describe("C1: claim lifecycle vs. closeCommitment", () => {
    it("PoC F1 inverted: no release while a claim is open; reserved stays exact; trove stays locked", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("1000"), now + 60, 120, 10, 3, to1e18("3000"), now + 30 * DAY)
      // the PoC's self-dealing setup (beneficiary = arbiter = owner) is no longer accepted
      await expect(
        v.connect(alice.wallet).createClaim(alice.address, alice.address, alice.address, to1e18("3000"), now + DAY, 60),
      ).to.be.revertedWithCustomError(v, "BadParams")
      await v.connect(alice.wallet).createClaim(carol.address, alice.address, dennis.address, to1e18("3000"), now + DAY, 60)
      await expectReservedInvariant(v)
      await v.connect(carol.wallet).fileClaim(1, to1e18("3000"), ethers.id("x"))
      await expect(v.connect(carol.wallet).closeCommitment(1)).to.be.revertedWithCustomError(v, "ClaimOpen")
      await fastForwardTime(61)
      await v.executeClaim(1, Z, Z)
      await expectReservedInvariant(v)
      expect(await v.reserved()).to.equal(to1e18("3000")) // bob's guarantee is still fully reserved
      expect((await v.getCommitment(1)).status).to.equal(2n) // fully paid -> Closed
      await expect(v.executeClaim(1, Z, Z)).to.be.revertedWithCustomError(v, "NotActive")
      await expect(v.connect(carol.wallet).fileClaim(1, 1n, ethers.id("y"))).to.be.revertedWithCustomError(v, "NotActive")
      await expect(v.connect(alice.wallet).closeTrove()).to.be.revertedWithCustomError(v, "ReservedCommitments")
      // and the landlord still gets paid
      await fastForwardTime(200)
      await expect(v.triggerMissed(0, 0, Z, Z)).to.emit(v, "Payout")
    })

    it("open claim blocks release after expiry by anyone, and by the beneficiary before it", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("1000"), now + 600, 60)
      await v.connect(bob.wallet).fileClaim(0, to1e18("400"), ethers.id("e"))
      await v.connect(carol.wallet).disputeClaim(0)
      await expect(v.connect(bob.wallet).closeCommitment(0)).to.be.revertedWithCustomError(v, "ClaimOpen")
      await fastForwardTime(700)
      await expect(v.connect(eric.wallet).closeCommitment(0)).to.be.revertedWithCustomError(v, "ClaimOpen")
      await v.connect(dennis.wallet).resolveClaim(0, false, Z, Z)
      await expect(v.connect(eric.wallet).closeCommitment(0)).to.emit(v, "CommitmentClosed").withArgs(0, to1e18("1000"))
      await expectReservedInvariant(v)
      expect(await v.reserved()).to.equal(0n)
    })

    it("invariant I1 holds across a seeded random sequence of commitment operations", async function () {
      this.timeout(600_000)
      const drawer = await (await ethers.getContractFactory("LineDrawer")).deploy()
      const dAddr = await drawer.getAddress()
      const v = await newVault(alice, to1e18("2"), to1e18("3000"))
      const vAddr = await v.getAddress()
      await openTrove(contracts, { musdAmount: "20000", ICR: "400", sender: carol.wallet })
      await contracts.musd.connect(carol.wallet).approve(vAddr, ethers.MaxUint256)

      // mulberry32
      let seed = 0x5eed1234
      const rnd = () => {
        seed |= 0
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
      }
      const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1))
      const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]

      const ok: Record<string, number> = {}
      const closed = new Set<number>()
      const ids: Record<string, number[]> = { s: [], c: [], l: [] }
      const idOf = (k: string, fallback: number) => (ids[k].length && rnd() < 0.9 ? pick(ids[k]) : fallback)
      const OPS = 400
      for (let step = 0; step < OPS; step++) {
        const now = await getLatestBlockTimestamp()
        const n = Number(await v.nextId())
        const anyId = n > 0 ? ri(0, n - 1) : 0
        const op = ri(0, 12)
        const kindFor: Record<number, string> = { 3: "s", 4: "s", 5: "c", 6: "c", 7: "c", 8: "c", 10: "l" }
        const id = kindFor[op] ? idOf(kindFor[op], anyId) : anyId
        let name = ""
        let tx: () => Promise<any>
        switch (op) {
          case 0: {
            name = "createScheduled"
            const inst = ri(50, 500)
            const count = ri(1, 4)
            const period = ri(60, 300)
            const start = now + ri(10, 100)
            const cap = ri(1, inst * count)
            const expiry = start + (count - 1) * period + 10 + ri(1, 3000)
            tx = () =>
              v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18(inst), start, period, 10, count, to1e18(cap), expiry)
            break
          }
          case 1:
            name = "createClaim"
            tx = () => v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18(ri(100, 3000)), now + ri(300, 5000), ri(60, 300))
            break
          case 2:
            name = "createClearingLine"
            tx = () => v.connect(alice.wallet).createClearingLine(dAddr, to1e18(ri(100, 3000)), now + ri(300, 5000))
            break
          case 3:
            name = "payInstallment"
            tx = () => v.connect(carol.wallet).payInstallment(id, ri(0, 3))
            break
          case 4:
            name = "triggerMissed"
            tx = () => v.connect(eric.wallet).triggerMissed(id, ri(0, 3), Z, Z)
            break
          case 5: {
            name = "fileClaim"
            const c = await v.getCommitment(id).catch(() => null)
            const rem = c ? c.cap - c.paidOut : 0n
            const amt = rem > 0n ? (rem * BigInt(ri(1, 100))) / 100n : 1n
            tx = () => v.connect(bob.wallet).fileClaim(id, amt === 0n ? 1n : amt, ethers.id(`e${step}`))
            break
          }
          case 6:
            name = "disputeClaim"
            tx = () => v.connect(pick([carol, alice]).wallet).disputeClaim(id)
            break
          case 7:
            name = "resolveClaim"
            tx = () => v.connect(dennis.wallet).resolveClaim(id, rnd() < 0.6, Z, Z)
            break
          case 8:
            name = "executeClaim"
            tx = () => v.connect(eric.wallet).executeClaim(id, Z, Z)
            break
          case 9:
            name = "closeCommitment"
            tx = () => v.connect(pick([bob, eric]).wallet).closeCommitment(id)
            break
          case 10: {
            name = "drawLine"
            const c = await v.getCommitment(id).catch(() => null)
            const rem = c ? c.cap - c.paidOut : 0n
            const amt = rem > 0n ? (rem * BigInt(ri(1, 100))) / 100n : 1n
            tx = () => drawer.draw(vAddr, id, amt === 0n ? 1n : amt)
            break
          }
          case 11:
            name = "withdrawBuffer"
            tx = async () => {
              const bal = await contracts.musd.balanceOf(vAddr)
              return v.connect(alice.wallet).withdrawMUSDBuffer(bal / 2n, alice.address)
            }
            break
          default: {
            name = "time"
            const dt = rnd() < 0.04 ? 8 * DAY : ri(10, 800)
            tx = () => fastForwardTime(dt)
          }
        }
        try {
          await (await tx())?.wait?.()
          ok[name] = (ok[name] ?? 0) + 1
          if (op <= 2) ids[["s", "c", "l"][op]].push(n)
        } catch {
          // a random op may legitimately revert; the invariant must hold either way
        }
        await expectReservedInvariant(v, closed)
      }
      // the run exercised every path that moves `reserved`
      for (const k of ["createScheduled", "createClaim", "createClearingLine", "triggerMissed", "fileClaim", "executeClaim", "closeCommitment", "drawLine"]) {
        expect(ok[k] ?? 0, k).to.be.greaterThan(0)
      }
      console.log("      successful ops:", JSON.stringify(ok))
    })
  })

  // ================================================================== H1

  describe("H1: Circuit cycles always terminate", () => {
    it("PoC F2 (a): lines that expire before close + settleWindow are rejected at invite/join and at accept", async () => {
      const va = await newVault(alice, to1e18("1"), to1e18("2000"))
      const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
      await circuit.createCircle(300, 120)
      const close0 = await circuit.cycleClose(0, 0)
      const short = await line(va, alice, "1000", close0 + 119n)
      await expect(circuit.addMember(0, alice.address, await va.getAddress(), short))
        .to.be.revertedWithCustomError(circuit, "LineExpiresTooSoon")
        .withArgs(close0 + 119n, close0 + 120n)
      // valid for cycle 0 only
      const l0 = await line(va, alice, "1000", close0 + 150n)
      await addAndJoin(0, alice, va, l0)
      await addAndJoin(0, bob, vb, await line(vb, bob, "1000", close0 + 30n * 86400n))
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("100"), ethers.id("a"))
      await circuit.connect(alice.wallet).acceptInvoice(0)
      await fastForwardTime(300)
      expect(await circuit.currentCycle(0)).to.equal(1n)
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("100"), ethers.id("b"))
      await expect(circuit.connect(alice.wallet).acceptInvoice(1))
        .to.be.revertedWithCustomError(circuit, "LineExpiresTooSoon")
        .withArgs(close0 + 150n, close0 + 300n + 120n)
      // ...but alice can still be paid (becoming a net creditor needs no line)
      await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("50"), ethers.id("c"))
      await circuit.connect(bob.wallet).acceptInvoice(2)
    })

    it("PoC F2 (b): an uncollectable debtor no longer locks the cycle; pro-rata after finalAt, order-independent, late settle tops up", async () => {
      const va = await newVault(alice, to1e18("1"), to1e18("2000"))
      const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
      const vc = await newVault(carol, to1e18("1"), to1e18("2000"))
      const vd = await newVault(dennis, to1e18("1"), to1e18("2000"))
      await circuit.createCircle(300, 120)
      const close0 = await circuit.cycleClose(0, 0)
      const far = close0 + 30n * 86400n
      await addAndJoin(0, alice, va, await line(va, alice, "1000", close0 + 150n)) // the minimum the circuit accepts
      await addAndJoin(0, bob, vb, await line(vb, bob, "1000", far))
      await addAndJoin(0, carol, vc, await line(vc, carol, "1000", far))
      await addAndJoin(0, dennis, vd, await line(vd, dennis, "1000", far))

      // alice owes bob 600 and carol 200; dennis owes carol 400
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("600"), ethers.id("1"))
      await circuit.connect(carol.wallet).createInvoice(0, alice.address, to1e18("200"), ethers.id("2"))
      await circuit.connect(carol.wallet).createInvoice(0, dennis.address, to1e18("400"), ethers.id("3"))
      for (const [i, u] of [[0, alice], [1, alice], [2, dennis]] as const) await circuit.connect(u.wallet).acceptInvoice(i)
      expect(await circuit.totalOwed(0, 0)).to.equal(to1e18("1200"))
      expect(await circuit.outstanding(await va.getAddress(), 0)).to.equal(to1e18("800"))

      // dennis settles honestly
      await fastForwardTime(Number(close0) - (await getLatestBlockTimestamp()) + 1)
      await vd.connect(dennis.wallet).withdrawMUSDBuffer(to1e18("400"), dennis.address)
      await contracts.musd.connect(dennis.wallet).approve(cAddr, to1e18("400"))
      await expect(circuit.connect(dennis.wallet).settle(0, 0)).to.emit(circuit, "Settled").withArgs(0, 0, dennis.address, to1e18("400"), false)

      // the keeper is late: alice's line expired before anyone force-settled her
      await fastForwardTime(200)
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.be.revertedWithCustomError(va, "TooLate")
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.be.revertedWithCustomError(circuit, "NotYet")

      // one full cycle after the force-settle window opens, the cycle is final
      const fin = await circuit.finalAt(0, 0)
      expect(fin).to.equal(close0 + 120n + 300n)
      await fastForwardTime(Number(fin) - (await getLatestBlockTimestamp()))
      const b0 = await contracts.musd.balanceOf(bob.address)
      await expect(circuit.connect(bob.wallet).claim(0, 0))
        .to.emit(circuit, "CycleFinalized")
        .withArgs(0, 0, to1e18("400"), to1e18("1200"))
        .and.to.emit(circuit, "Claimed")
        .withArgs(0, 0, bob.address, to1e18("200"))
      expect(await circuit.finalized(0, 0)).to.equal(true)
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.be.revertedWithCustomError(circuit, "NotYet") // nothing new
      expect(await contracts.musd.balanceOf(cAddr)).to.equal(to1e18("200")) // never pays out more than collected

      // alice pays late (voluntarily); the shortfall is collected and nobody was shortchanged by claiming early
      await va.connect(alice.wallet).withdrawMUSDBuffer(to1e18("800"), alice.address)
      await contracts.musd.connect(alice.wallet).approve(cAddr, to1e18("800"))
      await circuit.connect(alice.wallet).settle(0, 0)
      expect(await circuit.outstanding(await va.getAddress(), 0)).to.equal(0n)
      const c0 = await contracts.musd.balanceOf(carol.address)
      await expect(circuit.connect(carol.wallet).claim(0, 0)).to.emit(circuit, "Claimed").withArgs(0, 0, carol.address, to1e18("600"))
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.emit(circuit, "Claimed").withArgs(0, 0, bob.address, to1e18("400"))
      expect((await contracts.musd.balanceOf(bob.address)) - b0).to.equal(to1e18("600"))
      expect((await contracts.musd.balanceOf(carol.address)) - c0).to.equal(to1e18("600"))
      expect(await circuit.settled(0, 0, bob.address)).to.equal(true)
      expect(await contracts.musd.balanceOf(cAddr)).to.equal(0n)
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.be.revertedWithCustomError(circuit, "Done")
    })
  })

  // ================================================================== H2

  describe("H2: a clearing line is never committed beyond its cap", () => {
    it("PoC F3 inverted: the same line cannot back two circles; a fresh line per circle force-settles in both", async () => {
      const va = await newVault(alice, to1e18("1"), to1e18("2000"))
      const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
      const exp = (await getLatestBlockTimestamp()) + 30 * DAY
      const a0 = await line(va, alice, "1000", exp)
      await circuit.createCircle(300, 120)
      await circuit.createCircle(300, 120)
      await addAndJoin(0, alice, va, a0)
      await addAndJoin(0, bob, vb, await line(vb, bob, "1000", exp))
      await circuit.addMember(1, alice.address, await va.getAddress(), a0) // invite is fine...
      await expect(circuit.connect(alice.wallet).join(1, await va.getAddress(), a0)).to.be.revertedWithCustomError(circuit, "LineInUse")
      await addAndJoin(1, alice, va, await line(va, alice, "1000", exp)) // ...a fresh line works
      await addAndJoin(1, bob, vb, await line(vb, bob, "1000", exp))
      for (const id of [0, 1]) {
        await circuit.connect(bob.wallet).createInvoice(id, alice.address, to1e18("1000"), ethers.id("x" + id))
        await circuit.connect(alice.wallet).acceptInvoice(id)
      }
      await fastForwardTime(421)
      await circuit.forceSettle(0, 0, alice.address, Z, Z)
      await circuit.forceSettle(1, 0, alice.address, Z, Z)
      await circuit.connect(bob.wallet).claim(0, 0)
      await circuit.connect(bob.wallet).claim(1, 0)
    })

    it("PoC F4 inverted: obligations from every unsettled cycle count (keeper lag), outstanding tracks nets incrementally", async () => {
      const va = await newVault(alice, to1e18("1"), to1e18("2000"))
      const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
      const exp = (await getLatestBlockTimestamp()) + 30 * DAY
      await circuit.createCircle(300, 120)
      await addAndJoin(0, alice, va, await line(va, alice, "1500", exp))
      await addAndJoin(0, bob, vb, await line(vb, bob, "1500", exp))
      const vaAddr = await va.getAddress()
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("1000"), ethers.id("c0"))
      await circuit.connect(alice.wallet).acceptInvoice(0)
      await fastForwardTime(600) // cycle 2; nobody force-settled cycle 0
      expect(await circuit.currentCycle(0)).to.equal(2n)
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("1000"), ethers.id("c2"))
      await expect(circuit.connect(alice.wallet).acceptInvoice(1))
        .to.be.revertedWithCustomError(circuit, "OverLimit")
        .withArgs(to1e18("1500"), to1e18("2000"))
      expect(await circuit.lineHeadroom(0, alice.address)).to.equal(to1e18("500"))

      // settling cycle 0 frees the line
      await va.connect(alice.wallet).withdrawMUSDBuffer(to1e18("1000"), alice.address)
      await contracts.musd.connect(alice.wallet).approve(cAddr, to1e18("1000"))
      await circuit.connect(alice.wallet).settle(0, 0)
      expect(await circuit.outstanding(vaAddr, 0)).to.equal(0n)
      await circuit.connect(alice.wallet).acceptInvoice(1)
      expect(await circuit.outstanding(vaAddr, 0)).to.equal(to1e18("1000"))
      // becoming less of a debtor in the same cycle lowers outstanding
      await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("400"), ethers.id("back"))
      await circuit.connect(bob.wallet).acceptInvoice(2)
      expect(await circuit.outstanding(vaAddr, 0)).to.equal(to1e18("600"))
      // force-settling draws the line and clears its outstanding in step
      await fastForwardTime(421)
      await circuit.forceSettle(0, 2, alice.address, Z, Z)
      expect(await circuit.outstanding(vaAddr, 0)).to.equal(0n)
      expect(await va.available(0)).to.equal(to1e18("900"))
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.be.revertedWithCustomError(circuit, "Done")
    })
  })

  // ================================================================== M1

  it("M1 / PoC F5 inverted: a Normal Mode draw that would breach CCR tops up from idle BTC, or reverts with the BTC needed", async () => {
    await openTrove(contracts, { musdAmount: "300000", ICR: "151", sender: eric.wallet })
    const v = await newVault(alice, to1e18("2"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await v.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("20000"), now + DAY, 60)
    await v.connect(alice.wallet).withdrawMUSDBuffer(to1e18("2000"), alice.address)
    await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("36000"))
    const price = await contracts.priceFeed.fetchPrice()
    expect(await contracts.troveManager.checkRecoveryMode(price)).to.equal(false)
    await v.connect(bob.wallet).fileClaim(0, to1e18("20000"), ethers.id("e"))
    await fastForwardTime(61)

    const need = await v.recoveryTopUp(to1e18("20000"), price)
    expect(need).to.be.greaterThan(0n)
    const near = (x: bigint) => x >= need && x - need < to1e18("0.001")
    await expect(v.executeClaim(0, Z, Z)).to.be.revertedWithCustomError(v, "RecoveryModeNeedsReserve").withArgs(near)

    await alice.wallet.sendTransaction({ to: await v.getAddress(), value: need + to1e18("0.01") })
    const before = await contracts.musd.balanceOf(bob.address)
    await v.executeClaim(0, Z, Z)
    expect((await contracts.musd.balanceOf(bob.address)) - before).to.equal(to1e18("20000"))
    expect(await contracts.troveManager.getTCR(price)).to.be.greaterThanOrEqual(to1e18("1.5"))
    // a draw that keeps TCR >= CCR still mints without touching idle BTC
    expect(await v.recoveryTopUp(to1e18("1"), price)).to.equal(0n)
  })

  // ================================================================== M2

  it("M2: after liquidation available/health/creditLimit read 0; claimCollateral pulls the surplus; owner withdraws it", async () => {
    await openTrove(contracts, { musdAmount: "100000", ICR: "400", sender: dennis.wallet }) // healthy system around the vault
    const v = await newVault(alice, to1e18("1"), to1e18("2000"))
    const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
    const exp = (await getLatestBlockTimestamp()) + 30 * DAY
    await circuit.createCircle(300, 120)
    await addAndJoin(0, alice, v, await line(v, alice, "2000", exp))
    await addAndJoin(0, bob, vb, await line(vb, bob, "2000", exp))
    await v.connect(alice.wallet).borrow(to1e18("14000"), alice.address, Z, Z) // run the vault near its stress limit
    expect(await circuit.creditLimit(0, alice.address)).to.equal(to1e18("2000"))

    await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("20000"))
    const price = await contracts.priceFeed.fetchPrice()
    expect(await contracts.troveManager.checkRecoveryMode(price)).to.equal(true)
    await contracts.troveManager.connect(eric.wallet).liquidate(await v.getAddress()) // MCR <= ICR < TCR in Recovery Mode
    expect(await contracts.troveManager.getTroveStatus(await v.getAddress())).to.equal(3n)

    expect(await v.available(0)).to.equal(0n)
    expect(await v.health(0)).to.deep.equal([false, 0n, 0n])
    expect(await circuit.creditLimit(0, alice.address)).to.equal(0n)
    await expect(v.recoveryTopUp(to1e18("1"), price)).to.be.revertedWithCustomError(v, "NotActive") // L5a
    expect(await v.reserved()).to.equal(to1e18("2000")) // the line is still Active, but nothing can be minted

    await expect(v.connect(bob.wallet).claimCollateral()).to.be.revertedWithCustomError(v, "NotOwner")
    const surplus = await contracts.troveManager.collSurplus(await v.getAddress())
    expect(surplus).to.be.greaterThan(0n)
    await expect(v.connect(alice.wallet).claimCollateral()).to.emit(v, "CollateralClaimed").withArgs(surplus)
    expect(await ethers.provider.getBalance(await v.getAddress())).to.equal(surplus)
    // idle BTC is withdrawable even though Recovery Mode is on and reserved > 0: the trove is gone
    const b0 = await ethers.provider.getBalance(alice.address)
    const rc = await (await v.connect(alice.wallet).withdrawIdleBTC(surplus)).wait()
    expect((await ethers.provider.getBalance(alice.address)) + rc!.gasUsed * rc!.gasPrice - b0).to.equal(surplus)
  })

  // ================================================================== M3

  describe("M3: arbiter griefing", () => {
    it("PoC F6 inverted: a disputed claim the arbiter ignores is paid after the resolve deadline", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("1000"), now + 600, 60)
      await v.connect(bob.wallet).fileClaim(0, to1e18("300"), ethers.id("e"))
      await v.connect(carol.wallet).disputeClaim(0)
      const p = await v.pendingClaims(0)
      expect(p.disputedAt).to.be.greaterThan(0n)
      const window = Number(await v.RESOLVE_WINDOW())
      expect(window).to.equal(7 * DAY)
      await fastForwardTime(window - 10)
      await expect(v.connect(eric.wallet).executeClaim(0, Z, Z)).to.be.revertedWithCustomError(v, "TooEarly")
      await fastForwardTime(20)
      await expect(v.connect(dennis.wallet).resolveClaim(0, false, Z, Z)).to.be.revertedWithCustomError(v, "TooLate")
      const b0 = await contracts.musd.balanceOf(bob.address)
      await expect(v.connect(eric.wallet).executeClaim(0, Z, Z)).to.emit(v, "ClaimResolved").withArgs(0, true)
      expect((await contracts.musd.balanceOf(bob.address)) - b0).to.equal(to1e18("300"))
      await v.connect(eric.wallet).closeCommitment(0)
      await expectReservedInvariant(v)
      expect(await v.reserved()).to.equal(0n)
    })

    it("PoC F8 inverted: createClaim enforces challengeWindow >= 60 and an independent arbiter", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      const mk = (ben: string, arb: string, win: number) => v.connect(alice.wallet).createClaim(ben, carol.address, arb, to1e18("1000"), now + 600, win)
      await expect(mk(bob.address, dennis.address, 0)).to.be.revertedWithCustomError(v, "BadParams")
      await expect(mk(bob.address, dennis.address, 59)).to.be.revertedWithCustomError(v, "BadParams")
      await expect(mk(bob.address, Z, 60)).to.be.revertedWithCustomError(v, "BadParams")
      await expect(mk(bob.address, alice.address, 60)).to.be.revertedWithCustomError(v, "BadParams")
      await expect(mk(bob.address, bob.address, 60)).to.be.revertedWithCustomError(v, "BadParams")
      await mk(bob.address, dennis.address, 60)
    })
  })

  // ================================================================== L1 / L2 / L3

  it("L1 / PoC F7 inverted: createScheduled must start in the future and cover every installment before expiry", async () => {
    const v = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    const mk = (start: number, expiry: number) =>
      v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("100"), start, 120, 10, 3, to1e18("300"), expiry)
    await expect(mk(now + 60, now + 200)).to.be.revertedWithCustomError(v, "BadParams") // last due now+300
    await expect(mk(now + 60, now + 60 + 240 + 10)).to.be.revertedWithCustomError(v, "BadParams") // empty trigger window
    await expect(mk(now - 10, now + 3600)).to.be.revertedWithCustomError(v, "BadParams") // start in the past
    await mk(now + 60, now + 60 + 240 + 11) // the tightest accepted expiry
    await network.provider.send("evm_setNextBlockTimestamp", [now + 60 + 240 + 11])
    await v.triggerMissed(0, 2, Z, Z) // the last installment is still covered, at expiry itself
  })

  it("L2: a rejected claim cannot be refiled for one challenge window", async () => {
    const v = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("1000"), now + DAY, 600)
    await v.connect(bob.wallet).fileClaim(0, to1e18("100"), ethers.id("1"))
    await v.connect(carol.wallet).disputeClaim(0)
    await v.connect(dennis.wallet).resolveClaim(0, false, Z, Z)
    expect((await v.pendingClaims(0)).rejectedAt).to.be.greaterThan(0n)
    await expect(v.connect(bob.wallet).fileClaim(0, to1e18("100"), ethers.id("2"))).to.be.revertedWithCustomError(v, "TooEarly")
    await fastForwardTime(590)
    await expect(v.connect(bob.wallet).fileClaim(0, to1e18("100"), ethers.id("2"))).to.be.revertedWithCustomError(v, "TooEarly")
    await fastForwardTime(10)
    await v.connect(bob.wallet).fileClaim(0, to1e18("100"), ethers.id("2"))
  })

  it("L3: idle BTC is locked in Recovery Mode while commitments are reserved; the buffer is not", async () => {
    await openTrove(contracts, { musdAmount: "300000", ICR: "160", sender: eric.wallet })
    const v = await newVault(alice, to1e18("2"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await v.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("8000"), now + 600, 60)
    await alice.wallet.sendTransaction({ to: await v.getAddress(), value: to1e18("1") })
    await v.connect(alice.wallet).withdrawIdleBTC(to1e18("0.1")) // Normal Mode: fine
    await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("32000"))
    expect(await contracts.troveManager.checkRecoveryMode(await contracts.priceFeed.fetchPrice())).to.equal(true)
    await expect(v.connect(alice.wallet).withdrawIdleBTC(to1e18("0.1"))).to.be.revertedWithCustomError(v, "ReserveLocked")
    await v.connect(alice.wallet).withdrawMUSDBuffer(to1e18("100"), alice.address) // documented: allowed
    await expect(v.connect(bob.wallet).withdrawIdleBTC(1n)).to.be.revertedWithCustomError(v, "NotOwner")
    await v.connect(bob.wallet).closeCommitment(0) // reserved -> 0
    await v.connect(alice.wallet).withdrawIdleBTC(to1e18("0.9"))
    expect(await ethers.provider.getBalance(await v.getAddress())).to.equal(0n)
  })

  // ================================================================== L5

  it("L5a: recoveryTopUp without an active trove reverts NotActive (no overflow panic)", async () => {
    const v = await newVault(alice, 0n, 0n, false)
    await expect(v.recoveryTopUp(to1e18("100"), to1e18("50000"))).to.be.revertedWithCustomError(v, "NotActive")
  })

  it("L5b: two-step vault ownership transfer; the factory index follows; circuit stops honouring the old owner", async () => {
    const v1 = await newVault(alice, to1e18("1"), to1e18("2000"))
    const v2 = await newVault(alice, to1e18("1"), to1e18("2000"))
    const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
    const exp = (await getLatestBlockTimestamp()) + 30 * DAY
    await circuit.createCircle(300, 120)
    await addAndJoin(0, alice, v1, await line(v1, alice, "1000", exp))
    await addAndJoin(0, bob, vb, await line(vb, bob, "1000", exp))

    await expect(v1.connect(bob.wallet).transferOwnership(eric.address)).to.be.revertedWithCustomError(v1, "NotOwner")
    await expect(v1.connect(alice.wallet).transferOwnership(eric.address))
      .to.emit(v1, "OwnershipTransferStarted")
      .withArgs(alice.address, eric.address)
    expect(await v1.pendingOwner()).to.equal(eric.address)
    await expect(v1.connect(bob.wallet).acceptOwnership()).to.be.revertedWithCustomError(v1, "NotAuthorized")
    await expect(v1.connect(eric.wallet).acceptOwnership())
      .to.emit(v1, "OwnershipTransferred")
      .withArgs(alice.address, eric.address)
      .and.to.emit(factory, "VaultOwnerChanged")
      .withArgs(await v1.getAddress(), alice.address, eric.address)
    expect(await v1.owner()).to.equal(eric.address)
    expect(await v1.pendingOwner()).to.equal(Z)
    expect(await factory.vaultCount(alice.address)).to.equal(1n)
    expect(await factory.vaultsOf(alice.address, 0)).to.equal(await v2.getAddress())
    expect(await factory.vaultCount(eric.address)).to.equal(1n)
    expect(await factory.vaultsOf(eric.address, 0)).to.equal(await v1.getAddress())
    expect(await factory.allVaultsLength()).to.equal(3n)
    await expect(v1.connect(alice.wallet).withdrawIdleBTC(0n)).to.be.revertedWithCustomError(v1, "NotOwner")
    await v1.connect(eric.wallet).withdrawIdleBTC(0n)
    await expect(factory.connect(alice.wallet).onVaultOwnerChanged(alice.address, bob.address)).to.be.revertedWithCustomError(factory, "NotVault")

    // the old owner can no longer take on obligations against the transferred vault
    await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("10"), ethers.id("x"))
    await expect(circuit.connect(alice.wallet).acceptInvoice(0)).to.be.revertedWithCustomError(circuit, "NotMember")
  })

  it("only vaults cloned by the Par factory can back a clearing line (no look-alike contracts)", async () => {
    expect(await circuit.factory()).to.equal(await factory.getAddress())
    expect(await circuit.musd()).to.equal(await contracts.musd.getAddress())
    await circuit.connect(alice.wallet).createCircle(600, 60)
    // any contract that is not a factory clone is rejected before its answers are trusted
    await expect(circuit.connect(alice.wallet).addMember(0, bob.address, cAddr, 0)).to.be.revertedWithCustomError(circuit, "NotParVault")
    await expect(circuit.connect(alice.wallet).addMember(0, bob.address, await contracts.musd.getAddress(), 0)).to.be.revertedWithCustomError(circuit, "NotParVault")
  })

  it("L5d: membership is consent-based; removal and re-pointing need zero exposure", async () => {
    const va = await newVault(alice, to1e18("1"), to1e18("2000"))
    const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
    const vaAddr = await va.getAddress()
    const exp = (await getLatestBlockTimestamp()) + 30 * DAY
    const l0 = await line(va, alice, "1000", exp)
    const l1 = await line(va, alice, "1000", exp)
    await circuit.createCircle(300, 120)
    await expect(circuit.connect(alice.wallet).join(0, vaAddr, l0)).to.be.revertedWithCustomError(circuit, "NotInvited")
    await expect(circuit.addMember(0, alice.address, vaAddr, l0))
      .to.emit(circuit, "MemberInvited")
      .withArgs(0, alice.address, vaAddr, l0)
    expect((await circuit.members(0, alice.address)).active).to.equal(false) // admin alone cannot enrol anyone
    await expect(circuit.connect(alice.wallet).join(0, vaAddr, l1)).to.be.revertedWithCustomError(circuit, "NotInvited")
    await expect(circuit.connect(alice.wallet).join(0, vaAddr, l0)).to.emit(circuit, "MemberJoined").withArgs(0, alice.address, vaAddr, l0)
    await addAndJoin(0, bob, vb, await line(vb, bob, "1000", exp))
    expect(await circuit.members_(0)).to.deep.equal([alice.address, bob.address])

    await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("300"), ethers.id("1"))
    await circuit.connect(alice.wallet).acceptInvoice(0)
    // no re-pointing or removal with exposure
    await circuit.addMember(0, alice.address, vaAddr, l1)
    await expect(circuit.connect(alice.wallet).join(0, vaAddr, l1)).to.be.revertedWithCustomError(circuit, "HasObligations")
    await expect(circuit.removeMember(0, alice.address)).to.be.revertedWithCustomError(circuit, "HasObligations")
    await expect(circuit.connect(carol.wallet).removeMember(0, alice.address)).to.be.revertedWithCustomError(circuit, "NotAdmin")

    // settle cycle 0, then wait until neither the current nor the previous cycle has a net
    await fastForwardTime(301)
    await va.connect(alice.wallet).withdrawMUSDBuffer(to1e18("300"), alice.address)
    await contracts.musd.connect(alice.wallet).approve(cAddr, to1e18("300"))
    await circuit.connect(alice.wallet).settle(0, 0)
    await expect(circuit.connect(alice.wallet).join(0, vaAddr, l1)).to.be.revertedWithCustomError(circuit, "HasObligations") // prev-cycle net
    await fastForwardTime(300)
    await circuit.connect(alice.wallet).join(0, vaAddr, l1) // re-point
    expect((await circuit.members(0, alice.address)).lineId).to.equal(l1)
    expect(await circuit.lineBound(vaAddr, l0)).to.equal(false)
    expect(await circuit.lineBound(vaAddr, l1)).to.equal(true)
    // a member may leave; the line is freed for another circle
    await expect(circuit.connect(alice.wallet).removeMember(0, alice.address)).to.emit(circuit, "MemberRemoved").withArgs(0, alice.address)
    expect(await circuit.lineBound(vaAddr, l1)).to.equal(false)
    expect(await circuit.creditLimit(0, alice.address)).to.equal(0n)
    await expect(circuit.connect(bob.wallet).createInvoice(0, alice.address, 1n, ethers.id("2"))).to.be.revertedWithCustomError(circuit, "NotMember")
    // rejoining does not duplicate the member list
    await addAndJoin(0, alice, va, l0)
    expect(await circuit.members_(0)).to.deep.equal([alice.address, bob.address])
  })

  // ================================================================== Spec section 8 gaps

  describe("spec section 8 coverage", () => {
    it("I3: borrow and refinance revert if health fails afterwards", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("15000"), now + DAY, 60)
      await expect(v.connect(alice.wallet).borrow(to1e18("2000"), alice.address, Z, Z)).to.be.revertedWithCustomError(v, "Unhealthy")
      await v.connect(alice.wallet).borrow(to1e18("100"), alice.address, Z, Z)
      await v.connect(alice.wallet).refinance(Z, Z) // still healthy at $50k
      await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("40000"))
      await expect(v.connect(alice.wallet).refinance(Z, Z)).to.be.revertedWithCustomError(v, "Unhealthy")
      await expect(v.connect(alice.wallet).borrow(1n, alice.address, Z, Z)).to.be.revertedWithCustomError(v, "Unhealthy")
      await expect(v.connect(bob.wallet).borrow(1n, bob.address, Z, Z)).to.be.revertedWithCustomError(v, "NotOwner")
    })

    it("topUp (anyone, no new capacity), repay (owner, from vault MUSD), withdrawIdleBTC (owner)", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const [coll0, debt0, cap0] = await v.troveState()
      await v.connect(bob.wallet).topUp(Z, Z, { value: to1e18("0.5") })
      const [coll1, , cap1] = await v.troveState()
      expect(coll1 - coll0).to.equal(to1e18("0.5"))
      expect(cap1).to.equal(cap0) // safety, not capacity
      await expect(v.connect(bob.wallet).repay(to1e18("100"), Z, Z)).to.be.revertedWithCustomError(v, "NotOwner")
      await v.connect(alice.wallet).borrow(to1e18("500"), await v.getAddress(), Z, Z) // MUSD stays in the vault
      await v.connect(alice.wallet).repay(to1e18("500"), Z, Z)
      const [, debt2] = await v.troveState()
      expect(debt2 - debt0).to.be.lessThan(to1e18("1")) // only the fee + interest remain
      await alice.wallet.sendTransaction({ to: await v.getAddress(), value: to1e18("0.2") })
      await expect(v.connect(bob.wallet).withdrawIdleBTC(1n)).to.be.revertedWithCustomError(v, "NotOwner")
      await v.connect(alice.wallet).withdrawIdleBTC(to1e18("0.2"))
      expect(await ethers.provider.getBalance(await v.getAddress())).to.equal(0n)
    })

    it("partial last installment: triggerMissed pays the remaining cover and the commitment closes", async () => {
      const v = await newVault(alice, to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("100"), now + 60, 120, 10, 3, to1e18("250"), now + DAY)
      await fastForwardTime(60 + 240 + 11)
      await v.triggerMissed(0, 0, Z, Z)
      await v.triggerMissed(0, 1, Z, Z)
      await expect(v.triggerMissed(0, 2, Z, Z))
        .to.emit(v, "InstallmentMissed")
        .withArgs(0, 2, to1e18("50"))
        .and.to.emit(v, "Payout")
        .withArgs(0, bob.address, to1e18("50"), to1e18("50"), 0)
      const c = await v.getCommitment(0)
      expect(c.paidOut).to.equal(c.cap)
      expect(c.status).to.equal(2n)
      expect(await v.reserved()).to.equal(0n)
    })

    it("Recovery Mode via triggerMissed: needs the BTC reserve, then pays", async () => {
      await openTrove(contracts, { musdAmount: "300000", ICR: "160", sender: eric.wallet })
      const v = await newVault(alice, to1e18("2"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("3000"), now + 60, 120, 10, 2, to1e18("6000"), now + DAY)
      await v.connect(alice.wallet).withdrawMUSDBuffer(to1e18("2000"), alice.address)
      await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("32000"))
      const price = await contracts.priceFeed.fetchPrice()
      expect(await contracts.troveManager.checkRecoveryMode(price)).to.equal(true)
      await fastForwardTime(71)
      await expect(v.triggerMissed(0, 0, Z, Z)).to.be.revertedWithCustomError(v, "RecoveryModeNeedsReserve")
      expect(await v.installmentSettled(0, 0)).to.equal(false) // retryable
      const need = await v.recoveryTopUp(to1e18("3000"), price)
      await alice.wallet.sendTransaction({ to: await v.getAddress(), value: need + to1e18("0.001") })
      await expect(v.triggerMissed(0, 0, Z, Z)).to.emit(v, "Payout").withArgs(0, bob.address, to1e18("3000"), 0, to1e18("3000"))
    })

    it("Recovery Mode via drawLine (forceSettle): needs the BTC reserve, then the circuit is paid", async () => {
      await openTrove(contracts, { musdAmount: "300000", ICR: "160", sender: eric.wallet })
      const va = await newVault(alice, to1e18("2"), to1e18("2000"))
      const vb = await newVault(bob, to1e18("2"), to1e18("2000"))
      const exp = (await getLatestBlockTimestamp()) + 30 * DAY
      await circuit.createCircle(300, 120)
      await addAndJoin(0, alice, va, await line(va, alice, "3000", exp))
      await addAndJoin(0, bob, vb, await line(vb, bob, "3000", exp))
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("2500"), ethers.id("r"))
      await circuit.connect(alice.wallet).acceptInvoice(0)
      await va.connect(alice.wallet).withdrawMUSDBuffer(to1e18("2000"), alice.address)
      await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("30000"))
      const price = await contracts.priceFeed.fetchPrice()
      expect(await contracts.troveManager.checkRecoveryMode(price)).to.equal(true)
      await fastForwardTime(421)
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.be.revertedWithCustomError(va, "RecoveryModeNeedsReserve")
      expect(await circuit.settled(0, 0, alice.address)).to.equal(false)
      const need = await va.recoveryTopUp(to1e18("2500"), price)
      await alice.wallet.sendTransaction({ to: await va.getAddress(), value: need + to1e18("0.001") })
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z))
        .to.emit(circuit, "Settled")
        .withArgs(0, 0, alice.address, to1e18("2500"), true)
        .and.to.emit(va, "Payout")
        .withArgs(0, cAddr, to1e18("2500"), 0, to1e18("2500"))
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.emit(circuit, "Claimed").withArgs(0, 0, bob.address, to1e18("2500"))
    })

    it("settle / forceSettle / claim timing and authorization", async () => {
      const va = await newVault(alice, to1e18("1"), to1e18("2000"))
      const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
      const exp = (await getLatestBlockTimestamp()) + 30 * DAY
      await circuit.createCircle(300, 120)
      await addAndJoin(0, alice, va, await line(va, alice, "1000", exp))
      await addAndJoin(0, bob, vb, await line(vb, bob, "1000", exp))
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("200"), ethers.id("t"))
      await circuit.connect(alice.wallet).acceptInvoice(0)
      await va.connect(alice.wallet).withdrawMUSDBuffer(to1e18("200"), alice.address)
      await contracts.musd.connect(alice.wallet).approve(cAddr, to1e18("200"))

      await expect(circuit.connect(alice.wallet).settle(0, 0)).to.be.revertedWithCustomError(circuit, "NotYet") // before close
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.be.revertedWithCustomError(circuit, "NotYet")
      await fastForwardTime(301)
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.be.revertedWithCustomError(circuit, "NotYet") // in window
      await expect(circuit.connect(bob.wallet).settle(0, 0)).to.be.revertedWithCustomError(circuit, "Done") // creditor
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.be.revertedWithCustomError(circuit, "NotYet") // not collected
      await expect(circuit.connect(alice.wallet).claim(0, 0)).to.be.revertedWithCustomError(circuit, "Done") // debtor
      await circuit.connect(alice.wallet).settle(0, 0)
      await expect(circuit.connect(alice.wallet).settle(0, 0)).to.be.revertedWithCustomError(circuit, "Done")
      await fastForwardTime(121)
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.be.revertedWithCustomError(circuit, "Done")
      await circuit.connect(bob.wallet).claim(0, 0)
    })

    it("events: vault and circuit lifecycles emit what the indexer reads", async () => {
      const rc = await (await factory.connect(alice.wallet).createVault()).wait()
      const vAddr = rc.logs.find((l: any) => l.fragment?.name === "VaultCreated").args.vault
      await expect(rc).to.be.ok
      const v = await ethers.getContractAt("ParVault", vAddr)
      await expect(v.connect(alice.wallet).openTrove(to1e18("2000"), Z, Z, { value: to1e18("1") }))
        .to.emit(v, "TroveOpened")
        .withArgs(to1e18("1"), to1e18("2000"))
      const now = await getLatestBlockTimestamp()
      await expect(v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("100"), now + 60, 120, 10, 2, to1e18("200"), now + DAY))
        .to.emit(v, "CommitmentCreated")
        .withArgs(0, 0, bob.address, to1e18("200"), now + DAY)
      await expect(v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("500"), now + DAY, 60))
        .to.emit(v, "CommitmentCreated")
        .withArgs(1, 1, bob.address, to1e18("500"), now + DAY)
      await openTrove(contracts, { musdAmount: "2000", ICR: "400", sender: carol.wallet })
      await contracts.musd.connect(carol.wallet).approve(vAddr, to1e18("100"))
      await expect(v.connect(carol.wallet).payInstallment(0, 0)).to.emit(v, "InstallmentPaid").withArgs(0, 0, carol.address, to1e18("100"))
      await expect(v.connect(bob.wallet).fileClaim(1, to1e18("50"), ethers.id("ev"))).to.emit(v, "ClaimFiled").withArgs(1, to1e18("50"), ethers.id("ev"))
      await expect(v.connect(carol.wallet).disputeClaim(1)).to.emit(v, "ClaimDisputed").withArgs(1)
      await expect(v.connect(dennis.wallet).resolveClaim(1, true, Z, Z))
        .to.emit(v, "ClaimResolved")
        .withArgs(1, true)
        .and.to.emit(v, "Payout")
        .withArgs(1, bob.address, to1e18("50"), to1e18("50"), 0)
      await expect(v.connect(bob.wallet).closeCommitment(1)).to.emit(v, "CommitmentClosed").withArgs(1, to1e18("450"))

      await expect(circuit.connect(deployer.wallet).createCircle(300, 120)).to.emit(circuit, "CircleCreated").withArgs(0, deployer.address, 300, 120)
      const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
      const exp = (await getLatestBlockTimestamp()) + 30 * DAY
      await addAndJoin(0, alice, v, await line(v, alice, "1000", exp))
      await addAndJoin(0, bob, vb, await line(vb, bob, "1000", exp))
      await expect(circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("100"), ethers.id("i0")))
        .to.emit(circuit, "InvoiceCreated")
        .withArgs(0, 0, bob.address, alice.address, to1e18("100"), 0, ethers.id("i0"))
      await expect(circuit.connect(alice.wallet).acceptInvoice(0)).to.emit(circuit, "InvoiceAccepted").withArgs(0, 0, 0)
      await circuit.connect(bob.wallet).createInvoice(0, alice.address, to1e18("100"), ethers.id("i1"))
      await expect(circuit.connect(alice.wallet).rejectInvoice(1)).to.emit(circuit, "InvoiceRejected").withArgs(1)
      await fastForwardTime(421)
      await expect(circuit.forceSettle(0, 0, alice.address, Z, Z)).to.emit(circuit, "Settled").withArgs(0, 0, alice.address, to1e18("100"), true)
      await expect(circuit.connect(bob.wallet).claim(0, 0)).to.emit(circuit, "Claimed").withArgs(0, 0, bob.address, to1e18("100"))
      await expect(factory.connect(carol.wallet).createVault()).to.emit(factory, "VaultCreated").withArgs(carol.address, anyValue)
    })
  })
})

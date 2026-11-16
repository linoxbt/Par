import { expect } from "chai"
import { ethers } from "hardhat"
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs"
import { Contracts, fastForwardTime, getLatestBlockTimestamp, openTrove, setupTests, to1e18, User, Z } from "./helpers"

/**
 * ParMarket: cover requests with an escrowed MUSD premium, filled atomically from an
 * underwriter's ParVault (ParVault.fillRequest -> ParMarket.onFill). Mock MUSD system.
 *
 * Roles: alice = underwriter (vault owner), carol = requester (tenant / merchant, no BTC),
 * bob = beneficiary (landlord / supplier), dennis = arbiter, eric = outsider, whale = MUSD source.
 */
describe("ParMarket", () => {
  let contracts: Contracts
  let alice: User, bob: User, carol: User, dennis: User, eric: User, whale: User
  let factory: any
  let market: any
  let mAddr: string
  let musd: any

  const STRESS_BPS = 4000n
  const TARGET_ICR = to1e18("1.6")
  const DAY = 86400
  const REF = ethers.id("pilot:lagos-rent-001")

  async function newVault(owner: User, btc = to1e18("1"), seed = to1e18("2000")) {
    const rc = await (await factory.connect(owner.wallet).createVault()).wait()
    const log = rc.logs.find((l: any) => l.fragment?.name === "VaultCreated")
    const vault = await ethers.getContractAt("ParVault", log.args.vault)
    await vault.connect(owner.wallet).openTrove(seed, Z, Z, { value: btc })
    return vault
  }

  async function expectReservedInvariant(vault: any) {
    const n = Number(await vault.nextId())
    let sum = 0n
    for (let i = 0; i < n; i++) {
      const c = await vault.getCommitment(i)
      expect(c.paidOut).to.be.lessThanOrEqual(c.cap)
      if (Number(c.status) === 1) sum += (c.cap as bigint) - (c.paidOut as bigint)
    }
    expect(await vault.reserved()).to.equal(sum)
  }

  /** Rent: 12 x 500 MUSD monthly-ish (period 120 s), cover 1,500, premium 50, deadline = start. */
  async function requestRent(from: User = carol, o: Partial<Record<string, any>> = {}) {
    const now = await getLatestBlockTimestamp()
    const p = {
      beneficiary: bob.address,
      installment: to1e18("500"),
      start: now + 600,
      period: 120,
      grace: 10,
      count: 12,
      cap: to1e18("1500"),
      expiry: now + 30 * DAY,
      premium: to1e18("50"),
      deadline: now + 600,
      ref: REF,
      ...o,
    }
    const id = await market.nextRequestId()
    await market
      .connect(from.wallet)
      .requestScheduled(p.beneficiary, p.installment, p.start, p.period, p.grace, p.count, p.cap, p.expiry, p.premium, p.deadline, p.ref)
    return { id, p }
  }

  async function requestBond(from: User = carol, o: Partial<Record<string, any>> = {}) {
    const now = await getLatestBlockTimestamp()
    const p = {
      beneficiary: bob.address,
      arbiter: dennis.address,
      cap: to1e18("2000"),
      expiry: now + 30 * DAY,
      challengeWindow: 3600,
      premium: to1e18("80"),
      deadline: now + DAY,
      ref: ethers.id("supplier-bond"),
      ...o,
    }
    const id = await market.nextRequestId()
    await market
      .connect(from.wallet)
      .requestClaim(p.beneficiary, p.arbiter, p.cap, p.expiry, p.challengeWindow, p.premium, p.deadline, p.ref)
    return { id, p }
  }

  beforeEach(async () => {
    ;({ alice, bob, carol, dennis, eric, whale, contracts } = await setupTests())
    musd = contracts.musd
    factory = await (await ethers.getContractFactory("ParFactory")).deploy(
      await (await (await ethers.getContractFactory("ParVault")).deploy()).getAddress(),
      await contracts.borrowerOperations.getAddress(),
      await contracts.troveManager.getAddress(),
      await contracts.priceFeed.getAddress(),
      await musd.getAddress(),
      STRESS_BPS,
      TARGET_ICR,
    )
    market = await (await ethers.getContractFactory("ParMarket")).deploy(await factory.getAddress())
    mAddr = await market.getAddress()
    await openTrove(contracts, { musdAmount: "100000", ICR: "300", sender: whale.wallet })
    // the requesters have MUSD (no BTC needed) and approve the market for premiums
    for (const u of [carol, eric]) {
      await musd.connect(whale.wallet).transfer(u.address, to1e18("5000"))
      await musd.connect(u.wallet).approve(mAddr, ethers.MaxUint256)
    }
  })

  it("wires factory and MUSD", async () => {
    expect(await market.factory()).to.equal(await factory.getAddress())
    expect(await market.musd()).to.equal(await musd.getAddress())
  })

  // ------------------------------------------------------------------ happy paths

  it("scheduled: request escrows the premium; fill creates the guarantee and pays the underwriter", async () => {
    const c0 = await musd.balanceOf(carol.address)
    const { id, p } = await requestRent()
    expect(await musd.balanceOf(mAddr)).to.equal(p.premium)
    expect(c0 - (await musd.balanceOf(carol.address))).to.equal(p.premium)
    expect(await market.openCount()).to.equal(1n)
    const r = await market.getRequest(id)
    expect(r.requester).to.equal(carol.address)
    expect(r.kind).to.equal(0n)
    expect(r.status).to.equal(1n) // Open
    expect(r.ref).to.equal(REF)

    const v = await newVault(alice)
    const vAddr = await v.getAddress()
    const a0 = await musd.balanceOf(alice.address)
    const cid = await v.nextId()
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id))
      .to.emit(market, "RequestFilled")
      .withArgs(id, vAddr, cid, alice.address, p.premium)
      .and.to.emit(v, "CommitmentCreated")
      .withArgs(cid, 0, bob.address, p.cap, p.expiry)

    expect((await musd.balanceOf(alice.address)) - a0).to.equal(p.premium)
    expect(await musd.balanceOf(mAddr)).to.equal(0n)
    expect(await market.openCount()).to.equal(0n)

    const f = await market.getRequest(id)
    expect(f.status).to.equal(2n) // Filled
    expect(f.vault).to.equal(vAddr)
    expect(f.commitmentId).to.equal(cid)

    // certificate data
    const c = await v.getCommitment(cid)
    expect(c.kind).to.equal(0n)
    expect(c.status).to.equal(1n)
    expect(c.beneficiary).to.equal(bob.address)
    expect(c.principal).to.equal(carol.address)
    expect(c.arbiter).to.equal(Z)
    expect(c.cap).to.equal(p.cap)
    expect(c.expiry).to.equal(p.expiry)
    expect(c.installment).to.equal(p.installment)
    expect(c.start).to.equal(p.start)
    expect(c.period).to.equal(p.period)
    expect(c.grace).to.equal(p.grace)
    expect(c.count).to.equal(p.count)
    expect(await v.available(cid)).to.equal(p.cap)
    expect(await v.reserved()).to.equal(p.cap)
    await expectReservedInvariant(v)
  })

  it("claim: fill creates the bond with the requested arbiter and challenge window", async () => {
    const { id, p } = await requestBond()
    const v = await newVault(alice)
    const a0 = await musd.balanceOf(alice.address)
    await v.connect(alice.wallet).fillRequest(mAddr, id)
    expect((await musd.balanceOf(alice.address)) - a0).to.equal(p.premium)
    const c = await v.getCommitment(0)
    expect(c.kind).to.equal(1n)
    expect(c.beneficiary).to.equal(bob.address)
    expect(c.principal).to.equal(carol.address)
    expect(c.arbiter).to.equal(dennis.address)
    expect(c.cap).to.equal(p.cap)
    expect(c.expiry).to.equal(p.expiry)
    expect(c.challengeWindow).to.equal(p.challengeWindow)
    // the requester, as principal, can dispute; the arbiter decides
    await v.connect(bob.wallet).fileClaim(0, to1e18("700"), ethers.id("unpaid-delivery"))
    await v.connect(carol.wallet).disputeClaim(0)
    const b0 = await musd.balanceOf(bob.address)
    await v.connect(dennis.wallet).resolveClaim(0, true, Z, Z)
    expect((await musd.balanceOf(bob.address)) - b0).to.equal(to1e18("700"))
    await expectReservedInvariant(v)
  })

  it("zero premium requests work (nothing transferred)", async () => {
    const { id } = await requestRent(carol, { premium: 0n })
    expect(await musd.balanceOf(mAddr)).to.equal(0n)
    const v = await newVault(alice)
    const a0 = await musd.balanceOf(alice.address)
    await v.connect(alice.wallet).fillRequest(mAddr, id)
    expect(await musd.balanceOf(alice.address)).to.equal(a0)
    expect((await market.getRequest(id)).status).to.equal(2n)
  })

  it("missed installment on a market-filled guarantee pays the landlord from the underwriter's vault", async () => {
    const { id, p } = await requestRent()
    const v = await newVault(alice)
    const vAddr = await v.getAddress()
    await v.connect(alice.wallet).fillRequest(mAddr, id)
    // tenant pays installment #0 through the vault
    await musd.connect(carol.wallet).approve(vAddr, ethers.MaxUint256)
    await fastForwardTime(600)
    const b0 = await musd.balanceOf(bob.address)
    await v.connect(carol.wallet).payInstallment(0, 0)
    expect((await musd.balanceOf(bob.address)) - b0).to.equal(p.installment)
    // misses #1: anyone triggers after due + grace; the underwriter's vault pays
    await expect(v.connect(eric.wallet).triggerMissed(0, 1, Z, Z)).to.be.revertedWithCustomError(v, "TooEarly")
    await fastForwardTime(p.period + p.grace + 1)
    await expect(v.connect(eric.wallet).triggerMissed(0, 1, Z, Z))
      .to.emit(v, "Payout")
      .withArgs(0, bob.address, p.installment, anyValue, anyValue)
    expect((await musd.balanceOf(bob.address)) - b0).to.equal(2n * p.installment)
    expect((await v.getCommitment(0)).paidOut).to.equal(p.installment)
    expect(await v.reserved()).to.equal(p.cap - p.installment)
    await expectReservedInvariant(v)
  })

  // ------------------------------------------------------------------ cancel

  it("cancel: requester only, refunds the premium, then the request cannot be filled", async () => {
    const { id, p } = await requestRent()
    await expect(market.connect(eric.wallet).cancel(id)).to.be.revertedWithCustomError(market, "NotRequester")
    const c0 = await musd.balanceOf(carol.address)
    await expect(market.connect(carol.wallet).cancel(id)).to.emit(market, "RequestCancelled").withArgs(id)
    expect((await musd.balanceOf(carol.address)) - c0).to.equal(p.premium)
    expect(await musd.balanceOf(mAddr)).to.equal(0n)
    expect((await market.getRequest(id)).status).to.equal(3n)
    expect(await market.openCount()).to.equal(0n)
    await expect(market.connect(carol.wallet).cancel(id)).to.be.revertedWithCustomError(market, "NotOpen")
    const v = await newVault(alice)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "NotActive")
    expect(await v.nextId()).to.equal(0n)
  })

  it("a filled request cannot be cancelled or filled twice", async () => {
    const { id } = await requestBond()
    const v = await newVault(alice)
    const v2 = await newVault(eric)
    await v.connect(alice.wallet).fillRequest(mAddr, id)
    await expect(market.connect(carol.wallet).cancel(id)).to.be.revertedWithCustomError(market, "NotOpen")
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "NotActive")
    await expect(v2.connect(eric.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v2, "NotActive")
    expect(await v.nextId()).to.equal(1n)
    expect(await v2.nextId()).to.equal(0n)
  })

  it("non-existent request cannot be filled or cancelled", async () => {
    const v = await newVault(alice)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, 7)).to.be.revertedWithCustomError(v, "NotActive")
    await expect(market.connect(carol.wallet).cancel(7)).to.be.revertedWithCustomError(market, "NotRequester")
    expect((await market.getRequest(7)).status).to.equal(0n)
  })

  // ------------------------------------------------------------------ fill guards

  it("cannot fill after the deadline (premium stays refundable)", async () => {
    const now = await getLatestBlockTimestamp()
    const { id, p } = await requestBond(carol, { deadline: now + 100 })
    const v = await newVault(alice)
    await fastForwardTime(200)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(market, "Expired")
    expect(await v.nextId()).to.equal(0n)
    expect(await v.reserved()).to.equal(0n)
    const c0 = await musd.balanceOf(carol.address)
    await market.connect(carol.wallet).cancel(id)
    expect((await musd.balanceOf(carol.address)) - c0).to.equal(p.premium)
  })

  it("only factory vaults can call onFill: EOAs and look-alike contracts cannot take the premium", async () => {
    const { id } = await requestRent()
    await expect(market.connect(eric.wallet).onFill(id, 0)).to.be.revertedWithCustomError(market, "NotParVault")
    const fake = await (await ethers.getContractFactory("FakeMarketVault")).connect(eric.wallet).deploy()
    await expect(fake.connect(eric.wallet).attack(mAddr, id)).to.be.revertedWithCustomError(market, "NotParVault")
    // a real vault's owner cannot call onFill without creating the commitment either
    const v = await newVault(alice)
    await expect(market.connect(alice.wallet).onFill(id, 0)).to.be.revertedWithCustomError(market, "NotParVault")
    expect((await market.getRequest(id)).status).to.equal(1n)
    expect(await musd.balanceOf(mAddr)).to.equal(to1e18("50"))
    await v.connect(alice.wallet).fillRequest(mAddr, id) // still fillable
  })

  it("requester cannot fill their own request from their own vault", async () => {
    await musd.connect(whale.wallet).transfer(alice.address, to1e18("100"))
    await musd.connect(alice.wallet).approve(mAddr, ethers.MaxUint256)
    const { id } = await requestRent(alice)
    const v = await newVault(alice)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(market, "SelfFill")
    expect(await v.nextId()).to.equal(0n)
    expect(await v.reserved()).to.equal(0n)
  })

  it("only the vault owner can call fillRequest", async () => {
    const { id } = await requestRent()
    const v = await newVault(alice)
    await expect(v.connect(eric.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "NotOwner")
    await expect(v.connect(carol.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "NotOwner")
  })

  it("fill reverts atomically if the vault fails the stress test: premium stays escrowed, no commitment", async () => {
    // 1 BTC @ $50k stressed 40% = $30k; at 160% that supports ~18.7k debt, so 30k of cover fails
    const { id, p } = await requestRent(carol, { installment: to1e18("3000"), count: 10, cap: to1e18("30000") })
    const v = await newVault(alice)
    const a0 = await musd.balanceOf(alice.address)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "Unhealthy")
    expect(await v.nextId()).to.equal(0n)
    expect(await v.reserved()).to.equal(0n)
    expect(await musd.balanceOf(mAddr)).to.equal(p.premium)
    expect(await musd.balanceOf(alice.address)).to.equal(a0)
    expect((await market.getRequest(id)).status).to.equal(1n)
    // a bigger underwriter can take it
    const big = await newVault(eric, to1e18("3"))
    await big.connect(eric.wallet).fillRequest(mAddr, id)
    expect((await market.getRequest(id)).vault).to.equal(await big.getAddress())
  })

  it("vault creation rules still apply at fill time (arbiter may not be the underwriter)", async () => {
    const { id } = await requestBond(carol, { arbiter: alice.address })
    const v = await newVault(alice)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "BadParams")
    const v2 = await newVault(eric)
    await v2.connect(eric.wallet).fillRequest(mAddr, id)
  })

  it("a vault without an open trove cannot fill", async () => {
    const { id } = await requestRent()
    const rc = await (await factory.connect(alice.wallet).createVault()).wait()
    const v = await ethers.getContractAt("ParVault", rc.logs.find((l: any) => l.fragment?.name === "VaultCreated").args.vault)
    await expect(v.connect(alice.wallet).fillRequest(mAddr, id)).to.be.revertedWithCustomError(v, "Unhealthy")
  })

  it("direct createScheduled / createClaim behave as before", async () => {
    const v = await newVault(alice)
    const now = await getLatestBlockTimestamp()
    await expect(v.connect(eric.wallet).createClaim(bob.address, carol.address, dennis.address, 1n, now + DAY, 60))
      .to.be.revertedWithCustomError(v, "NotOwner")
    await expect(v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("1"), now - 1, 60, 0, 1, to1e18("1"), now + DAY))
      .to.be.revertedWithCustomError(v, "BadParams")
    await v.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("100"), now + 60, 60, 0, 2, to1e18("200"), now + DAY)
    await v.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("100"), now + DAY, 60)
    expect(await v.nextId()).to.equal(2n)
  })

  // ------------------------------------------------------------------ request validation

  describe("request validation mirrors the vault", () => {
    let now: number
    beforeEach(async () => {
      now = await getLatestBlockTimestamp()
    })

    const badRent = async (o: Record<string, any>) =>
      expect(requestRent(carol, o)).to.be.revertedWithCustomError(market, "BadParams")
    const badBond = async (o: Record<string, any>) =>
      expect(requestBond(carol, o)).to.be.revertedWithCustomError(market, "BadParams")

    it("scheduled", async () => {
      await badRent({ beneficiary: Z })
      await badRent({ beneficiary: carol.address }) // self-cover
      await badRent({ installment: 0n })
      await badRent({ count: 0 })
      await badRent({ period: 0 })
      await badRent({ cap: 0n })
      await badRent({ cap: to1e18("6000") + 1n }) // > installment x count
      await badRent({ start: now - 10, deadline: now - 10 })
      // expiry must cover lastDue + grace + MIN_TRIGGER_WINDOW
      const start = now + 600
      const minExpiry = start + 11 * 120 + 10 + 300
      await badRent({ start, expiry: minExpiry - 1 })
      await badRent({ deadline: now - 1 })
      await badRent({ start, deadline: start + 1 }) // the vault requires start >= now at creation
      // boundaries are accepted
      await requestRent(carol, { start, expiry: minExpiry, cap: to1e18("6000"), deadline: start })
    })

    it("claim", async () => {
      await badBond({ beneficiary: Z })
      await badBond({ beneficiary: carol.address })
      await badBond({ arbiter: Z })
      await badBond({ arbiter: bob.address }) // = beneficiary
      await badBond({ arbiter: carol.address }) // = principal
      await badBond({ cap: 0n })
      await badBond({ expiry: now, deadline: now })
      await badBond({ challengeWindow: 59 })
      await badBond({ deadline: now - 1 })
      await badBond({ expiry: now + DAY, deadline: now + DAY }) // must be fillable while live
      await requestBond(carol, { challengeWindow: 60, expiry: now + DAY, deadline: now + DAY - 1 })
    })

    it("premium must be approved and funded", async () => {
      await musd.connect(eric.wallet).approve(mAddr, 0)
      await expect(requestRent(eric)).to.be.revertedWithCustomError(musd, "ERC20InsufficientAllowance")
      await musd.connect(eric.wallet).approve(mAddr, ethers.MaxUint256)
      await expect(requestRent(eric, { premium: to1e18("5001") })).to.be.revertedWithCustomError(musd, "ERC20InsufficientBalance")
      expect(await market.nextRequestId()).to.equal(0n)
    })
  })

  // ------------------------------------------------------------------ invariant

  it("reserved invariant holds across market fills, direct commitments, payouts and closes", async () => {
    const v = await newVault(alice, to1e18("2"))
    const now = await getLatestBlockTimestamp()
    const r1 = await requestRent()
    const r2 = await requestBond()
    const r3 = await requestRent(eric, { beneficiary: dennis.address, premium: to1e18("10") })
    await v.connect(alice.wallet).createClaim(eric.address, bob.address, dennis.address, to1e18("1000"), now + DAY, 60)
    await v.connect(alice.wallet).fillRequest(mAddr, r1.id)
    await expectReservedInvariant(v)
    await v.connect(alice.wallet).fillRequest(mAddr, r2.id)
    await expectReservedInvariant(v)
    await v.connect(alice.wallet).fillRequest(mAddr, r3.id)
    await expectReservedInvariant(v)
    expect(await v.reserved()).to.equal(to1e18("1000") + to1e18("1500") + to1e18("2000") + to1e18("1500"))
    // claim on the bond (commitment #2), landlord releases rent #3 early, rent #1 misses
    await v.connect(bob.wallet).fileClaim(2, to1e18("500"), ethers.id("x"))
    await fastForwardTime(3601)
    await v.executeClaim(2, Z, Z)
    await expectReservedInvariant(v)
    await v.connect(dennis.wallet).closeCommitment(3)
    await expectReservedInvariant(v)
    await fastForwardTime(600 + 10)
    await v.triggerMissed(1, 0, Z, Z)
    await expectReservedInvariant(v)
    expect(await market.openCount()).to.equal(0n)
    expect(await musd.balanceOf(mAddr)).to.equal(0n)
  })
})

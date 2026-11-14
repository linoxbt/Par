import { expect } from "chai"
import { ethers } from "hardhat"
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
 * Port of the spec's Appendix B integration suite, run against MockMUSDSystem
 * (a model of the MUSD rules Par depends on), plus the section 8.2 additions.
 * The same suite runs unchanged against the real MUSD contracts via
 * scripts/run-musd-integration.sh (see integration/Par.test.ts).
 */
describe("Par", () => {
  let contracts: Contracts
  let alice: User
  let bob: User
  let carol: User
  let dennis: User
  let eric: User
  let whale: User
  let deployer: User
  let factory: any
  let circuit: any

  const STRESS_BPS = 4000n // survive a 40% BTC drop
  const TARGET_ICR = to1e18("1.6") // and still be >= 160%

  async function newVault(owner: User, btc: bigint, seed: bigint) {
    const tx = await factory.connect(owner.wallet).createVault()
    const rc = await tx.wait()
    const log = rc.logs.find((l: any) => l.fragment?.name === "VaultCreated")
    const vault = await ethers.getContractAt("ParVault", log.args.vault)
    await vault.connect(owner.wallet).openTrove(seed, Z, Z, { value: btc })
    return vault
  }

  // Consent-based membership: admin invites, member joins with the same vault + line.
  async function addAndJoin(circleId: number, member: User, vault: any, lineId: number) {
    const v = await vault.getAddress()
    await circuit.connect(deployer.wallet).addMember(circleId, member.address, v, lineId)
    await circuit.connect(member.wallet).join(circleId, v, lineId)
  }

  beforeEach(async () => {
    ;({ alice, bob, carol, dennis, eric, whale, deployer, contracts } = await setupTests())

    const F = await ethers.getContractFactory("ParFactory")
    factory = await F.deploy(
      await contracts.borrowerOperations.getAddress(),
      await contracts.troveManager.getAddress(),
      await contracts.priceFeed.getAddress(),
      await contracts.musd.getAddress(),
      STRESS_BPS,
      TARGET_ICR,
    )
    const C = await ethers.getContractFactory("ParCircuit")
    circuit = await C.deploy(await factory.getAddress())

    // background system debt so TCR is realistic
    await openTrove(contracts, { musdAmount: "100000", ICR: "300", sender: whale.wallet })
  })

  // ------------------------------------------------------------------ Appendix B (6 tests)

  it("rent guarantee: missed installment is paid from buffer, then minted from the trove", async () => {
    // alice = guarantor/tenant vault owner, bob = landlord, carol = tenant paying installments
    const vault = await newVault(alice, to1e18("1"), to1e18("2000")) // 1 BTC @ $50k, 2,000 MUSD seed
    const now = await getLatestBlockTimestamp()
    const period = 120
    await vault
      .connect(alice.wallet)
      .createScheduled(bob.address, carol.address, to1e18("1500"), now + 60, period, 10, 12, to1e18("6000"), now + 86400 * 30)
    expect(await vault.reserved()).to.equal(to1e18("6000"))

    // carol gets MUSD from her own trove and pays installment #0
    await openTrove(contracts, { musdAmount: "5000", ICR: "400", sender: carol.wallet })
    await contracts.musd.connect(carol.wallet).approve(await vault.getAddress(), to1e18("1500"))
    await vault.connect(carol.wallet).payInstallment(0, 0)

    // installment #1 missed -> buffer pays 1,500 (no new debt)
    await fastForwardTime(60 + period + 11)
    const debtBefore = (await vault.troveState()).debt
    await expect(vault.triggerMissed(0, 1, Z, Z)).to.emit(vault, "Payout")
    // debt only moves by accrued interest, not by a new draw
    expect((await vault.troveState()).debt - debtBefore).to.be.lessThan(to1e18("1"))

    // installment #2 missed -> 500 from buffer + 1,000 minted
    await fastForwardTime(period)
    const bobBefore = await contracts.musd.balanceOf(bob.address)
    await expect(vault.triggerMissed(0, 2, Z, Z))
      .to.emit(vault, "Payout")
      .withArgs(0, bob.address, to1e18("1500"), to1e18("500"), to1e18("1000"))
    expect((await contracts.musd.balanceOf(bob.address)) - bobBefore).to.equal(to1e18("1500"))
    const debtAfter = (await vault.troveState()).debt
    expect(debtAfter - debtBefore).to.be.greaterThan(to1e18("1000"))

    // double trigger blocked; early trigger blocked
    await expect(vault.triggerMissed(0, 2, Z, Z)).to.be.revertedWithCustomError(vault, "AlreadySettled")
    await expect(vault.triggerMissed(0, 5, Z, Z)).to.be.revertedWithCustomError(vault, "TooEarly")
    expect(await vault.reserved()).to.equal(to1e18("3000"))
  })

  it("rejects a commitment that would not survive the stress test", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    // 1 BTC @ $50k, stressed $30k, need >=160% -> max total debt ~ $18.75k
    await expect(
      vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("20000"), now + 86400, 3600),
    ).to.be.revertedWithCustomError(vault, "Unhealthy")
    await vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("10000"), now + 86400, 3600)
  })

  it("owner cannot pull collateral out from under live commitments", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("12000"), now + 86400, 3600)
    await expect(vault.connect(alice.wallet).withdrawCollateral(to1e18("0.5"), Z, Z)).to.be.revertedWithCustomError(
      vault,
      "Unhealthy",
    )
    await expect(vault.connect(alice.wallet).closeTrove()).to.be.revertedWithCustomError(vault, "ReservedCommitments")
  })

  it("discretionary claim: undisputed claim executes after the challenge window", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("5000"), now + 86400, 3600)
    await vault.connect(bob.wallet).fileClaim(0, to1e18("4000"), ethers.id("evidence"))
    await expect(vault.executeClaim(0, Z, Z)).to.be.revertedWithCustomError(vault, "TooEarly")
    await fastForwardTime(3601)
    const before = await contracts.musd.balanceOf(bob.address)
    await vault.executeClaim(0, Z, Z)
    expect((await contracts.musd.balanceOf(bob.address)) - before).to.equal(to1e18("4000"))
  })

  it("recovery mode: draw needs a BTC top-up from the vault's idle reserve", async () => {
    // a risky trove drags the system toward Recovery Mode
    await openTrove(contracts, { musdAmount: "300000", ICR: "160", sender: eric.wallet })
    const vault = await newVault(alice, to1e18("2"), to1e18("2000")) // very healthy vault
    const now = await getLatestBlockTimestamp()
    await vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("8000"), now + 86400, 60)
    // drain buffer so the claim must mint
    await vault.connect(alice.wallet).withdrawMUSDBuffer(to1e18("2000"), alice.address)

    // price drop -> TCR < 150%
    await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("32000"))
    const price = await contracts.priceFeed.fetchPrice()
    expect(await contracts.troveManager.checkRecoveryMode(price)).to.equal(true)

    await vault.connect(bob.wallet).fileClaim(0, to1e18("3000"), ethers.id("e"))
    await fastForwardTime(61)
    await expect(vault.executeClaim(0, Z, Z)).to.be.revertedWithCustomError(vault, "RecoveryModeNeedsReserve")

    const need = await vault.recoveryTopUp(to1e18("3000"), price)
    await alice.wallet.sendTransaction({ to: await vault.getAddress(), value: need + to1e18("0.001") })
    const before = await contracts.musd.balanceOf(bob.address)
    await vault.executeClaim(0, Z, Z)
    expect((await contracts.musd.balanceOf(bob.address)) - before).to.equal(to1e18("3000"))
  })

  it("Circuit: 2,900 MUSD of invoices settle with 100 MUSD, defaulter is force-settled from their line", async () => {
    const va = await newVault(alice, to1e18("1"), to1e18("2000"))
    const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
    const vc = await newVault(carol, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    const cAddr = await circuit.getAddress()
    for (const [v, u] of [
      [va, alice],
      [vb, bob],
      [vc, carol],
    ] as const) {
      await v.connect(u.wallet).createClearingLine(cAddr, to1e18("5000"), now + 86400 * 30)
    }
    await circuit.connect(deployer.wallet).createCircle(300, 120) // 5-min cycle, 2-min settle window
    await addAndJoin(0, alice, va, 0)
    await addAndJoin(0, bob, vb, 0)
    await addAndJoin(0, carol, vc, 0)

    // bob owes alice 1000, carol owes bob 1000, alice owes carol 900
    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("1000"), ethers.id("inv1"))
    await circuit.connect(bob.wallet).createInvoice(0, carol.address, to1e18("1000"), ethers.id("inv2"))
    await circuit.connect(carol.wallet).createInvoice(0, alice.address, to1e18("900"), ethers.id("inv3"))
    await circuit.connect(bob.wallet).acceptInvoice(0)
    await circuit.connect(carol.wallet).acceptInvoice(1)
    await circuit.connect(alice.wallet).acceptInvoice(2)

    expect(await circuit.gross(0, 0)).to.equal(to1e18("2900"))
    expect(await circuit.totalOwed(0, 0)).to.equal(to1e18("100"))
    expect(await circuit.nettingEfficiencyBps(0, 0)).to.equal(9655n)

    // over-limit invoice rejected
    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("6000"), ethers.id("big"))
    await expect(circuit.connect(bob.wallet).acceptInvoice(3)).to.be.revertedWithCustomError(circuit, "OverLimit")

    // cycle closes; carol (net -100) does not settle; window passes
    await fastForwardTime(300 + 121)
    await expect(circuit.connect(alice.wallet).claim(0, 0)).to.be.reverted // alice can't claim before collection
    await circuit.forceSettle(0, 0, carol.address, Z, Z)
    const before = await contracts.musd.balanceOf(alice.address)
    await circuit.connect(alice.wallet).claim(0, 0)
    expect((await contracts.musd.balanceOf(alice.address)) - before).to.equal(to1e18("100"))
  })

  // ------------------------------------------------------------------ Section 8.2 additions

  it("dispute path: resolveClaim(false) leaves the cap intact; resolveClaim(true) pays", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await vault.connect(alice.wallet).createClaim(bob.address, carol.address, dennis.address, to1e18("5000"), now + 86400, 3600)

    await vault.connect(bob.wallet).fileClaim(0, to1e18("3000"), ethers.id("bad"))
    await expect(vault.connect(eric.wallet).disputeClaim(0)).to.be.revertedWithCustomError(vault, "NotAuthorized")
    await vault.connect(carol.wallet).disputeClaim(0) // principal disputes
    // a disputed claim waits for the arbiter (until the resolve deadline)
    await expect(vault.executeClaim(0, Z, Z)).to.be.revertedWithCustomError(vault, "TooEarly")
    await expect(vault.connect(bob.wallet).resolveClaim(0, true, Z, Z)).to.be.revertedWithCustomError(vault, "NotAuthorized")
    await vault.connect(dennis.wallet).resolveClaim(0, false, Z, Z)
    expect(await vault.available(0)).to.equal(to1e18("5000"))
    expect(await vault.reserved()).to.equal(to1e18("5000"))

    // refiling right after a rejection is blocked for one challenge window
    await expect(vault.connect(bob.wallet).fileClaim(0, to1e18("2000"), ethers.id("good"))).to.be.revertedWithCustomError(vault, "TooEarly")
    await fastForwardTime(3600)
    await vault.connect(bob.wallet).fileClaim(0, to1e18("2000"), ethers.id("good"))
    await vault.connect(alice.wallet).disputeClaim(0) // owner may also dispute
    const before = await contracts.musd.balanceOf(bob.address)
    await vault.connect(dennis.wallet).resolveClaim(0, true, Z, Z)
    expect((await contracts.musd.balanceOf(bob.address)) - before).to.equal(to1e18("2000"))
    expect(await vault.available(0)).to.equal(to1e18("3000"))

    // dispute after the window is too late
    await vault.connect(bob.wallet).fileClaim(0, to1e18("1000"), ethers.id("late"))
    await fastForwardTime(3601)
    await expect(vault.connect(carol.wallet).disputeClaim(0)).to.be.revertedWithCustomError(vault, "TooLate")
  })

  it("closeCommitment: beneficiary early release, anyone after expiry; then closeTrove works", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("4000"), now + 3600, 60)
    await vault
      .connect(alice.wallet)
      .createScheduled(bob.address, carol.address, to1e18("500"), now + 60, 120, 10, 3, to1e18("1500"), now + 7200)
    expect(await vault.reserved()).to.equal(to1e18("5500"))

    // nobody but the beneficiary can release early
    await expect(vault.connect(alice.wallet).closeCommitment(0)).to.be.revertedWithCustomError(vault, "NotAuthorized")
    await expect(vault.connect(bob.wallet).closeCommitment(0)).to.emit(vault, "CommitmentClosed").withArgs(0, to1e18("4000"))
    expect(await vault.reserved()).to.equal(to1e18("1500"))

    // after expiry anyone can close
    await expect(vault.connect(eric.wallet).closeCommitment(1)).to.be.revertedWithCustomError(vault, "NotAuthorized")
    await fastForwardTime(7201)
    await vault.connect(eric.wallet).closeCommitment(1)
    expect(await vault.reserved()).to.equal(0n)

    // vault can now close its trove: it holds 2,000 seed, needs debt - 200 (top up for fee + interest)
    const [, debt] = await vault.troveState()
    await openTrove(contracts, { musdAmount: "2000", ICR: "400", sender: carol.wallet })
    await contracts.musd.connect(carol.wallet).transfer(await vault.getAddress(), debt - to1e18("2000"))
    const btcBefore = await ethers.provider.getBalance(alice.address)
    const tx = await vault.connect(alice.wallet).closeTrove()
    const rc = await tx.wait()
    const gas = rc!.gasUsed * rc!.gasPrice
    expect((await ethers.provider.getBalance(alice.address)) + gas - btcBefore).to.equal(to1e18("1"))
  })

  it("open claim blocks closing after expiry until resolved", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("4000"), now + 600, 60)
    await vault.connect(bob.wallet).fileClaim(0, to1e18("1000"), ethers.id("x"))
    await fastForwardTime(601)
    await expect(vault.connect(eric.wallet).closeCommitment(0)).to.be.revertedWithCustomError(vault, "ClaimOpen")
    await expect(vault.connect(bob.wallet).closeCommitment(0)).to.be.revertedWithCustomError(vault, "ClaimOpen")
    await vault.executeClaim(0, Z, Z)
    await vault.connect(eric.wallet).closeCommitment(0)
    expect(await vault.reserved()).to.equal(0n)
  })

  it("interest accrual over 30 days doesn't break health for the demo parameters", async () => {
    // spec worked example: 0.1 BTC at $100,000, seed 1,800
    await contracts.mockAggregator.connect(deployer.wallet).setPrice(to1e18("100000"))
    const vault = await newVault(alice, to1e18("0.1"), to1e18("1800"))
    const now = await getLatestBlockTimestamp()
    // 3 months of 500 MUSD rent
    await vault
      .connect(alice.wallet)
      .createScheduled(bob.address, carol.address, to1e18("500"), now + 86400, 86400 * 30, 86400 * 3, 3, to1e18("1500"), now + 86400 * 120)
    const [ok0] = await vault.health(0)
    expect(ok0).to.equal(true)
    await fastForwardTime(86400 * 30)
    const [ok, stressedIcr] = await vault.health(0)
    expect(ok).to.equal(true)
    expect(stressedIcr).to.be.greaterThanOrEqual(TARGET_ICR)
    // worked-example room is ~1,746 MUSD of cover: 1,500 used, another 1,000 does not fit
    await expect(
      vault.connect(alice.wallet).createClaim(bob.address, alice.address, dennis.address, to1e18("1000"), now + 86400 * 60, 60),
    ).to.be.revertedWithCustomError(vault, "Unhealthy")
  })

  it("Circuit: previous-cycle unsettled amounts count toward the line limit", async () => {
    const va = await newVault(alice, to1e18("1"), to1e18("2000"))
    const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    const cAddr = await circuit.getAddress()
    await va.connect(alice.wallet).createClearingLine(cAddr, to1e18("5000"), now + 86400 * 30)
    await vb.connect(bob.wallet).createClearingLine(cAddr, to1e18("3000"), now + 86400 * 30)
    await circuit.connect(deployer.wallet).createCircle(300, 120)
    await addAndJoin(0, alice, va, 0)
    await addAndJoin(0, bob, vb, 0)

    // cycle 0: bob owes alice 2,000
    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("2000"), ethers.id("c0"))
    await circuit.connect(bob.wallet).acceptInvoice(0)

    // cycle 1 (cycle 0 still in its settle window, bob hasn't paid): 1,500 more would make 3,500 > 3,000
    await fastForwardTime(301)
    expect(await circuit.currentCycle(0)).to.equal(1n)
    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("1500"), ethers.id("c1"))
    await expect(circuit.connect(bob.wallet).acceptInvoice(1)).to.be.revertedWithCustomError(circuit, "OverLimit")

    // once bob settles cycle 0 voluntarily, the same amount fits
    await contracts.musd.connect(bob.wallet).approve(cAddr, to1e18("2000"))
    await vb.connect(bob.wallet).withdrawMUSDBuffer(to1e18("2000"), bob.address)
    await circuit.connect(bob.wallet).settle(0, 0)
    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("1500"), ethers.id("c1b"))
    await circuit.connect(bob.wallet).acceptInvoice(2)
    await circuit.connect(alice.wallet).claim(0, 0)
    await expect(circuit.connect(alice.wallet).claim(0, 0)).to.be.revertedWithCustomError(circuit, "Done")
  })

  it("stale invoices from a closed cycle cannot be accepted; reject works for either party", async () => {
    const va = await newVault(alice, to1e18("1"), to1e18("2000"))
    const vb = await newVault(bob, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    const cAddr = await circuit.getAddress()
    await va.connect(alice.wallet).createClearingLine(cAddr, to1e18("5000"), now + 86400 * 30)
    await vb.connect(bob.wallet).createClearingLine(cAddr, to1e18("5000"), now + 86400 * 30)
    await circuit.connect(deployer.wallet).createCircle(300, 120)
    await addAndJoin(0, alice, va, 0)
    await addAndJoin(0, bob, vb, 0)

    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("100"), ethers.id("a"))
    await circuit.connect(alice.wallet).createInvoice(0, bob.address, to1e18("100"), ethers.id("b"))
    await circuit.connect(alice.wallet).rejectInvoice(1)
    await expect(circuit.connect(bob.wallet).acceptInvoice(1)).to.be.revertedWithCustomError(circuit, "BadParams")
    await fastForwardTime(301)
    await expect(circuit.connect(bob.wallet).acceptInvoice(0)).to.be.revertedWithCustomError(circuit, "WrongCycle")
  })

  it("only the circuit can draw a clearing line; addMember checks ownership and line target", async () => {
    const va = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    const cAddr = await circuit.getAddress()
    await va.connect(alice.wallet).createClearingLine(cAddr, to1e18("5000"), now + 86400)
    // a line must point at a contract; a line to some other contract is not this circuit's
    await expect(va.connect(alice.wallet).createClearingLine(eric.address, to1e18("1000"), now + 86400)).to.be.revertedWithCustomError(
      va,
      "BadParams",
    )
    await va.connect(alice.wallet).createClearingLine(await factory.getAddress(), to1e18("1000"), now + 86400)
    await expect(va.connect(alice.wallet).drawLine(0, to1e18("1"), Z, Z)).to.be.revertedWithCustomError(va, "NotAuthorized")
    await circuit.connect(deployer.wallet).createCircle(300, 120)
    await expect(
      circuit.connect(alice.wallet).addMember(0, alice.address, await va.getAddress(), 0),
    ).to.be.revertedWithCustomError(circuit, "NotAdmin")
    await expect(
      circuit.connect(deployer.wallet).addMember(0, bob.address, await va.getAddress(), 0),
    ).to.be.revertedWithCustomError(circuit, "BadParams")
    await expect(
      circuit.connect(deployer.wallet).addMember(0, alice.address, await va.getAddress(), 1),
    ).to.be.revertedWithCustomError(circuit, "BadParams")
  })

  it("clones are initialized once; the implementation is locked", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    await expect(
      vault.initialize(alice.address, Z, Z, Z, Z, STRESS_BPS, TARGET_ICR),
    ).to.be.revertedWithCustomError(vault, "AlreadyInitialized")
    const impl = await ethers.getContractAt("ParVault", await factory.implementation())
    await expect(impl.initialize(alice.address, Z, Z, Z, Z, STRESS_BPS, TARGET_ICR)).to.be.revertedWithCustomError(
      impl,
      "AlreadyInitialized",
    )
    expect(await factory.vaultCount(alice.address)).to.equal(1n)
    expect(await factory.vaultsOf(alice.address, 0)).to.equal(await vault.getAddress())
  })

  it("payInstallment settles an index once and is gated to scheduled commitments", async () => {
    const vault = await newVault(alice, to1e18("1"), to1e18("2000"))
    const now = await getLatestBlockTimestamp()
    await vault
      .connect(alice.wallet)
      .createScheduled(bob.address, carol.address, to1e18("100"), now + 60, 120, 10, 2, to1e18("200"), now + 86400)
    await openTrove(contracts, { musdAmount: "2000", ICR: "400", sender: carol.wallet })
    await contracts.musd.connect(carol.wallet).approve(await vault.getAddress(), to1e18("1000"))
    await vault.connect(carol.wallet).payInstallment(0, 0)
    await expect(vault.connect(carol.wallet).payInstallment(0, 0)).to.be.revertedWithCustomError(vault, "AlreadySettled")
    await expect(vault.connect(carol.wallet).payInstallment(0, 2)).to.be.revertedWithCustomError(vault, "BadParams")
    await fastForwardTime(60 + 11)
    await expect(vault.triggerMissed(0, 0, Z, Z)).to.be.revertedWithCustomError(vault, "AlreadySettled")
    // coverCap above installment * count is rejected
    await expect(
      vault.connect(alice.wallet).createScheduled(bob.address, carol.address, to1e18("100"), now + 60, 120, 10, 2, to1e18("201"), now + 86400),
    ).to.be.revertedWithCustomError(vault, "BadParams")
  })
})

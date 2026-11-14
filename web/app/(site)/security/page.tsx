import type { Metadata } from "next"
import { GaugeIllustration, LockIllustration, ShieldIllustration } from "@/components/landing/Illustrations"
import { DocHero, DocSection, Mono, NextLink, Pre, Table } from "@/components/landing/Doc"

export const metadata: Metadata = {
  title: "Security",
  description: "How Par decides a promise fits (the BTC −40% stress test), how payouts are funded, how Recovery Mode is handled, and where it can fail. Testnet, unaudited.",
  alternates: { canonical: "/security" },
}

export default function Security() {
  return (
    <div>
      <DocHero kicker="Security" title="Risk," muted="in the open." sub="A promise is only as good as the numbers behind it. Here is exactly how Par decides a promise fits, how it pays, and where it can fail.">
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Stress-tested", "BTC −40%, every promise called, still ≥ 160%.", <GaugeIllustration key="g" />],
            ["Non-custodial", "Your vault is your contract. Immutable clones, no admin.", <LockIllustration key="l" />],
            ["A plan for Recovery Mode", "Payouts that need new debt add BTC from a reserve you keep in the vault. If it's short, they wait.", <ShieldIllustration key="s" />],
          ].map(([t, d, ill]) => (
            <div key={t as string} className="flex flex-col items-center rounded-3xl bg-soft px-6 pb-7 pt-5 text-center">
              <div className="h-32 w-full max-w-[220px]">{ill}</div>
              <div className="mt-2 font-medium">{t}</div>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </DocHero>

      <DocSection id="health" n="01" title="The health check">
        <p className="mb-4 text-sm text-muted">Every new commitment, and every owner action that could weaken the vault, must pass both checks:</p>
        <Pre>{`need      = reserved + newCap + borrowingFee(reserved + newCap)
(a) cap   : debt + need <= maxBorrowingCapacity        // MUSD capacity, fixed at open
(b) stress: coll × price × (1 − 40%) / (debt + need) >= 160%
ok = (a) && (b)                                       // the MUSD buffer is ignored (conservative)`}</Pre>
        <p className="mt-4 text-sm text-muted">
          The certificate&apos;s &ldquo;holds even if BTC falls X%&rdquo; is <Mono>1 − 1.5 × (debt + need) / (coll × price)</Mono>: the drop at which the vault would reach 150% after every promise is called.
        </p>
      </DocSection>

      <DocSection id="waterfall" n="02" title="Payout waterfall">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["1", "Buffer", "Pay from the vault's liquid MUSD (the 1,800 seed and any repayments). No new debt."],
            ["2", "Normal Mode", "Mint the shortfall from the trove with withdrawMUSD, under the capacity snapshot. If that draw alone would take the trove below 110% or the system below 150%, add BTC from the idle reserve with it."],
            ["3", "Recovery Mode", "Add collateral from the idle BTC held in the vault as a reserve so the ratio improves, then draw. If the reserve is short, revert with the BTC needed; the keeper alerts the owner and retries."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-btc font-mono text-xs text-fg">{n}</span>
              <div className="mt-4 font-medium">{t}</div>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection n="03" title="Invariants">
        <Table
          head={["", "Invariant"]}
          rows={[
            ["I1", "reserved = Σ (cap − paidOut) over active commitments"],
            ["I2", "A commitment can only be created when health(cap).ok"],
            ["I3", "Owner actions that weaken the trove revert if health fails afterwards"],
            ["I4", "paidOut ≤ cap. A commitment closes itself when fully paid"],
            ["I5", "closeTrove requires reserved == 0"],
            ["I6", "Each installment index settles once, by payment or by trigger"],
          ]}
        />
      </DocSection>

      <DocSection n="04" title="Known limits">
        <ul className="space-y-4 text-sm">
          {[
            ["Price can fall after a promise is made.", "Health then fails: no new promises and no weakening actions, but existing promises are still honored. The keeper alerts the owner."],
            ["Liquidation.", "If BTC falls past the stress level and the trove drops below 110%, it can be liquidated and its promises fail. The certificate's figure is the drop to 150% (Recovery Mode territory), which comes before liquidation; it is not the liquidation price."],
            ["Recovery Mode reserve.", "The BTC top-up reserve is idle BTC the owner keeps in the vault. It can't be withdrawn while Recovery Mode is on and promises are live, but nothing forces the owner to fund it. The 1,800 MUSD buffer can be withdrawn by the owner at any time and is ignored by the health check."],
            ["Redemption.", "Vaults run a high ratio, so redemption exposure is low. A redemption cuts collateral and debt at par; health is re-checked on the next action."],
            ["Arbiter trust.", "Bond claims rely on an arbiter chosen per commitment, who can't be the vault owner or the beneficiary. If the arbiter doesn't rule within 7 days of a dispute, the claim pays."],
            ["Not audited.", "Testnet only. No upgradeability by design: clones are immutable."],
          ].map(([t, d]) => (
            <li key={t} className="grid gap-1 sm:grid-cols-[220px_1fr]">
              <span className="font-medium">{t}</span>
              <span className="text-muted">{d}</span>
            </li>
          ))}
        </ul>
      </DocSection>

      <DocSection n="05" title="Tests">
        <Table
          head={["Test", "Proves"]}
          rows={[
            ["Rent guarantee: buffer, then mint", "Waterfall order; debt rises only when the buffer runs out; double and early triggers revert"],
            ["Rejects a commitment that fails the stress test", "health(cap) gate"],
            ["Owner can't pull collateral from under live promises", "Irrevocability (I3, I5)"],
            ["Undisputed claim executes after the window", "Claim lifecycle"],
            ["Recovery Mode needs a BTC top-up", "Reverts with the BTC needed, pays after funding"],
            ["Circuit: 2,900 invoiced, 100 moved", "Netting (9,655 bps), OverLimit, forceSettle draws the line, creditor claim"],
            ["Dispute path, closeCommitment, interest over 30 days, previous-cycle limits", "Edge cases of the claim, close and Circuit rules"],
            ["Access control, clone initialization, payInstallment", "Only the right party can call each function; clones initialize once"],
            ["Audit regressions (test/Audit.test.ts)", "Claim and release rules, line expiry and reuse, pro-rata Circuit claims after a cycle is final, reserve top-ups in both modes, reserve lock in Recovery Mode, arbiter deadline, two-step ownership, factory-only vaults, consent-based membership"],
          ]}
        />
        <p className="mt-4 text-sm text-muted">These run against a model of MUSD. The core file (test/Par.test.ts) also runs against the real MUSD contracts with one script.</p>
        <div className="mt-6">
          <NextLink href="/developers">Run them yourself</NextLink>
        </div>
      </DocSection>
    </div>
  )
}

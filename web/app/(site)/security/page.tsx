import { GaugeIllustration, LockIllustration, ShieldIllustration } from "@/components/landing/Illustrations"
import { DocHero, DocSection, Mono, NextLink, Pre, Table } from "@/components/landing/Doc"

export default function Security() {
  return (
    <div>
      <DocHero kicker="Security" title="Risk," muted="in the open." sub="A promise is only as good as the numbers behind it. Here is exactly how Par decides a promise fits, how it pays, and where it can fail.">
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Stress-tested", "BTC −40%, every promise called, still ≥ 160%.", <GaugeIllustration key="g" />],
            ["Non-custodial", "Your vault is your contract. Immutable clones, no admin.", <LockIllustration key="l" />],
            ["Recovery Mode ready", "Tops up collateral from an idle reserve when MUSD requires it.", <ShieldIllustration key="s" />],
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
            ["2", "Normal Mode", "Mint the shortfall from the trove with withdrawMUSD, under the capacity snapshot."],
            ["3", "Recovery Mode", "Add collateral from the idle BTC reserve so the ratio improves, then draw. If the reserve is short, revert with the BTC needed."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-btc font-mono text-xs text-white">{n}</span>
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
            ["Liquidation.", "If BTC falls past the stress level and the trove drops below 110%, it can be liquidated and its promises fail. The certificate shows how far that is."],
            ["Redemption.", "Vaults run a high ratio, so redemption exposure is low. A redemption cuts collateral and debt at par; health is re-checked on the next action."],
            ["Arbiter trust.", "Bond claims rely on an arbiter chosen per commitment, explicitly."],
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
            ["Dispute path, closeCommitment, interest over 30 days, previous-cycle limits, access control", "Section 8.2 additions + clone/initializer safety"],
          ]}
        />
        <p className="mt-4 text-sm text-muted">15 passing against a model of MUSD. The same file runs against the real MUSD contracts with one script.</p>
        <div className="mt-6">
          <NextLink href="/developers">Run them yourself</NextLink>
        </div>
      </DocSection>
    </div>
  )
}

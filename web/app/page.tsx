"use client"

import { LinkButton } from "@/components/ui"
import { useMarket, useProtocol } from "@/lib/hooks"
import { fmtBps, fmtRatio, fmtUsd, toNum } from "@/lib/format"
import { CONFIGURED } from "@/lib/config"

export default function Landing() {
  const p = useProtocol()
  const m = useMarket()
  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col items-start gap-6 pt-10">
        <span className="rounded-full border border-btc/40 bg-btc/10 px-3 py-1 text-xs font-semibold text-btc">
          Bitcoin-backed promises on Mezo
        </span>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight sm:text-6xl">
          Your Bitcoin, <span className="text-btc">as a promise.</span>
        </h1>
        <p className="max-w-2xl text-lg text-ink-300">
          Lock BTC in a Par vault and pledge its undrawn MUSD capacity to whoever needs a guarantee — one landlord or a whole
          trade network. Nothing is borrowed until a promise breaks. Then the vault mints MUSD straight to whoever is owed.
        </p>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/vault/new-guarantee">Make a guarantee</LinkButton>
          <LinkButton href="/circuit" variant="ghost">
            Clear trade credit with Circuit
          </LinkButton>
        </div>
        {!CONFIGURED && (
          <p className="text-sm text-warn">Set NEXT_PUBLIC_FACTORY and NEXT_PUBLIC_CIRCUIT to point the app at a deployment.</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="text-xl font-semibold">Par Guarantees</h2>
          <p className="mt-2 text-ink-300">
            Rent, supplier terms, performance bonds. An irrevocable onchain guarantee with a live certificate page. Pays
            automatically on a missed installment or after an uncontested claim.
          </p>
          <p className="mt-4 text-sm text-ink-400">MUSD that didn&apos;t exist a second ago lands in the landlord&apos;s wallet the moment rent is missed.</p>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="text-xl font-semibold">Par Circuit</h2>
          <p className="mt-2 text-ink-300">
            Businesses that sell to each other on credit log invoices. The contract nets them continuously. Only net debtors pay
            at cycle end, and a defaulter is force-settled from their vault.
          </p>
          <p className="mt-4 text-sm text-ink-400">2,900 MUSD of invoices cleared with 100 MUSD actually moving.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["Capacity snapshot", "A trove's max borrowing capacity (coll × price / 1.1) and its rate are fixed at open. Undrawn capacity is a free, rate-locked promise."],
          ["Stress-tested", `Every promise must survive a ${p ? Number(p.stressBps) / 100 : 40}% BTC drop with the vault still above ${p ? fmtRatio(p.targetIcr) : "160%"} after every promise is called.`],
          ["Recovery Mode ready", "MUSD only lets debt rise alongside a collateral top-up in Recovery Mode. Par computes the BTC needed and pays from an idle reserve."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-ink-800 p-5">
            <h3 className="font-semibold text-btc">{t}</h3>
            <p className="mt-2 text-sm text-ink-300">{d}</p>
          </div>
        ))}
      </section>

      {m.price !== undefined && (
        <section className="flex flex-wrap gap-8 rounded-2xl border border-ink-800 p-5 text-sm">
          <div>
            <div className="text-ink-400">BTC / USD (Mezo oracle)</div>
            <div className="num text-lg">{fmtUsd(toNum(m.price))}</div>
          </div>
          <div>
            <div className="text-ink-400">System TCR</div>
            <div className="num text-lg">{fmtRatio(m.tcr)}</div>
          </div>
          <div>
            <div className="text-ink-400">Mode</div>
            <div className={`num text-lg ${m.recoveryMode ? "text-warn" : "text-ok"}`}>{m.recoveryMode ? "Recovery" : "Normal"}</div>
          </div>
          {m.globalRate !== undefined && (
            <div>
              <div className="text-ink-400">Rate for new troves</div>
              <div className="num text-lg">{fmtBps(m.globalRate)}</div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

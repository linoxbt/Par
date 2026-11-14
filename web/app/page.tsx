"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { parseEther } from "viem"
import { fmtMusd, fmtPct, fmtUsd, toNum } from "@/lib/format"
import { useMarket, useProtocol } from "@/lib/hooks"
import { maxDrop, openPreview } from "@/lib/risk"
import { Meter } from "@/components/ui"

const E18 = 10n ** 18n

export default function Landing() {
  const m = useMarket()
  const p = useProtocol()
  const price = m.price ?? 66_000n * E18
  return (
    <div>
      <Hero />
      <Moves />
      <Products />
      <Calculator price={price} stressBps={p?.stressBps ?? 4000n} targetIcr={p?.targetIcr ?? 16n * 10n ** 17n} live={m.price !== undefined} />
      <Closing />
    </div>
  )
}

// ---------------------------------------------------------------- hero

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-20 lg:grid-cols-[1.1fr_1fr]">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-btc" /> Built on MUSD · Mezo
          </span>
          <h1 className="h-display mt-6 text-5xl sm:text-[64px]">
            Your Bitcoin,
            <br />
            as a promise<span className="text-btc">.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted">
            Lock BTC in a vault and back a rent guarantee or a trade-credit line. Nothing is borrowed until a promise breaks. Then the vault pays,
            automatically.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/vault" className="rounded-full bg-fg px-6 py-3 text-sm font-medium text-white transition hover:bg-black/80">
              Open a vault
            </Link>
            <a href="#moves" className="px-3 py-3 text-sm font-medium text-fg hover:text-btc-ink">
              See how it works →
            </a>
          </div>
          <div className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
            {[
              ["0%", "interest until called"],
              ["−40%", "BTC crash survived"],
              ["96.55%", "invoices netted"],
            ].map(([v, l]) => (
              <div key={l}>
                <div className="num text-xl font-medium">{v}</div>
                <div className="mt-0.5 text-xs text-subtle">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <PayoutCard />
      </div>
    </section>
  )
}

const STATES = [
  { tag: "Active", tone: "ok", title: "Guarantee active", line: "No money has moved", amount: "0.00", note: "500 MUSD rent · due in 3d" },
  { tag: "Due", tone: "muted", title: "Rent due today", line: "Waiting for the tenant", amount: "0.00", note: "Grace period: 3 days" },
  { tag: "Missed", tone: "warn", title: "Payment missed", line: "Keeper triggers the vault", amount: "500.00", note: "Buffer first, then mint" },
  { tag: "Paid", tone: "btc", title: "Paid by the vault", line: "Landlord received MUSD", amount: "500.00", note: "Block 1,204,331 · 2.1 s" },
] as const

/** Animated example: a guarantee going from active → due → missed → paid. */
function PayoutCard() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % STATES.length), 2400)
    return () => clearInterval(t)
  }, [])
  const s = STATES[i]
  const toneCls =
    s.tone === "ok" ? "bg-ok-wash text-ok" : s.tone === "warn" ? "bg-warn-wash text-warn" : s.tone === "btc" ? "bg-btc-wash text-btc-ink" : "bg-soft text-muted"
  return (
    <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms]">
      <div className="rounded-2xl border border-line bg-white p-6 shadow-float">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-btc text-sm text-white" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>₿</span>
            Vault 0x61ef…4296
          </div>
          <span key={s.tag} className={`animate-rise rounded-full px-2.5 py-0.5 text-xs font-medium ${toneCls}`}>
            {s.tag}
          </span>
        </div>
        <div className="mt-6 rounded-xl bg-soft p-4">
          <div className="text-xs text-muted">{s.title}</div>
          <div key={s.amount + i} className="num mt-1 animate-rise text-4xl font-medium tracking-tight">
            {s.amount} <span className="text-sm text-subtle">MUSD</span>
          </div>
          <div className="mt-1 text-xs text-subtle">{s.line}</div>
        </div>
        <div className="mt-5 space-y-3">
          {STATES.map((st, k) => (
            <div key={st.tag} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition ${
                  k < i ? "border-fg bg-fg text-white" : k === i ? "border-btc bg-btc text-white" : "border-line-strong text-subtle"
                }`}
              >
                {k < i ? "✓" : k + 1}
              </span>
              <span className={k <= i ? "text-fg" : "text-subtle"}>{st.title}</span>
              {k === i && <span className="ml-auto text-xs text-muted">{st.note}</span>}
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
          <span>Backed by 0.25 BTC · holds if BTC falls 58%</span>
          <span className="num">Example</span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- four moves

const MOVES = [
  {
    t: "Lock",
    d: "Open a vault with BTC. MUSD fixes your borrowing capacity and rate at open. You draw only the 1,800 MUSD minimum, kept as a buffer.",
    rows: [
      ["Collateral", "0.25 BTC"],
      ["Capacity (fixed)", "15,146 MUSD"],
      ["Rate (locked)", "1.00%"],
    ],
  },
  {
    t: "Promise",
    d: "Pledge undrawn capacity: rent, supplier terms, a bond or a trade-credit line. The vault refuses anything that wouldn't survive a 40% BTC drop.",
    rows: [
      ["Beneficiary", "landlord"],
      ["Schedule", "12 × 500 MUSD"],
      ["Stress test", "passes · 2.2×"],
    ],
  },
  {
    t: "Miss",
    d: "If a payment is late past the grace period, anyone can trigger the vault. Our keeper does it within seconds. No one has to approve it.",
    rows: [
      ["Due", "1 Dec, 12:00"],
      ["Grace", "3 days"],
      ["Trigger", "permissionless"],
    ],
  },
  {
    t: "Pay",
    d: "The vault pays from its buffer, then mints the rest from the trove, straight to the beneficiary. In Recovery Mode it tops up collateral first.",
    rows: [
      ["From buffer", "500 MUSD"],
      ["Minted", "0 MUSD"],
      ["Sent to", "landlord ✓"],
    ],
  },
]

function Moves() {
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setI((x) => (x + 1) % MOVES.length), 3500)
    return () => clearInterval(t)
  }, [auto])
  const mv = MOVES[i]
  return (
    <section id="moves" className="border-b border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <h2 className="h-section">
          One promise. <span className="text-subtle">Four moves.</span>
        </h2>
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <div className="relative">
            <div className="absolute bottom-3 left-[11px] top-3 w-px bg-line" />
            {MOVES.map((m, k) => (
              <button
                key={m.t}
                onClick={() => (setI(k), setAuto(false))}
                className="relative flex w-full gap-5 py-4 text-left"
              >
                <span className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] transition ${k === i ? "bg-btc text-white" : "border border-line-strong bg-white text-subtle"}`}>
                  0{k + 1}
                </span>
                <span>
                  <span className={`block text-lg font-medium ${k === i ? "text-fg" : "text-subtle"}`}>{m.t}</span>
                  {k === i && <span className="mt-1 block max-w-md animate-rise text-sm text-muted">{m.d}</span>}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center">
            <div key={i} className="w-full animate-rise rounded-2xl border border-line bg-canvas p-2">
              <div className="rounded-xl border border-line bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{mv.t}</span>
                  <span className="tag">step 0{i + 1} / 04</span>
                </div>
                <div className="mt-5 divide-y divide-line">
                  {mv.rows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-muted">{k}</span>
                      <span className="num">{v}</span>
                    </div>
                  ))}
                </div>
                <Meter value={((i + 1) / 4) * 100} tone="btc" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- products

function Products() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-6xl gap-5 px-5 py-24 lg:grid-cols-2">
        <Link href="/vault/new-guarantee" className="group rounded-2xl border border-line bg-white p-7 shadow-card transition hover:shadow-float">
          <div className="tag">Par Guarantees</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">Rent, supplier terms, bonds.</h3>
          <p className="mt-2 text-muted">A guarantee with a public certificate. Pays itself when an installment is missed or a claim goes uncontested.</p>
          <div className="mt-6 divide-y divide-line rounded-xl border border-line">
            {[
              ["Month 1", "Paid by tenant", "ok"],
              ["Month 2", "Covered by vault", "btc"],
              ["Month 3", "Due in 28 days", "muted"],
            ].map(([a, b, t]) => (
              <div key={a} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="num">{a} · 500</span>
                <span className={t === "ok" ? "text-ok" : t === "btc" ? "text-btc-ink" : "text-subtle"}>{b}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 text-sm font-medium group-hover:text-btc-ink">Make a guarantee →</div>
        </Link>
        <Link href="/circuit" className="group rounded-2xl border border-line bg-white p-7 shadow-card transition hover:shadow-float">
          <div className="tag">Par Circuit</div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight">Trade credit that clears itself.</h3>
          <p className="mt-2 text-muted">Shops that sell to each other log invoices. Only net debts settle, and a defaulter is paid for from their vault.</p>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-xl border border-line p-5">
            <div>
              <div className="text-xs text-muted">Invoiced</div>
              <div className="num text-3xl font-medium tracking-tight">2,900</div>
            </div>
            <span className="text-subtle">→</span>
            <div className="text-right">
              <div className="text-xs text-muted">Actually moved</div>
              <div className="num text-3xl font-medium tracking-tight text-btc-ink">100</div>
            </div>
            <div className="col-span-3">
              <Meter value={96.55} tone="btc" />
              <div className="mt-1.5 text-xs text-subtle">96.55% netted, proven against the contracts</div>
            </div>
          </div>
          <div className="mt-6 text-sm font-medium group-hover:text-btc-ink">Open Circuit →</div>
        </Link>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- calculator

function Calculator({ price, stressBps, targetIcr, live }: { price: bigint; stressBps: bigint; targetIcr: bigint; live: boolean }) {
  const [btc, setBtc] = useState(0.25)
  const coll = parseEther(String(btc))
  const pv = openPreview(coll, price, 1800n * E18, stressBps, targetIcr)
  const drop = maxDrop(coll, pv.debt, pv.maxCover, price)
  return (
    <section className="border-b border-line bg-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
        <div>
          <h2 className="h-section">What can your Bitcoin promise?</h2>
          <p className="mt-3 max-w-md text-muted">
            {live ? "Live" : "Illustrative"} BTC price {fmtUsd(toNum(price))}. Every promise must still hold if BTC falls {Number(stressBps) / 100}% and all of
            them are called at once.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-canvas p-2">
          <div className="rounded-xl border border-line bg-white p-6 shadow-card">
            <div className="flex items-end justify-between">
              <div>
                <div className="label">You lock</div>
                <div className="num mt-1 text-2xl font-medium">{btc.toFixed(2)} BTC</div>
                <div className="text-xs text-subtle">{fmtUsd(toNum(pv.value))}</div>
              </div>
              <div className="text-right">
                <div className="label">You can promise</div>
                <div className="num mt-1 text-4xl font-medium tracking-tight">{fmtMusd(pv.maxCover, 0)}</div>
                <div className="text-xs text-subtle">MUSD of cover</div>
              </div>
            </div>
            <input
              type="range"
              min={0.05}
              max={2}
              step={0.01}
              value={btc}
              onChange={(e) => setBtc(Number(e.target.value))}
              className="mt-6 w-full accent-[#0A0A0B]"
            />
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
              <div>
                <div className="text-xs text-subtle">Capacity</div>
                <div className="num">{fmtMusd(pv.capacity, 0)}</div>
              </div>
              <div>
                <div className="text-xs text-subtle">Buffer</div>
                <div className="num">1,800</div>
              </div>
              <div>
                <div className="text-xs text-subtle">Holds to</div>
                <div className="num text-btc-ink">−{fmtPct(drop)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- closing

function Closing() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {[
            ["Rate-locked capacity", "A Mezo trove fixes its capacity and rate at open. MUSD is minted, not borrowed from a pool, so no one else can drain your promise."],
            ["Stress-tested", "Every promise must keep the vault above 160% even after a 40% BTC drop with everything called. The certificate shows the live margin."],
            ["Recovery Mode ready", "When MUSD restricts new debt, the vault computes the BTC top-up it needs and pays from an idle reserve."],
          ].map(([t, d]) => (
            <div key={t} className="bg-white p-6">
              <div className="font-medium">{t}</div>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <h2 className="h-section">
            Make your first promise<span className="text-btc">.</span>
          </h2>
          <div className="flex gap-3">
            <Link href="/vault" className="rounded-full bg-fg px-6 py-3 text-sm font-medium text-white hover:bg-black/80">
              Open a vault
            </Link>
            <a href="https://github.com/linoxbt/par" target="_blank" rel="noreferrer" className="rounded-full border border-line-strong bg-white px-6 py-3 text-sm font-medium hover:border-fg">
              Read the contracts
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

"use client"

import Link from "next/link"
import { useState } from "react"
import { parseEther } from "viem"
import { fmtBps, fmtMusd, fmtPct, fmtUsd, toNum } from "@/lib/format"
import { useMarket, useProtocol } from "@/lib/hooks"
import { maxDrop, openPreview } from "@/lib/risk"

const E18 = 10n ** 18n
const Arrow = () => <span aria-hidden>→</span>

export default function Landing() {
  const m = useMarket()
  const p = useProtocol()
  const price = m.price ?? 50_000n * E18
  const stressBps = p?.stressBps ?? 4000n
  const targetIcr = p?.targetIcr ?? 16n * 10n ** 17n

  return (
    <div>
      <Hero price={price} live={m.price !== undefined} />
      <Stats stressPct={Number(stressBps) / 100} floor={Number(targetIcr) / 1e16} />
      <BuiltOn />
      <Calculator price={price} stressBps={stressBps} targetIcr={targetIcr} />
      <HowItWorks />
      <WhyPar />
      <Compare />
      <Risk />
      <Fees rate={m.globalRate} />
      <Faq />
      <FinalCta />
    </div>
  )
}

// ---------------------------------------------------------------- hero

function Hero({ price, live }: { price: bigint; live: boolean }) {
  return (
    <section className="gridlines relative overflow-hidden border-b border-ink-700 bg-gradient-to-b from-ink-900 to-ink-950">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <div className="eyebrow">Index 01 · Bitcoin-backed promises on Mezo</div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-[3px] border border-ink-600 bg-ink-800/70 px-3 py-1.5 text-xs text-ink-300">
            <span className="h-1.5 w-1.5 rounded-full bg-btc" />
            BTC <span className="num text-white">{fmtUsd(toNum(price))}</span> · {live ? "Mezo oracle, live" : "illustrative price"}
          </div>
          <h1 className="display mt-6 text-6xl sm:text-7xl">
            Your Bitcoin,
            <br />
            <em className="text-btc">as a promise.</em>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-300">
            Lock BTC in a Par vault and pledge its undrawn MUSD capacity to whoever needs a guarantee: one landlord or a whole
            trade network. Nothing is borrowed until a promise breaks. Then the vault mints MUSD straight to whoever is owed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/vault/new-guarantee" className="inline-flex items-center gap-2 rounded-[3px] bg-btc px-6 py-3.5 text-sm font-semibold text-ink-950 hover:bg-btc-soft">
              Make a guarantee <Arrow />
            </Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-[3px] border border-ink-600 px-6 py-3.5 text-sm font-semibold text-white hover:border-btc">
              See how it works <span aria-hidden>▷</span>
            </a>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ink-300">
            <span className="flex items-center gap-2">
              <Shield /> Stress-tested at a 40% BTC drop
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-btc">₿</span> Built on MUSD, minted not pooled
            </span>
          </div>
        </div>
        <HeroVisual price={price} />
      </div>
    </section>
  )
}

function Shield() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F7931A" strokeWidth="1.8" aria-hidden>
      <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </svg>
  )
}

/** Composition: vault door + a certificate card + a live-events panel (labelled as an example). */
function HeroVisual({ price }: { price: bigint }) {
  // Example vault: 0.25 BTC, 1,800 MUSD seed, 3 months of 500 MUSD rent, at the live price.
  const coll = 25n * 10n ** 16n
  const debt = 1800n * E18 + 1800n * 10n ** 15n + 200n * E18
  const capacity = (coll * price) / (11n * 10n ** 17n)
  const holds = maxDrop(coll, debt, 1500n * E18, price)
  return (
    <div className="relative mx-auto h-[500px] w-full max-w-[520px]">
      {/* vault door */}
      <svg viewBox="0 0 400 400" className="absolute right-0 top-6 h-[420px] w-[420px] opacity-90" aria-hidden>
        <defs>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F7931A" stopOpacity="0.28" />
            <stop offset="70%" stopColor="#F7931A" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#F7931A" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="200" cy="200" r="200" fill="url(#glow)" />
        {[170, 140, 112, 86].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#F7931A" strokeOpacity={0.14 + i * 0.08} strokeWidth={i === 0 ? 1 : 1.2} strokeDasharray={i === 1 ? "2 6" : undefined} />
        ))}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <line key={i} x1={200 + Math.cos(a) * 112} y1={200 + Math.sin(a) * 112} x2={200 + Math.cos(a) * 140} y2={200 + Math.sin(a) * 140} stroke="#F7931A" strokeOpacity="0.35" />
        })}
        <text x="200" y="228" textAnchor="middle" fontFamily="Instrument Serif, serif" fontSize="92" fill="#F7931A" fillOpacity="0.9">
          ₿
        </text>
      </svg>

      {/* locked chip */}
      <div className="absolute right-2 top-0 rounded-[3px] bg-btc px-4 py-2.5 text-ink-950 shadow-xl">
        <div className="font-mono text-[10px] uppercase tracking-widest opacity-70">Locked · capacity</div>
        <div className="num text-lg font-semibold">0.25 BTC · {fmtMusd(capacity, 0)}</div>
      </div>

      {/* certificate */}
      <div className="absolute left-0 top-16 w-[270px] rounded-[3px] border border-paper-line bg-paper p-5 text-paper-ink shadow-2xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-paper-mute">Certificate · №0</span>
          <span className="rounded-[3px] bg-ok/15 px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#1f7a4c]">Active</span>
        </div>
        <div className="display mt-3 text-4xl">Guaranteed</div>
        <div className="mt-1 text-sm text-paper-mute">500 MUSD × 12, monthly rent</div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-paper-line pt-3">
          <div>
            <div className="font-mono text-[10px] uppercase text-paper-mute">Cover</div>
            <div className="num text-lg">1,500</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase text-paper-mute">Holds if BTC falls</div>
            <div className="num text-lg text-btc-dim">{fmtPct(holds)}</div>
          </div>
        </div>
        <svg viewBox="0 0 220 40" className="mt-3 h-10 w-full" aria-hidden>
          <path d="M0 30 L30 28 L60 31 L90 22 L120 25 L150 14 L180 17 L220 6" fill="none" stroke="#B86A0C" strokeWidth="1.5" />
          <path d="M0 30 L30 28 L60 31 L90 22 L120 25 L150 14 L180 17 L220 6 L220 40 L0 40Z" fill="#F7931A" fillOpacity="0.12" />
        </svg>
      </div>

      {/* events */}
      <div className="absolute bottom-14 left-24 w-[300px] rounded-[3px] border border-ink-600 bg-ink-900/95 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-btc">
            <span className="h-1.5 w-1.5 rounded-full bg-btc" /> Example events
          </span>
          <span className="font-mono text-[10px] text-ink-400">matsnet</span>
        </div>
        {[
          ["Installment 1", "paid by tenant", "+500"],
          ["Installment 2", "missed · minted", "+500"],
          ["Circle #1", "cleared 96.55%", "100"],
          ["Repairer", "force-settled", "−100"],
        ].map(([a, b, c], i) => (
          <div key={a} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i === 1 ? "bg-btc/10" : ""}`}>
            <span>{a}</span>
            <span className="text-xs text-ink-400">{b}</span>
            <span className={`num text-xs ${c.startsWith("−") ? "text-bad" : "text-btc"}`}>{c}</span>
          </div>
        ))}
      </div>

      {/* auto-pay chip */}
      <div className="absolute bottom-0 right-0 flex items-center gap-3 rounded-[3px] border border-ink-600 bg-ink-800 px-4 py-3 shadow-xl">
        <span className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-ink-700 text-btc">↻</span>
        <div>
          <div className="text-sm font-semibold">Auto-pay is on</div>
          <div className="text-xs text-ink-400">Anyone can trigger a missed payment</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- stats

function Stats({ stressPct, floor }: { stressPct: number; floor: number }) {
  const s = [
    ["01 / Cost", "0%", "interest on a promise until it's called"],
    ["02 / Stress", `−${stressPct}%`, "BTC drop every promise must survive"],
    ["03 / Floor", `${floor}%`, "collateral ratio after every promise is called"],
    ["04 / Netted", "96.55%", "of Circuit invoices cleared without money moving"],
  ]
  return (
    <section className="border-b border-ink-700 bg-ink-950">
      <div className="mx-auto grid max-w-6xl grid-cols-2 lg:grid-cols-4">
        {s.map(([l, v, d], i) => (
          <div key={l} className={`px-5 py-10 ${i > 0 ? "lg:border-l" : ""} ${i % 2 === 1 ? "border-l" : ""} border-ink-700`}>
            <div className="label">{l}</div>
            <div className="display mt-3 text-5xl text-btc">{v}</div>
            <div className="mt-2 text-sm text-ink-300">{d}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function BuiltOn() {
  const parts = ["BorrowerOperations", "TroveManager", "PriceFeed", "HintHelpers", "Mezo Passport"]
  return (
    <section className="paper border-b border-paper-line">
      <div className="mx-auto flex max-w-6xl flex-col items-stretch sm:flex-row">
        <div className="flex items-center border-paper-line py-6 pr-8 text-sm text-paper-mute sm:border-r">
          Integrated directly with
          <br />
          MUSD on Mezo
        </div>
        <div className="grid flex-1 grid-cols-2 sm:grid-cols-5">
          {parts.map((p, i) => (
            <div key={p} className={`flex items-center justify-center py-6 font-serif text-xl ${i > 0 ? "sm:border-l" : ""} border-paper-line`}>
              {p}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- calculator

function Calculator({ price, stressBps, targetIcr }: { price: bigint; stressBps: bigint; targetIcr: bigint }) {
  const [btc, setBtc] = useState(0.25)
  const coll = parseEther(String(btc))
  const seed = 1800n * E18
  const pv = openPreview(coll, price, seed, stressBps, targetIcr)
  const rent = 1500n * E18
  const fits = pv.maxCover >= rent
  const drop = maxDrop(coll, pv.debt, rent, price)
  return (
    <section className="paper">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 lg:grid-cols-2">
        <div>
          <div className="eyebrow !text-btc-dim">Live calculator</div>
          <h2 className="display mt-4 text-5xl">
            See what your Bitcoin
            <br />
            can promise.
          </h2>
          <p className="mt-5 max-w-md text-paper-mute">
            Uses the live Mezo price and Par&apos;s stress test. The 1,800 MUSD seed (MUSD&apos;s minimum loan) stays in the vault and pays the
            first claims before any new debt.
          </p>
          <div className="mt-10 rounded-[3px] border border-paper-line bg-white/60 p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm">You lock</span>
              <span className="num text-sm text-paper-mute">{fmtUsd(toNum(pv.value))}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="num text-3xl">{btc.toFixed(2)} BTC</span>
              <span className="text-right">
                <span className="block text-xs text-paper-mute">You can promise</span>
                <span className="display text-5xl text-btc-dim">{fmtMusd(pv.maxCover, 0)}</span>
                <span className="ml-1 font-mono text-xs text-paper-mute">MUSD</span>
              </span>
            </div>
            <input type="range" min={0.05} max={2} step={0.01} value={btc} onChange={(e) => setBtc(Number(e.target.value))} className="mt-6 w-full accent-[#F7931A]" />
            <div className="mt-1 flex justify-between font-mono text-[10px] uppercase text-paper-mute">
              <span>0.05 BTC</span>
              <span>2 BTC</span>
            </div>
            <p className="mt-4 text-xs text-paper-mute">
              Capacity snapshot {fmtMusd(pv.capacity, 0)} MUSD · opening debt {fmtMusd(pv.debt, 0)} MUSD · payable in practice {fmtMusd(pv.payable, 0)} MUSD
            </p>
          </div>
        </div>
        <div className="flex flex-col justify-end gap-4">
          <div className="rounded-[3px] bg-ink-900 p-7 text-white">
            <div className="label">Example · 3 months of rent</div>
            <div className="mt-3 flex items-end justify-between">
              <div className="display text-6xl">1,500</div>
              <div className={`font-mono text-sm uppercase tracking-wider ${fits ? "text-ok" : "text-bad"}`}>{fits ? "Fits" : "Doesn't fit"}</div>
            </div>
            <div className="mt-1 text-sm text-ink-400">MUSD of cover, 500 a month</div>
            <div className="mt-6 h-1.5 bg-ink-700">
              <div className="h-full bg-btc" style={{ width: `${Math.min(100, (toNum(rent) / Math.max(1, toNum(pv.maxCover))) * 100)}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] uppercase text-ink-400">
              <span>uses {Math.min(100, Math.round((toNum(rent) / Math.max(1, toNum(pv.maxCover))) * 100))}% of cover</span>
              <span>holds if BTC falls {fmtPct(drop)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-[3px] bg-ink-800 px-6 py-4 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-ink-700 text-btc">₿</span>
              <div>
                <div className="text-sm font-semibold">No money moves until a payment is missed</div>
                <div className="text-xs text-ink-400">Then the vault mints MUSD to the landlord</div>
              </div>
            </div>
            <span className="h-5 w-9 rounded-full bg-btc p-0.5">
              <span className="ml-auto block h-4 w-4 rounded-full bg-ink-950" />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- how it works

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Lock BTC in a vault",
      d: "Your own contract opens a MUSD trove. Capacity and rate are snapshotted at open, and you draw only the 1,800 MUSD minimum.",
      ui: (
        <div className="space-y-2">
          <Row k="Collateral" v="0.10 BTC" />
          <Row k="Capacity" v="9,090 MUSD" />
          <Row k="Rate locked" v="1.00%" accent />
        </div>
      ),
    },
    {
      n: "02",
      t: "Make a promise",
      d: "Rent, supplier terms, a bond or a trade-credit line. The vault refuses any promise that wouldn't survive a 40% BTC crash.",
      ui: (
        <div className="space-y-2">
          <Row k="Beneficiary" v="landlord" />
          <Row k="12 × 500" v="cover 1,500" />
          <div className="rounded-[2px] bg-ok/15 px-2 py-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-ok">Fits · 2.2× at −40%</div>
        </div>
      ),
    },
    {
      n: "03",
      t: "It pays itself",
      d: "Miss a payment and anyone can trigger the vault. It pays from the buffer, then mints the rest, straight to the beneficiary.",
      ui: (
        <div className="space-y-2">
          <Row k="Due + grace" v="passed" />
          <Row k="From buffer" v="500" />
          <Row k="Minted" v="0 → 500" accent />
        </div>
      ),
    },
  ]
  return (
    <section id="how" className="paper border-t border-paper-line">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div className="eyebrow !text-btc-dim">How it works</div>
        <h2 className="display mt-4 text-5xl">Three steps to your first promise.</h2>
        <div className="mt-12 grid border border-paper-line lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n} className={`flex flex-col p-6 ${i > 0 ? "border-t lg:border-l lg:border-t-0" : ""} border-paper-line`}>
              <div className="flex items-start justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-[3px] bg-btc/15 font-mono text-xs text-btc-dim">{s.n}</span>
                <span className="display text-4xl italic text-btc/70">{s.n}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-paper-mute">{s.d}</p>
              <div className="mt-6 rounded-[3px] bg-ink-900 p-4 text-white">{s.ui}</div>
            </div>
          ))}
          <div className="flex flex-col justify-between bg-ink-900 p-6 text-white">
            <div>
              <div className="label">Missed payment to payout</div>
              <div className="display mt-3 text-6xl">1 block</div>
              <p className="mt-3 text-sm text-ink-400">After the grace period you set, the keeper (or anyone) triggers the payout in a single transaction.</p>
            </div>
            <div className="mt-6 divide-y divide-ink-700 border-t border-ink-700">
              {[
                ["Grace", "you choose"],
                ["Keeper scan", "≤ 15 s"],
                ["Mint + transfer", "1 tx"],
              ].map(([a, b]) => (
                <div key={a} className="flex justify-between py-2.5 text-sm">
                  <span className="text-ink-300">{a}</span>
                  <span className="num text-btc">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 border-y border-paper-line py-4 text-sm sm:grid-cols-4">
          {["No interest until called", "Irrevocable until expiry", "Anyone can trigger a payout", "A live public certificate"].map((t) => (
            <span key={t} className="flex items-center gap-2">
              <span className="text-btc-dim">✓</span> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-ink-400">{k}</span>
      <span className={`num ${accent ? "text-btc" : "text-white"}`}>{v}</span>
    </div>
  )
}

// ---------------------------------------------------------------- bento

function WhyPar() {
  return (
    <section className="bg-ink-950">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow">Why Par</div>
            <h2 className="display mt-4 max-w-xl text-5xl">One vault. Promises anyone can check.</h2>
          </div>
          <p className="max-w-sm text-ink-300">Guarantees for one landlord, clearing lines for a whole trade network. Same vault, same stress test, same MUSD.</p>
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          <div className="grid gap-6 rounded-[3px] border border-ink-700 bg-ink-900 p-7 sm:grid-cols-2 lg:col-span-2">
            <div>
              <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-ink-700 text-btc">§</span>
              <h3 className="mt-6 font-serif text-3xl">Par Guarantees</h3>
              <p className="mt-3 text-sm text-ink-300">
                Rent, supplier terms, performance bonds. Installments pay automatically when missed; bonds pay after an uncontested claim, with an
                arbiter both sides chose.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Scheduled", "Claim", "Arbiter", "WhatsApp link"].map((t) => (
                  <span key={t} className="rounded-[3px] border border-ink-600 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-ink-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-[3px] bg-paper p-5 text-paper-ink">
              <div className="font-mono text-[10px] uppercase tracking-widest text-paper-mute">Installments</div>
              {[
                ["1", "Paid by tenant", "text-[#1f7a4c]"],
                ["2", "Covered by vault", "text-btc-dim"],
                ["3", "Due in 28d", "text-paper-mute"],
              ].map(([n, s, c]) => (
                <div key={n} className="flex items-center justify-between border-b border-paper-line py-3 text-sm last:border-0">
                  <span className="num">{n} · 500</span>
                  <span className={`font-mono text-[11px] uppercase ${c}`}>{s}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="row-span-2 flex flex-col rounded-[3px] bg-gradient-to-br from-btc-soft via-btc to-btc-dim p-7 text-ink-950">
            <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-ink-950/15">⇄</span>
            <h3 className="mt-6 font-serif text-3xl">Par Circuit</h3>
            <p className="mt-3 text-sm text-ink-950/75">
              Businesses that sell to each other log invoices. The contract nets them as they&apos;re accepted. Only net debtors pay, and a defaulter
              is force-settled from their vault.
            </p>
            <div className="mt-auto rounded-[3px] bg-white p-4 pt-3">
              {[
                ["Importer", "+100"],
                ["Wholesaler", "0"],
                ["Repairer", "−100"],
              ].map(([a, b]) => (
                <div key={a} className="flex justify-between border-b border-paper-line py-2.5 text-sm last:border-0">
                  <span>{a}</span>
                  <span className={`num ${b.startsWith("−") ? "text-bad" : b === "0" ? "text-paper-mute" : "text-[#1f7a4c]"}`}>{b}</span>
                </div>
              ))}
              <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-paper-mute">2,900 cleared · 100 moved</div>
            </div>
          </div>
          <div className="rounded-[3px] border border-ink-700 bg-ink-900 p-7">
            <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-ink-700 text-btc">⚑</span>
            <h3 className="mt-6 font-serif text-2xl">Recovery Mode ready</h3>
            <p className="mt-2 text-sm text-ink-300">
              When Mezo&apos;s TCR dips under 150%, MUSD only lets debt rise with a collateral top-up. Par computes the BTC needed and pays from an idle
              reserve.
            </p>
          </div>
          <div className="rounded-[3px] border border-ink-700 bg-ink-900 p-7">
            <span className="flex h-10 w-10 items-center justify-center rounded-[3px] bg-ink-700 text-btc">◎</span>
            <h3 className="mt-6 font-serif text-2xl">Rate-locked capacity</h3>
            <p className="mt-2 text-sm text-ink-300">
              A trove&apos;s capacity and rate are fixed at open, and MUSD is minted, not borrowed from a pool. Nobody else can drain your promise.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- compare

function Compare() {
  const rows = [
    ["Capital tied up", "Months of rent, idle", "Cash collateral or a credit line", "BTC stays yours, in your own trove"],
    ["Cost while nothing goes wrong", "Lost yield", "Annual bank fee", "No interest until called"],
    ["Who decides a payout", "The landlord", "The bank", "The contract, or an arbiter you chose"],
    ["Time to pay", "Tenant waits for a refund", "Days of paperwork", "Next block after the grace period"],
    ["How you check it", "Trust", "A letter", "A live public certificate"],
  ]
  return (
    <section className="paper">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="eyebrow !text-btc-dim">Deposit vs Par</div>
            <h2 className="display mt-4 max-w-2xl text-5xl">Three ways to guarantee a year of rent.</h2>
          </div>
          <div className="text-right">
            <div className="display text-6xl italic text-btc-dim">0 MUSD</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-paper-mute">borrowed until a promise breaks</div>
          </div>
        </div>
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-y border-paper-ink/80 font-mono text-[11px] uppercase tracking-widest text-paper-mute">
                <th className="py-4 font-normal" />
                <th className="py-4 font-normal">Cash deposit</th>
                <th className="py-4 font-normal">Bank guarantee</th>
                <th className="py-4 font-normal text-btc-dim">Par guarantee</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r[0]} className={`border-b border-paper-line ${i === rows.length - 1 ? "bg-btc/10" : ""}`}>
                  <td className="py-4 pr-4 font-semibold">{r[0]}</td>
                  <td className="py-4 pr-4 text-paper-mute">{r[1]}</td>
                  <td className="py-4 pr-4 text-paper-mute">{r[2]}</td>
                  <td className="py-4 font-medium text-btc-dim">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-paper-mute">
          Drawn MUSD carries the trove&apos;s fixed rate and a 0.1% borrowing fee. If BTC falls past the level shown on the certificate, a vault can be
          liquidated and its promises fail.
        </p>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- risk

function Risk() {
  return (
    <section className="border-t border-paper-line bg-paper-2 text-paper-ink">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
        <div className="relative">
          <div className="gridlines relative aspect-[4/3.4] overflow-hidden rounded-[3px] bg-ink-900">
            <svg viewBox="0 0 400 340" className="absolute inset-0 h-full w-full" aria-hidden>
              {/* ratio ladder */}
              {[
                ["Stressed ICR", 0.86, "#F7931A"],
                ["Target 160%", 0.56, "#B4BDD0"],
                ["CCR 150%", 0.49, "#E8B23A"],
                ["MCR 110%", 0.3, "#E5484D"],
              ].map(([l, y, c]) => (
                <g key={l as string}>
                  <line x1="40" x2="360" y1={320 - (y as number) * 300} y2={320 - (y as number) * 300} stroke={c as string} strokeOpacity="0.8" strokeDasharray={l === "Stressed ICR" ? undefined : "4 5"} />
                  <text x="44" y={314 - (y as number) * 300} fill={c as string} fontFamily="JetBrains Mono, monospace" fontSize="11">
                    {l as string}
                  </text>
                </g>
              ))}
              <path d="M40 120 C 110 110, 150 150, 200 132 S 300 90, 360 62" fill="none" stroke="#F7931A" strokeWidth="2" />
            </svg>
          </div>
          <div className="absolute -right-3 -top-4 rounded-[3px] bg-btc px-5 py-4 text-center text-ink-950 shadow-xl">
            <div className="display text-3xl">160%</div>
            <div className="font-mono text-[10px] uppercase tracking-widest">floor at −40%</div>
          </div>
          <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-[3px] bg-white px-4 py-3 shadow-xl">
            <Shield />
            <div>
              <div className="text-sm font-semibold">Health re-checked on every action</div>
              <div className="text-xs text-paper-mute">owner can&apos;t pull BTC from under a promise</div>
            </div>
          </div>
        </div>
        <div>
          <div className="eyebrow !text-btc-dim">Risk, in the open</div>
          <h2 className="display mt-4 text-5xl">Your promise sits on a trove, not on a spreadsheet.</h2>
          <p className="mt-5 text-paper-mute">
            Every commitment must pass a stress test when it&apos;s made: BTC falls 40%, every promise is called at once, and the vault must still sit
            above 160%. The certificate shows exactly how far BTC can fall before a promise could fail.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "Promises are irrevocable until expiry or released by the beneficiary",
              "Collateral can't be withdrawn while it backs live promises",
              "Recovery Mode handled with an idle BTC reserve, tested against MUSD",
              "Open source, testnet only, not audited yet",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[2px] bg-btc/20 text-[11px] text-btc-dim">✓</span>
                {t}
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/linoxbt/par"
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-[3px] bg-ink-900 px-5 py-3 text-sm font-semibold text-white hover:bg-ink-800"
          >
            Read the contracts <Arrow />
          </a>
        </div>
      </div>
      <div className="mx-auto grid max-w-6xl gap-px border border-paper-line bg-paper-line px-0 sm:grid-cols-3">
        {[
          ["Liquidation · constant", "MCR 110%", "Below this a trove can be liquidated"],
          ["Recovery Mode · constant", "CCR 150%", "System TCR under this changes the rules"],
          ["Capacity · snapshot", "coll × price / 1.1", "Fixed at open; top-ups add safety only"],
        ].map(([a, b, c]) => (
          <div key={a} className="bg-paper p-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-btc-dim">{a}</div>
            <div className="display mt-2 text-3xl">{b}</div>
            <div className="mt-1 text-sm text-paper-mute">{c}</div>
          </div>
        ))}
      </div>
      <div className="h-24" />
    </section>
  )
}

// ---------------------------------------------------------------- fees

function Fees({ rate }: { rate?: number }) {
  return (
    <section className="paper border-t border-paper-line">
      <div className="mx-auto max-w-6xl px-5 py-24 text-center">
        <div className="eyebrow !text-btc-dim">Fees</div>
        <h2 className="display mt-4 text-5xl">Simple fees. Switched off on testnet.</h2>
        <p className="mx-auto mt-4 max-w-lg text-paper-mute">What Par plans to charge after the buildathon, and what MUSD itself costs. Today you only pay gas and MUSD&apos;s own terms.</p>
        <div className="mt-12 grid border border-paper-line text-left lg:grid-cols-3">
          <FeeCard name="Guarantees" price="0.5–1%" unit="a year on cover" lines={["Rent and installment guarantees", "Claim bonds with an arbiter", "Live certificate page"]} />
          <FeeCard dark name="Circuit" price="5–10 bps" unit="on gross cleared" lines={["Continuous netting", "Force-settle from clearing lines", "Only net debtors pay"]} tag="Most volume" />
          <FeeCard
            name="MUSD (Mezo)"
            price={rate !== undefined ? fmtBps(rate) : "1%"}
            unit="trove rate, on drawn MUSD"
            lines={["0.1% borrowing fee when drawn", "200 MUSD gas compensation, refunded on close", "1,800 MUSD minimum loan, kept as buffer"]}
          />
        </div>
      </div>
    </section>
  )
}

function FeeCard({ name, price, unit, lines, dark, tag }: { name: string; price: string; unit: string; lines: string[]; dark?: boolean; tag?: string }) {
  return (
    <div className={`flex flex-col p-7 ${dark ? "bg-ink-900 text-white" : "border-paper-line lg:[&:not(:first-child)]:border-l"}`}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{name}</span>
        {tag && <span className="rounded-[2px] bg-paper px-2 py-1 text-[11px] font-semibold text-paper-ink">● {tag}</span>}
        {!dark && <span className="font-mono text-[10px] uppercase tracking-widest text-paper-mute">{name.startsWith("MUSD") ? "today" : "off on testnet"}</span>}
      </div>
      <div className="mt-5 flex items-baseline gap-2">
        <span className={`display text-5xl ${dark ? "text-btc" : ""}`}>{price}</span>
        <span className={`text-sm ${dark ? "text-ink-400" : "text-paper-mute"}`}>{unit}</span>
      </div>
      <ul className={`mt-6 space-y-3 border-t pt-6 text-sm ${dark ? "border-ink-700" : "border-paper-line"}`}>
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] text-[10px] ${dark ? "bg-btc text-ink-950" : "bg-btc/20 text-btc-dim"}`}>✓</span>
            {l}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------- faq

const FAQ = [
  [
    "Isn't this just Aave credit delegation?",
    "No. On Aave the rate floats and the pool can be fully borrowed by other people right when a claim arrives. MUSD is minted, not borrowed from a pool, and a Mezo trove locks its rate across its whole capacity at open. A Par promise only depends on your own Bitcoin and your own trove.",
  ],
  [
    "What happens if Bitcoin crashes?",
    "Every promise has to survive a 40% drop with every promise called at once and the vault still above 160%. If the price falls past that, the vault can't make new promises and the owner is warned to add collateral. If it falls far enough to hit liquidation, a guarantee can fail. The certificate shows exactly how far that is.",
  ],
  [
    "What about Recovery Mode?",
    "In Recovery Mode MUSD only lets debt rise with a collateral top-up that improves the ratio. The claim stays valid, the vault computes exactly how much BTC it needs, and it pays as soon as that reserve is funded.",
  ],
  [
    "Why would a landlord accept MUSD?",
    "Today most landlords want local currency, and that's a real gap. The first users are crypto-native counterparties: P2P merchants, OTC desks, freelance clients. MUSD already bridges to Base and Ethereum, so an automatic off-ramp is next.",
  ],
  [
    "Who decides disputed claims?",
    "For installments, nobody: the contract can see whether the payment arrived. For bonds there's a challenge window, and only disputed claims go to an arbiter both sides agreed on when the bond was created.",
  ],
  [
    "Why does a vault borrow 1,800 MUSD at the start?",
    "That's MUSD's minimum loan. Par turns it into a buffer that pays the first claims without adding new debt.",
  ],
]

function Faq() {
  return (
    <section className="border-t border-ink-700 bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-24 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <div className="eyebrow">Questions</div>
          <h2 className="display mt-4 text-5xl">Asked by judges, landlords and engineers.</h2>
        </div>
        <div className="divide-y divide-ink-700 border-y border-ink-700">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg">
                {q}
                <span className="font-mono text-btc transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-ink-300">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="gridlines border-t border-ink-700 bg-ink-900">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-5 py-24 lg:flex-row lg:items-end lg:justify-between">
        <h2 className="display text-6xl">
          Make your first <em className="text-btc">promise.</em>
        </h2>
        <div className="flex gap-3">
          <Link href="/vault" className="inline-flex items-center gap-2 rounded-[3px] bg-btc px-6 py-3.5 text-sm font-semibold text-ink-950 hover:bg-btc-soft">
            Open a vault <Arrow />
          </Link>
          <Link href="/circuit" className="inline-flex items-center gap-2 rounded-[3px] border border-ink-600 px-6 py-3.5 text-sm font-semibold hover:border-btc">
            Explore Circuit
          </Link>
        </div>
      </div>
    </section>
  )
}

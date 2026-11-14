"use client"

import { useEffect, useRef, useState } from "react"
import { fmtBps } from "@/lib/format"
import { useReducedMotion } from "./motion"

const STEPS = [
  { t: "Lock", d: "Open a vault with BTC. Capacity and rate are fixed at open." },
  { t: "Promise", d: "Pledge undrawn capacity. It must survive a 40% BTC drop." },
  { t: "Miss", d: "A payment is missed. Once the grace period ends, anyone can trigger the vault." },
  { t: "Pay", d: "Buffer first, then mint. Straight to the beneficiary." },
]

/** `price` (USD/BTC) and `rate` (bps) are live from the Mezo oracle; undefined while loading. */
export function Story({ price, rate }: { price?: number; rate?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [btc, setBtc] = useState("0.25")
  const [pinned, setPinned] = useState(true)
  const reduce = useReducedMotion()

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const upd = () => setPinned(mq.matches)
    upd()
    mq.addEventListener("change", upd)
    return () => mq.removeEventListener("change", upd)
  }, [])

  useEffect(() => {
    if (!pinned) return
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const total = r.height - window.innerHeight
      setProgress(Math.max(0, Math.min(1, -r.top / Math.max(1, total))))
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [pinned])

  const [manual, setManual] = useState(0)
  const step = pinned ? Math.min(3, Math.floor(progress * 4 * 0.999)) : manual

  const go = (i: number) => {
    if (!pinned) return setManual(i)
    const el = ref.current!
    const total = el.getBoundingClientRect().height - window.innerHeight
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + total * ((i + 0.5) / 4), behavior: reduce ? "auto" : "smooth" })
  }

  // model numbers (same math as lib/risk.ts, in floats for display)
  // (undefined until the live price arrives: no made-up numbers in the meantime)
  const coll = Math.max(0, Number(btc) || 0)
  const seed = 1800
  const debt = seed * 1.001 + 200
  const cover = 1500
  const capacity = price === undefined ? undefined : (coll * price) / 1.1
  const stressed = price === undefined ? undefined : (coll * price * 0.6) / (debt + cover * 1.001)
  const fits = stressed === undefined || capacity === undefined ? undefined : stressed >= 1.6 && debt + cover * 1.001 <= capacity
  const maxCover =
    price === undefined || capacity === undefined ? undefined : Math.max(0, Math.min((coll * price * 0.6) / 1.6 - debt, capacity - debt) / 1.001)

  return (
    <section ref={ref} className={pinned ? "relative h-[360vh]" : "relative"}>
      <div className={pinned ? "sticky top-16 flex h-[calc(100vh-4rem)] items-center" : "py-16"}>
        <div className="mx-auto w-full max-w-6xl px-5">
          <h2 className="h-section">
            One promise. <span className="text-subtle">Four moves, one vault.</span>
          </h2>
          <div className="mt-8 grid grid-cols-1 items-center gap-6 sm:mt-12 lg:grid-cols-[1fr_1.05fr] lg:gap-12">
            {pinned ? (
            <ol className="relative">
                <span className="absolute bottom-6 left-[5px] top-6 w-px bg-line" />
                <span
                  className="absolute left-[5px] top-6 w-px bg-btc motion-safe:transition-[height] motion-safe:duration-300"
                  style={{ height: `calc(${progress * 100}% - 48px)` }}
                />
                {STEPS.map((s, i) => (
                  <li key={s.t}>
                    <button onClick={() => go(i)} className="relative flex w-full items-start gap-5 py-5 text-left">
                      <span
                        className={`relative z-10 mt-2 h-[11px] w-[11px] shrink-0 rounded-full border-2 transition ${
                          i <= step ? "border-btc bg-btc" : "border-line-strong bg-canvas"
                        }`}
                      />
                      <span>
                        <span className={`flex items-baseline gap-2 text-xl font-medium tracking-tight transition ${i === step ? "text-fg" : "text-subtle"}`}>
                          <span className="num text-xs">0{i + 1}</span>
                          {s.t}
                        </span>
                        <span className={`mt-1 block text-sm transition ${i === step ? "text-muted" : "text-subtle"}`}>{s.d}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="min-w-0">
                <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                  {STEPS.map((st, i) => (
                    <button
                      key={st.t}
                      onClick={() => go(i)}
                      className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                        i === step ? "border-fg bg-fg text-white" : "border-line-strong bg-white text-muted"
                      }`}
                    >
                      <span className="num text-[10px] opacity-70">0{i + 1}</span>
                      {st.t}
                    </button>
                  ))}
                </div>
                <p className="mt-4 text-muted">{STEPS[step].d}</p>
              </div>
            )}

            <div className="relative mx-auto w-full min-w-0 max-w-[440px]">
              <div className="rounded-[22px] border border-line bg-soft p-2">
                <div key={step} className="min-h-[340px] animate-rise rounded-2xl border border-line bg-white p-4 shadow-card sm:min-h-[360px] sm:p-5">
                  {step === 0 && <LockCard btc={btc} setBtc={setBtc} price={price} rate={rate} capacity={capacity} maxCover={maxCover} />}
                  {step === 1 && <PromiseCard fits={fits} stressed={stressed} cover={cover} />}
                  {step === 2 && <MissCard reduce={reduce} />}
                  {step === 3 && <PayCard />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Head({ left, right }: { left: string; right: string }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <span className="text-sm font-medium">{left}</span>
      <span className="num text-[11px] text-subtle">{right}</span>
    </div>
  )
}

function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "ok" | "btc" | "bad" | "muted" }) {
  const c = tone === "ok" ? "text-ok" : tone === "btc" ? "text-btc-ink" : tone === "bad" ? "text-bad" : tone === "muted" ? "text-subtle" : "text-fg"
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted">{k}</span>
      <span className={`num ${c}`}>{v}</span>
    </div>
  )
}

const fmt = (n: number, dp = 0) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })

const DASH = "—"

function LockCard({
  btc,
  setBtc,
  price,
  rate,
  capacity,
  maxCover,
}: {
  btc: string
  setBtc: (v: string) => void
  price?: number
  rate?: number
  capacity?: number
  maxCover?: number
}) {
  return (
    <>
      <Head left="Open vault" right="YOUR VAULT" />
      <label className="block rounded-xl bg-soft p-4">
        <span className="flex justify-between text-xs text-muted">
          <span>Lock</span>
          <span className="num">{price === undefined ? "loading price…" : `$${fmt(price)} / BTC`}</span>
        </span>
        <span className="mt-1 flex items-baseline gap-2">
          <input
            value={btc}
            onChange={(e) => setBtc(e.target.value.replace(/[^0-9.]/g, ""))}
            inputMode="decimal"
            aria-label="BTC to lock"
            className="num w-full bg-transparent text-4xl font-medium tracking-tight outline-none"
          />
          <span className="text-sm text-muted">BTC</span>
        </span>
        <span className="num text-xs text-subtle">{price === undefined ? DASH : `$${fmt((Number(btc) || 0) * price)}`}</span>
      </label>
      <div className="mt-3 divide-y divide-line">
        <Row k="Capacity (fixed at open)" v={capacity === undefined ? DASH : `${fmt(capacity)} MUSD`} />
        <Row k="Rate (locked at open, live)" v={rate === undefined ? DASH : fmtBps(rate)} />
        <Row k="Buffer draw" v="1,800 MUSD" />
        <Row k="Cover you can promise" v={maxCover === undefined ? DASH : `${fmt(maxCover)} MUSD`} tone="btc" />
      </div>
      <div className="mt-3 rounded-full bg-fg py-2.5 text-center text-sm font-medium text-white">Open trove</div>
    </>
  )
}

function PromiseCard({ fits, stressed, cover }: { fits?: boolean; stressed?: number; cover: number }) {
  const tone = fits === undefined ? "text-muted" : fits ? "text-ok" : "text-bad"
  return (
    <>
      <Head left="New guarantee" right="SCHEDULED" />
      <div className="divide-y divide-line">
        <Row k="Beneficiary" v="landlord" />
        <Row k="Schedule" v="12 × 500 MUSD, monthly" />
        <Row k="Cover cap" v={`${fmt(cover)} MUSD`} />
        <Row k="Grace period" v="3 days" />
      </div>
      <div className={`mt-4 rounded-xl p-4 ${fits === undefined ? "bg-soft" : fits ? "bg-ok-wash" : "bg-bad-wash"}`}>
        <div className="flex items-center justify-between text-xs">
          <span className={tone}>{fits === undefined ? "Waiting for the live price" : fits ? "✓ Passes the stress test" : "✕ Doesn't fit: lock more BTC"}</span>
          <span className="num text-muted">needs 160%</span>
        </div>
        <div className={`num mt-1 text-3xl font-medium tracking-tight ${tone}`}>{stressed === undefined ? DASH : `${fmt(stressed * 100)}%`}</div>
        <div className="text-xs text-muted">vault ratio if BTC fell 40% and everything were called</div>
      </div>
    </>
  )
}

function MissCard({ reduce }: { reduce: boolean }) {
  // illustrative countdown to the end of the grace period (static under reduced motion)
  const [s, setS] = useState(9)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setS((x) => (x <= 0 ? 9 : x - 1)), 1000)
    return () => clearInterval(t)
  }, [reduce])
  return (
    <>
      <Head left="Installments" right="CERTIFICATE #0" />
      <div className="divide-y divide-line">
        <Row k="Month 1 · 500" v="Paid by tenant" tone="ok" />
        <Row
          k="Month 2 · 500"
          v={reduce ? "Late · in grace period" : s > 0 ? `Late · grace ends in 0:0${s}` : "Grace over · triggerable"}
          tone={reduce || s > 0 ? "btc" : "bad"}
        />
        <Row k="Month 3 · 500" v="Due in 30 days" tone="muted" />
      </div>
      <div className="mt-4 rounded-xl bg-fg p-4 font-mono text-[12px] leading-relaxed text-white/90">
        <div className="text-white/50">// anyone can call this after due + grace</div>
        <div>
          vault.<span className="text-btc">triggerMissed</span>(0, 1, up, lo)
        </div>
        <div className="mt-2 text-white/50">keeper · checks every 15 s</div>
      </div>
    </>
  )
}

function PayCard() {
  return (
    <>
      <Head left="Payout" right="EXAMPLE" />
      <div className="flex items-center gap-3 rounded-xl bg-soft p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-wash text-ok">✓</span>
        <div>
          <div className="num text-2xl font-medium tracking-tight">500.00 MUSD</div>
          <div className="text-xs text-muted">sent to the landlord</div>
        </div>
      </div>
      <div className="mt-3 divide-y divide-line">
        <Row k="From buffer" v="500.00" />
        <Row k="Minted from trove" v="0.00" tone="muted" />
        <Row k="Cover remaining" v="1,000 / 1,500" />
        <Row k="Your BTC" v="never moved" tone="btc" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-full border border-line px-4 py-2.5 text-xs">
        <span className="text-muted">Payout(id 0, to landlord, 500)</span>
        <span className="text-subtle">illustrative</span>
      </div>
    </>
  )
}

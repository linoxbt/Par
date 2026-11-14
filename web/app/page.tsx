"use client"

import Link from "next/link"
import { fmtBps, fmtRatio, fmtUsd, toNum } from "@/lib/format"
import { useMarket } from "@/lib/hooks"
import { GlobeViz } from "@/components/landing/GlobeViz"
import { Story } from "@/components/landing/Story"
import { StressChart } from "@/components/landing/StressChart"
import { CodeCard, CopyChip, GlyphRain } from "@/components/landing/CodeCard"
import {
  CertificateIllustration,
  CircuitIllustration,
  ClaimIllustration,
  GaugeIllustration,
  LockIllustration,
  ShieldIllustration,
  VaultIllustration,
} from "@/components/landing/Illustrations"

const Arrow = () => <span aria-hidden>→</span>

export default function Landing() {
  const m = useMarket()
  const price = m.price ? toNum(m.price) : 66_000
  return (
    <div>
      <Hero />
      <Story price={price} />
      <Products />
      <Proof price={price} live={!!m.price} tcr={m.tcr} rate={m.globalRate} recovery={m.recoveryMode} />
      <Developers />
      <Scenario />
      <Risk />
      <Faq />
      <Closing />
    </div>
  )
}

function SectionHead({ title, muted, side, link }: { title: string; muted: string; side?: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
      <h2 className="h-section max-w-2xl">
        {title} <span className="text-subtle">{muted}</span>
      </h2>
      {(side || link) && (
        <div className="max-w-xs text-sm">
          {side && <p className="text-muted">{side}</p>}
          {link && (
            <Link href={link.href} className="mt-2 inline-flex items-center gap-1 font-medium text-btc-ink hover:underline">
              {link.label} <Arrow />
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- hero

function Hero() {
  const trust = [
    ["◐", "Built on MUSD · Mezo"],
    ["▲", "Stress-tested at −40%"],
    ["✓", "15 contract tests passing"],
    ["{}", "Open source, MIT"],
  ]
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 pb-16 pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:pt-20">
        <div className="relative z-10 animate-rise">
          <h1 className="h-display text-[52px] sm:text-[68px]">
            Promises that
            <br />
            pay themselves.
          </h1>
          <p className="mt-6 max-w-[440px] text-[17px] leading-relaxed text-muted">
            Par turns undrawn Bitcoin credit into a guarantee you can hand to anyone. Lock BTC in a vault on Mezo, back a rent guarantee or a trade-credit line,
            and the vault pays the moment a promise breaks.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link href="/vault" className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/80">
              Open a vault
            </Link>
            <Link href="/developers" className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-btc-ink hover:underline">
              Read the contracts <Arrow />
            </Link>
          </div>
          <div className="mt-12 grid max-w-md grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {trust.map(([i, t]) => (
              <span key={t} className="flex items-center gap-2 text-muted">
                <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-white font-mono text-[10px] text-fg">{i}</span>
                {t}
              </span>
            ))}
          </div>
        </div>
        <GlobeViz />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- products

function Products() {
  const cards = [
    { n: "#1", t: "Vault", d: "Lock BTC once. Capacity and rate fixed at open.", href: "/vault", ill: <VaultIllustration /> },
    { n: "#2", t: "Guarantees", d: "Rent and installments that pay themselves when missed.", href: "/vault/new-guarantee", ill: <CertificateIllustration /> },
    { n: "#3", t: "Bonds", d: "Claims with a challenge window and an arbiter you choose.", href: "/vault/new-guarantee", ill: <ClaimIllustration /> },
    { n: "#4", t: "Circuit", d: "Trade credit netted onchain. Only net debts settle.", href: "/circuit", ill: <CircuitIllustration /> },
  ]
  return (
    <section className="mx-auto max-w-6xl px-5 py-28">
      <SectionHead title="Four promises." muted="One vault." side="Each works on its own. Together they share one trove, one stress test and one buffer." link={{ href: "/developers", label: "Compare the contracts" }} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.t} href={c.href} className="group relative flex flex-col items-center rounded-3xl bg-soft px-6 pb-8 pt-6 text-center transition hover:bg-[#EFEFF1]">
            <span className="absolute right-5 top-4 font-mono text-[11px] text-subtle">{c.n}</span>
            <div className="h-44 w-full max-w-[300px] transition duration-500 group-hover:-translate-y-1">{c.ill}</div>
            <h3 className="mt-2 text-lg font-medium tracking-tight">{c.t}</h3>
            <span className="my-4 h-px w-full max-w-[240px] bg-line-strong/70" />
            <p className="text-sm text-muted">{c.d}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-btc-ink">
              {c.t} <Arrow />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- proof

function Proof({ price, live, tcr, rate, recovery }: { price: number; live: boolean; tcr?: bigint; rate?: number; recovery?: boolean }) {
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-28">
        <h2 className="h-section max-w-3xl">
          Built on MUSD <span className="text-subtle">— Bitcoin credit that is minted, not borrowed from a pool.</span>
        </h2>
        <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3 text-sm text-muted">
          {["BorrowerOperations", "TroveManager", "PriceFeed", "HintHelpers", "SortedTroves", "Mezo Passport"].map((n) => (
            <span key={n} className="flex items-center gap-2 font-medium text-fg/70">
              <span className="h-1.5 w-1.5 rounded-full bg-btc" />
              {n}
            </span>
          ))}
        </div>
        <div className="mt-12 grid grid-cols-2 border-y border-line md:grid-cols-4">
          {[
            ["BTC / USD", live ? fmtUsd(price) : "…", live ? "Mezo oracle, live" : "connecting"],
            ["System TCR", fmtRatio(tcr), recovery ? "Recovery Mode" : "Normal Mode"],
            ["Rate for new troves", rate !== undefined ? fmtBps(rate) : "…", "fixed for the whole capacity"],
            ["Netted in tests", "96.55%", "2,900 invoiced · 100 moved"],
          ].map(([l, v, s], i) => (
            <div key={l} className={`py-6 ${i % 2 ? "pl-6" : "pr-6"} ${i > 0 ? "md:border-l md:pl-6" : ""} ${i === 1 ? "border-l" : ""} ${i === 3 ? "border-l" : ""} border-line`}>
              <div className="text-xs text-muted">{l}</div>
              <div className="num mt-1 text-3xl font-medium tracking-tight">{v}</div>
              <div className="mt-1 text-xs text-subtle">{s}</div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="h-0.5 w-4 bg-btc" /> Vault ratio after every promise is called, as BTC falls
            </span>
            <span className="num">example vault · 0.25 BTC · 1,500 MUSD promised</span>
          </div>
          <StressChart price={price} />
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- developers

function Developers() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-28 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <h2 className="h-section">
          Read it <span className="text-subtle">this afternoon.</span>
        </h2>
        <p className="mt-4 max-w-md text-muted">Three small contracts, a keeper and this app. The tests run in a minute, and the same suite runs against the real MUSD system.</p>
        <div className="mt-8">
          <CopyChip text="git clone https://github.com/linoxbt/par && cd par/contracts && npm i && npm test" />
        </div>
        <ul className="mt-6 space-y-2.5 text-sm">
          {["15 tests: guarantees, claims, Recovery Mode, Circuit", "One script reruns them against real MUSD contracts", "Keeper and frontend included"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="text-ok">✓</span> {t}
            </li>
          ))}
        </ul>
        <Link href="/developers" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
          Read the developer guide <Arrow />
        </Link>
      </div>
      <CodeCard />
    </section>
  )
}

// ---------------------------------------------------------------- scenario (not a testimonial)

function Scenario() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-28">
      <div className="grid overflow-hidden rounded-3xl border border-line bg-white shadow-card md:grid-cols-[1.25fr_1fr]">
        <div className="p-8 sm:p-10">
          <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">Scenario · Lagos rent</span>
          <p className="mt-5 text-2xl font-medium leading-snug tracking-tight sm:text-[28px]">
            “Tenants here pay a year of rent upfront. With Par, a little Bitcoin guarantees the months instead, and the landlord gets paid even if I&apos;m late.”
          </p>
          <p className="mt-6 text-sm text-muted">An illustrative tenant, not a customer quote. The numbers are the spec&apos;s worked example.</p>
          <Link href="/vault/new-guarantee" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
            Build this guarantee <Arrow />
          </Link>
        </div>
        <div className="grid grid-cols-2 content-center gap-8 bg-soft p-8 sm:p-10">
          <div className="col-span-2 flex items-center gap-2 text-sm font-medium">
            <span className="h-2 w-2 rounded-full bg-btc" /> 0.1 BTC at $100,000
          </div>
          <div>
            <div className="num text-5xl font-medium tracking-tight">
              3<span className="text-xl text-subtle"> mo</span>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-subtle">rent guaranteed</div>
          </div>
          <div>
            <div className="num text-5xl font-medium tracking-tight">
              0<span className="text-xl text-subtle"> MUSD</span>
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-subtle">borrowed until missed</div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- risk

function Risk() {
  const cards = [
    { n: "#1", t: "Stress-tested", d: "Every promise must hold at BTC −40% with everything called.", link: ["Read the risk model", "/security"], ill: <GaugeIllustration /> },
    { n: "#2", t: "Your vault, your keys", d: "Each vault is your own immutable contract. No admin, no upgrades.", link: ["How vaults work", "/developers#contracts"], ill: <LockIllustration /> },
    { n: "#3", t: "Recovery Mode ready", d: "When MUSD restricts debt, the vault tops up from a BTC reserve.", link: ["See the waterfall", "/security#waterfall"], ill: <ShieldIllustration /> },
  ]
  return (
    <section className="mx-auto max-w-6xl px-5 pb-28">
      <SectionHead title="Built to be" muted="boring." side="A guarantee should be the least exciting thing in a tenant's month. Unaudited and on testnet today, and we say so." link={{ href: "/security", label: "Read the security overview" }} />
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.t} className="relative flex flex-col items-center rounded-3xl bg-soft px-6 pb-8 pt-6 text-center">
            <span className="absolute right-5 top-4 font-mono text-[11px] text-subtle">{c.n}</span>
            <div className="h-36 w-full max-w-[240px]">{c.ill}</div>
            <h3 className="mt-2 text-lg font-medium tracking-tight">{c.t}</h3>
            <span className="my-4 h-px w-full max-w-[200px] bg-line-strong/70" />
            <p className="text-sm text-muted">{c.d}</p>
            <Link href={c.link[1]} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
              {c.link[0]} <Arrow />
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- faq

const FAQ = [
  ["Isn't this just Aave credit delegation?", "No. On Aave the rate floats and the pool can be fully borrowed by others right when a claim arrives. MUSD is minted, not pooled, and a Mezo trove locks its rate across its whole capacity at open. A Par promise depends only on your own Bitcoin."],
  ["What happens if Bitcoin crashes?", "Every promise must survive a 40% drop with every promise called and the vault still above 160%. Past that the vault can't make new promises and the owner is alerted. Far enough to hit liquidation, a guarantee can fail, and the certificate shows exactly how far that is."],
  ["What about Recovery Mode?", "In Recovery Mode MUSD only allows new debt with a collateral top-up that improves the ratio. The vault computes the BTC it needs, pays from an idle reserve, and if the reserve is short the keeper alerts the owner and retries."],
  ["Who decides disputed claims?", "For installments nobody: the contract sees whether the payment arrived. For bonds there's a challenge window, and only disputed claims go to an arbiter both sides agreed on."],
  ["Why does a vault borrow 1,800 MUSD at the start?", "It's MUSD's minimum loan. Par keeps it in the vault as a buffer that pays the first claims without new debt."],
]

function Faq() {
  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-28 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h2 className="h-section">
          Questions, <span className="text-subtle">answered.</span>
        </h2>
        <Link href="/security" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
          Read the risk model <Arrow />
        </Link>
      </div>
      <div className="divide-y divide-line border-t border-line">
        {FAQ.map(([q, a], i) => (
          <details key={q} className="group py-5" open={i === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
              {q}
              <span className="text-subtle transition group-open:rotate-180">⌄</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section className="relative h-[420px] overflow-hidden">
      <GlyphRain />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <h2 className="h-display text-4xl sm:text-6xl">
          Ready when <span className="text-subtle">your promise is.</span>
        </h2>
        <div className="mt-8 flex gap-2">
          <Link href="/vault" className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-white hover:bg-black/80">
            Open a vault
          </Link>
          <Link href="/circuit" className="rounded-full bg-soft px-5 py-2.5 text-sm font-medium hover:bg-line">
            Explore Circuit
          </Link>
        </div>
      </div>
    </section>
  )
}

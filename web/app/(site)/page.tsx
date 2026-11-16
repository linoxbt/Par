import type { Metadata } from "next"
import Link from "next/link"
import { Footer } from "@/components/Footer"
import { GlobeViz } from "@/components/landing/GlobeViz"
import { LandingProof, LandingStory } from "@/components/landing/LandingClient"
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

export const metadata: Metadata = {
  title: { absolute: "Par · Bitcoin-backed promises on Mezo" },
  description:
    "Lock BTC in a vault on Mezo and back rent guarantees, bonds and trade credit with undrawn MUSD capacity. Every promise is stress-tested at BTC −40%. Testnet, unaudited.",
  alternates: { canonical: "/" },
}

const Arrow = () => <span aria-hidden>→</span>

/** Server-rendered landing page; only the live-market sections and animations hydrate. Footer: this page only. */
export default function Landing() {
  return (
    <div>
      <Hero />
      <LandingStory />
      <Products />
      <Proof />
      <Developers />
      <Scenario />
      <Risk />
      <Faq />
      <Closing />
      <Footer />
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
    ["✓", "Contract tests in the repo"],
    ["{}", "Open source, MIT"],
  ]
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-2 px-5 pb-12 pt-10 sm:gap-6 sm:pb-16 sm:pt-14 lg:grid-cols-[0.95fr_1.05fr] lg:pt-20">
        <div className="relative z-10 animate-rise">
          <Link
            href="/pilot"
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-btc-line bg-btc-wash py-1 pl-1 pr-3 text-[13px] text-btc-ink hover:border-btc"
          >
            <span className="rounded-full bg-btc px-2 py-0.5 text-[11px] font-medium text-fg">New</span>
            Lagos pilot &amp; underwriting market <span aria-hidden>→</span>
          </Link>
          <h1 className="h-display text-[42px] sm:text-[60px] lg:text-[68px]">
            Promises that <br className="hidden sm:block" />
            pay themselves.
          </h1>
          <p className="mt-5 max-w-[440px] text-base leading-relaxed text-muted sm:mt-6 sm:text-[17px]">
            Par turns undrawn Bitcoin credit into a guarantee you can hand to anyone. Lock BTC in a vault on Mezo and back a rent guarantee or a trade-credit
            line. Miss a payment and the vault pays once the grace period ends. Anyone can trigger it; nobody approves it.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Link href="/vault" className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black/80">
              Open a vault
            </Link>
            <Link href="/developers" className="inline-flex items-center gap-1 px-4 py-2.5 text-sm font-medium text-btc-ink hover:underline">
              Read the contracts <Arrow />
            </Link>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-1 gap-x-6 gap-y-3 text-sm min-[420px]:grid-cols-2 sm:mt-12">
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
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
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

function Proof() {
  return (
    <section className="border-y border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
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
        <LandingProof />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- developers

function Developers() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 sm:gap-14 sm:py-28 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="min-w-0">
        <h2 className="h-section">
          Read it <span className="text-subtle">this afternoon.</span>
        </h2>
        <p className="mt-4 max-w-md text-muted">Three small contracts, a keeper and this app. The tests run in about a minute, and the core suite also runs against the real MUSD system.</p>
        <div className="mt-8">
          <CopyChip text="git clone https://github.com/linoxbt/par && cd par/contracts && npm i && npm test" />
        </div>
        <ul className="mt-6 space-y-2.5 text-sm">
          {["Tests for guarantees, claims, Recovery Mode and Circuit", "One script reruns the core suite against the real MUSD contracts", "Keeper and frontend included"].map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="text-ok">✓</span> {t}
            </li>
          ))}
        </ul>
        <Link href="/developers" className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
          Read the developer guide <Arrow />
        </Link>
      </div>
      <div className="min-w-0">
        <CodeCard />
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- scenario (not a testimonial)

function Scenario() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 sm:pb-28">
      <div className="grid overflow-hidden rounded-3xl border border-line bg-white shadow-card md:grid-cols-[1.25fr_1fr]">
        <div className="p-6 sm:p-10">
          <span className="font-mono text-[11px] uppercase tracking-wider text-subtle">Scenario · Lagos rent</span>
          <p className="mt-5 text-xl font-medium leading-snug tracking-tight sm:text-[28px]">
            “Tenants here pay a year of rent upfront. With Par, a little Bitcoin guarantees the months instead, and the landlord gets paid even if I&apos;m late.”
          </p>
          <p className="mt-6 text-sm text-muted">An illustrative tenant, not a customer quote. The numbers are the spec&apos;s worked example.</p>
          <Link href="/vault/new-guarantee" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
            Build this guarantee <Arrow />
          </Link>
        </div>
        <div className="grid grid-cols-2 content-center gap-6 bg-soft p-6 sm:gap-8 sm:p-10">
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
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-subtle">drawn for it until a month is missed</div>
          </div>
          <p className="col-span-2 text-xs leading-relaxed text-muted">
            Every vault draws MUSD&apos;s 1,800 minimum when it opens and keeps it as a buffer that pays first. The guarantee itself draws nothing until it is
            called.
          </p>
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
    {
      n: "#3",
      t: "A plan for Recovery Mode",
      d: "In Recovery Mode a payout that needs new debt also needs a BTC top-up, paid from idle BTC you keep in the vault. If that reserve is short, the payout waits until it is funded.",
      link: ["See the waterfall", "/security#waterfall"],
      ill: <ShieldIllustration />,
    },
  ]
  return (
    <section className="mx-auto max-w-6xl px-5 pb-20 sm:pb-28">
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
  ["What happens if Bitcoin crashes?", "Every promise must survive a 40% drop with every promise called and the vault still above 160%. Past that the vault can't make new promises and the owner is alerted. If BTC falls far enough for the trove to be liquidated (below 110%), guarantees can fail. The certificate shows how far BTC can fall before the vault, with everything called, reaches 150%, MUSD's Recovery Mode line, which comes well before liquidation."],
  ["What about Recovery Mode?", "In Recovery Mode MUSD only allows new debt with a collateral top-up that improves the ratio. Payouts from the MUSD buffer need no new debt and are unaffected. For the rest, the vault computes the BTC it needs and adds it from idle BTC held in the vault as a reserve; if the reserve is short, the payout reverts with the amount needed and the keeper alerts the owner and retries. While Recovery Mode is on and promises are live, the owner can't withdraw that BTC reserve, but can still withdraw the MUSD buffer at any time."],
  ["Who decides disputed claims?", "For installments nobody: the contract sees whether the payment arrived. For bonds there's a challenge window, and only disputed claims go to an arbiter both sides agreed on."],
  ["Why does a vault borrow 1,800 MUSD at the start?", "It's MUSD's minimum loan. Par keeps it in the vault as a buffer that pays the first claims without new debt."],
]

function Faq() {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-20 sm:gap-12 sm:pb-28 lg:grid-cols-[0.8fr_1.2fr]">
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
    <section className="relative h-[360px] overflow-hidden sm:h-[420px]">
      <GlyphRain />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
        <h2 className="h-display text-4xl sm:text-6xl">
          Ready when <span className="text-subtle">your promise is.</span>
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
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

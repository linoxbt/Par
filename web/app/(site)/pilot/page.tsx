import type { Metadata } from "next"
import Link from "next/link"
import { getFx } from "@/lib/fx-server"

export const metadata: Metadata = {
  title: "Lagos pilot",
  description: "Rent guarantees and merchant bonds for Lagos, backed by Bitcoin on Mezo. Tenants and merchants request cover; Bitcoin holders back it for a premium.",
}
export const revalidate = 3600

const ngn = (n: number) => "₦" + new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(n)
const musd = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " MUSD"

function Section({ kicker, title, muted, children, id }: { kicker: string; title: string; muted?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <div className="tag">{kicker}</div>
      <h2 className="h-display mt-3 max-w-3xl text-[34px] sm:text-5xl">
        {title} {muted && <span className="text-subtle">{muted}</span>}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  )
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-white p-6 shadow-card ${className}`}>{children}</div>
}

export default async function PilotPage() {
  const fx = await getFx()
  // Worked example in naira: a ₦350,000 monthly rent, guaranteed for 12 months with 3 months of cover.
  const rentNgn = 350_000
  const rate = fx?.ngnPerUsd
  const rentMusd = rate ? rentNgn / rate : undefined
  const coverMusd = rentMusd ? rentMusd * 3 : undefined
  const premiumMusd = coverMusd ? coverMusd * 0.03 : undefined

  return (
    <div>
      {/* hero */}
      <section className="mx-auto max-w-6xl px-5 pb-10 pt-14 sm:pt-20">
        <div className="tag">Par · Lagos pilot</div>
        <h1 className="h-display mt-4 max-w-4xl text-[44px] sm:text-7xl">
          Stop paying two years upfront. <span className="text-subtle">Let Bitcoin stand behind the promise.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted sm:text-lg">
          Tenants and merchants in Lagos request cover for their rent or supplier terms. Bitcoin holders back it from their own vaults for a premium.
          Landlords and suppliers get a live certificate that pays automatically if a payment is missed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/market/new?template=rent" className="rounded-full bg-fg px-5 py-3 text-sm font-medium text-white hover:bg-black/80">
            Request rent cover
          </Link>
          <Link href="/market/new?template=bond" className="rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-medium hover:bg-soft">
            Request a merchant bond
          </Link>
          <Link href="/market" className="rounded-full px-5 py-3 text-sm font-medium text-btc-ink hover:underline">
            Back a request and earn the premium →
          </Link>
        </div>
        <p className="mt-6 text-xs text-subtle">
          Pilot on Mezo testnet. {fx ? <>Naira figures use {ngn(fx.ngnPerUsd)} per US$ (MUSD ≈ $1), rates by <a className="underline" href={fx.sourceUrl} target="_blank" rel="noreferrer">{fx.source}</a>, updated {fx.updated.replace(/ \+0000$/, " UTC")}.</> : "Naira figures are unavailable right now."}
        </p>
      </section>

      {/* who it's for */}
      <Section kicker="Who it's for" title="Three people," muted="one promise.">
        <div className="grid gap-5 md:grid-cols-3">
          <Card>
            <div className="text-lg font-semibold">Tenants</div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Pay rent monthly instead of a year or two upfront. You request a guarantee for your landlord and pay a small premium once. No Bitcoin needed.
            </p>
          </Card>
          <Card>
            <div className="text-lg font-semibold">Landlords &amp; suppliers</div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Get a live certificate you can check any time. If a payment is missed, the backer&apos;s vault pays you in MUSD after the grace period, with nobody to chase.
            </p>
          </Card>
          <Card>
            <div className="text-lg font-semibold">Bitcoin holders</div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">
              Earn premiums by backing local promises with your vault&apos;s unused MUSD capacity. Every promise must pass the 40% stress test first.
            </p>
          </Card>
        </div>
      </Section>

      {/* worked example */}
      <Section kicker="A worked example" title="₦350,000 a month," muted="without a year upfront.">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <table className="w-full text-[15px]">
              <tbody className="divide-y divide-line">
                {[
                  ["Monthly rent", ngn(rentNgn), rentMusd ? `≈ ${musd(rentMusd)}` : "—"],
                  ["Guarantee", "12 monthly installments", "the landlord is the beneficiary"],
                  ["Cover (3 months of rent)", ngn(rentNgn * 3), coverMusd ? `≈ ${musd(coverMusd)}` : "—"],
                  ["Premium offered (3% of cover)", rate && premiumMusd ? ngn(premiumMusd * rate) : "—", premiumMusd ? `≈ ${musd(premiumMusd)}, paid once` : "—"],
                ].map(([a, b, c]) => (
                  <tr key={a}>
                    <td className="py-3 pr-4 text-muted">{a}</td>
                    <td className="num py-3 pr-4 font-medium">{b}</td>
                    <td className="num py-3 text-right text-xs text-subtle">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-xs text-subtle">The premium is set by the tenant; underwriters choose which requests to back. Amounts settle in MUSD.</p>
          </Card>
          <Card className="bg-canvas">
            <div className="text-sm font-medium">What the landlord holds</div>
            <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-muted">
              <li>• A certificate showing cover remaining, expiry and how far BTC can fall before cover is at risk</li>
              <li>• Automatic payment of a missed month after the grace period, from the backer&apos;s vault</li>
              <li>• Nothing to sign, no one to chase, verifiable onchain</li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* how the pilot runs */}
      <Section kicker="How the pilot runs" title="From request" muted="to a live guarantee.">
        <ol className="grid gap-5 md:grid-cols-4">
          {[
            ["Request", "The tenant or merchant posts the terms and escrows a premium in MUSD."],
            ["Back", "A Bitcoin holder backs it from their vault in one transaction, after the stress test."],
            ["Share", "The landlord or supplier gets the certificate link, by WhatsApp or any channel."],
            ["Pay or be covered", "Pay each month on the payer page. Miss one, and the vault pays."],
          ].map(([t, d], i) => (
            <li key={t}>
              <Card className="h-full">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fg font-mono text-xs text-white">{i + 1}</span>
                <div className="mt-3 font-semibold">{t}</div>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{d}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Section>

      {/* faq */}
      <Section kicker="Questions" title="Before you join.">
        <div className="grid gap-5 md:grid-cols-2">
          {[
            ["Do I need Bitcoin to get cover?", "No. Tenants and merchants only need MUSD for the premium and their own payments. The backer locks the Bitcoin."],
            ["What if I stop paying?", "After the grace period the backer's vault pays the landlord, up to the cover cap. The guarantee covers the landlord, not the tenant's debt to the backer."],
            ["How is a merchant bond decided?", "The beneficiary files a claim with evidence. If nobody disputes it within the window it pays; disputes go to an independent arbiter, with a 7-day deadline."],
            ["Is this live with real money?", "Not yet. The pilot runs on Mezo testnet while terms, premiums and parameters are tested with real users. Contracts are unaudited."],
          ].map(([q, a]) => (
            <Card key={q}>
              <div className="font-semibold">{q}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{a}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/market/new?template=rent" className="rounded-full bg-fg px-5 py-3 text-sm font-medium text-white hover:bg-black/80">
            Request cover
          </Link>
          <Link href="/docs/guides/underwriting" className="rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-medium hover:bg-soft">
            Read the guide
          </Link>
        </div>
      </Section>
    </div>
  )
}

import Link from "next/link"
import { Card, CardGroup } from "@/components/docs/Cards"
import { HeroSearch } from "@/components/docs/HeroSearch"
import { Icon } from "@/components/docs/icons"
import { docMetadata } from "@/components/docs/meta"

export const metadata = docMetadata("/docs")

const SECTIONS: { title: string; blurb: string; cols: number; cards: { title: string; href: string; icon: string; body: string }[] }[] = [
  {
    title: "Start here",
    blurb: "New to Par? Read these in order.",
    cols: 3,
    cards: [
      { title: "Overview", href: "/docs/learn/overview", icon: "book", body: "What Par is, who it is for, and how a vault turns Bitcoin into a promise." },
      { title: "Quickstart", href: "/docs/learn/quickstart", icon: "rocket", body: "Connect, open a vault and share a live guarantee in a few minutes." },
      { title: "How it works", href: "/docs/learn/how-it-works", icon: "layers", body: "Vault, trove, capacity, commitments and the payout waterfall." },
    ],
  },
  {
    title: "Products",
    blurb: "Two products share one vault.",
    cols: 2,
    cards: [
      { title: "Par Guarantees", href: "/docs/learn/guarantees", icon: "file", body: "Rent and installment guarantees that pay themselves on a missed payment, and bonds that pay after an uncontested claim." },
      { title: "Par Circuit", href: "/docs/learn/circuit", icon: "circuit", body: "Businesses that sell to each other log invoices. Only net debts settle; defaulters are paid for by their vault." },
      { title: "Make a guarantee", href: "/docs/guides/make-guarantee", icon: "receipt", body: "Step by step: installments or a claim bond, the stress test, and the certificate link." },
      { title: "Risk and safety", href: "/docs/learn/risk", icon: "shield", body: "The 40% stress test, Mezo's 110% and 150% lines, Recovery Mode, and what can go wrong." },
    ],
  },
  {
    title: "Developers",
    blurb: "Three contracts, one keeper, all permissionless.",
    cols: 3,
    cards: [
      { title: "ParVault reference", href: "/docs/reference/par-vault", icon: "code", body: "Functions, events and errors of the vault contract." },
      { title: "Deployed addresses", href: "/docs/reference/addresses", icon: "pin", body: "Mezo testnet network details and every contract address." },
      { title: "Keeper", href: "/docs/reference/keeper", icon: "clock", body: "What the bot automates every 15 seconds, and how to run your own." },
    ],
  },
]

export default function DocsHome() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_70%)]"
          style={{ backgroundImage: "radial-gradient(rgba(10,10,11,0.09) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        />
        <div className="relative mx-auto max-w-[760px] px-5 pb-16 pt-14 text-center sm:pb-20 sm:pt-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-[12px] text-muted shadow-card">
            <span className="h-1.5 w-1.5 rounded-full bg-btc" />
            Mezo testnet
          </div>
          <h1 className="mt-5 text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] text-fg sm:text-[52px]">Par documentation</h1>
          <p className="mx-auto mt-4 max-w-[540px] text-[17px] leading-relaxed text-muted">
            Lock Bitcoin once, back guarantees and trade credit with its undrawn MUSD capacity. Learn the model, follow a guide, or read the contracts.
          </p>
          <div className="mx-auto mt-8 max-w-[560px]">
            <HeroSearch />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13.5px] text-muted">
            {[
              ["/docs/guides/open-vault", "Open a vault"],
              ["/docs/guides/settle-cycle", "Settle a cycle"],
              ["/docs/reference/parameters", "Parameters"],
              ["/docs/reference/faq", "FAQ"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="inline-flex items-center gap-1 transition hover:text-fg">
                {label}
                <Icon name="arrowRight" size={13} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1080px] px-5 pb-24 pt-4 sm:px-6">
        {SECTIONS.map((s) => (
          <section key={s.title} className="pt-12 sm:pt-14">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-fg sm:text-[24px]">{s.title}</h2>
            <p className="mt-1 text-[15px] text-muted">{s.blurb}</p>
            <CardGroup cols={s.cols}>
              {s.cards.map((c) => (
                <Card key={c.href} title={c.title} href={c.href} icon={c.icon}>
                  {c.body}
                </Card>
              ))}
            </CardGroup>
          </section>
        ))}

        <section className="mt-14 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-canvas p-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-[15px] font-semibold text-fg">Ready to try it?</div>
            <p className="mt-1 text-[14px] text-muted">Par runs on Mezo testnet. The contracts are unaudited; use testnet funds only.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/docs/learn/quickstart" className="flex h-10 items-center rounded-full border border-line-strong bg-white px-4 text-[14px] text-fg hover:border-fg">
              Quickstart
            </Link>
            <Link href="/vault" className="flex h-10 items-center rounded-full bg-fg px-4 text-[14px] font-medium text-white hover:bg-black/80">
              Open app
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

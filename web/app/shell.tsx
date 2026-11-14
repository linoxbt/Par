"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Providers } from "./providers"
import { Header, Logo } from "@/components/Header"

const COLS: [string, [string, string][]][] = [
  ["Product", [["Vault", "/vault"], ["Guarantees", "/vault/new-guarantee"], ["Circuit", "/circuit"]]],
  ["Developers", [["Quickstart", "/developers"], ["Contracts", "/developers#contracts"], ["Keeper", "/developers#keeper"], ["GitHub", "https://github.com/linoxbt/par"]]],
  ["Protocol", [["Security", "/security"], ["MUSD docs", "https://mezo.org/docs/developers/musd"], ["MUSD contracts", "https://github.com/mezo-org/musd"], ["Mezo", "https://mezo.org"]]],
]

function Footer() {
  return (
    <footer className="mt-10 overflow-hidden border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-5 pb-10 pt-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-muted">Bitcoin-backed promises on Mezo. Guarantees and trade-credit clearing, backed by undrawn MUSD capacity.</p>
        </div>
        {COLS.map(([h, items]) => (
          <div key={h} className="flex flex-col gap-2.5 text-sm">
            <span className="mb-1 font-medium">{h}</span>
            {items.map(([l, href]) =>
              href.startsWith("http") ? (
                <a key={l} href={href} target="_blank" rel="noreferrer" className="text-muted hover:text-fg">
                  {l}
                </a>
              ) : (
                <Link key={l} href={href} className="text-muted hover:text-fg">
                  {l}
                </Link>
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-line px-5 py-5 text-xs text-subtle">
        <span>© 2026 Par · testnet, unaudited</span>
        <a href="https://github.com/linoxbt/par" target="_blank" rel="noreferrer" className="hover:text-fg">
          GitHub ↗
        </a>
      </div>
      <div aria-hidden className="pointer-events-none mx-auto -mb-[0.28em] max-w-6xl select-none px-5 text-[clamp(120px,24vw,340px)] font-semibold leading-none tracking-[-0.07em] text-soft">
        par
      </div>
    </footer>
  )
}

const FULL = ["/", "/developers", "/security"]

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <Header />
        {FULL.includes(path) ? <main className="flex-1">{children}</main> : <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-5 sm:py-12">{children}</main>}
        <Footer />
      </div>
    </Providers>
  )
}

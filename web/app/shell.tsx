"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Providers } from "./providers"
import { Header, Logo } from "@/components/Header"

function Footer() {
  return (
    <footer className="border-t border-ink-700 bg-ink-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-ink-400">
            Bitcoin-backed guarantees and trade-credit clearing on Mezo, backed by undrawn MUSD capacity. Testnet, unaudited.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="label mb-1">Product</span>
          <Link href="/vault" className="text-ink-300 hover:text-white">Vault</Link>
          <Link href="/vault/new-guarantee" className="text-ink-300 hover:text-white">Guarantees</Link>
          <Link href="/circuit" className="text-ink-300 hover:text-white">Circuit</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <span className="label mb-1">Built on</span>
          <a href="https://mezo.org/docs/developers/musd" target="_blank" rel="noreferrer" className="text-ink-300 hover:text-white">MUSD</a>
          <a href="https://github.com/mezo-org/musd" target="_blank" rel="noreferrer" className="text-ink-300 hover:text-white">MUSD contracts</a>
          <a href="https://mezo.org" target="_blank" rel="noreferrer" className="text-ink-300 hover:text-white">Mezo</a>
        </div>
      </div>
    </footer>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const fullBleed = path === "/"
  return (
    <Providers>
      <Header />
      {fullBleed ? <main>{children}</main> : <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>}
      <Footer />
    </Providers>
  )
}

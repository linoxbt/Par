"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Providers } from "./providers"
import { Header, Logo } from "@/components/Header"

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-muted">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="text-subtle">Bitcoin-backed promises on Mezo · testnet, unaudited</span>
        </div>
        <div className="flex gap-5">
          <Link href="/vault" className="hover:text-fg">Vault</Link>
          <Link href="/circuit" className="hover:text-fg">Circuit</Link>
          <a href="https://github.com/linoxbt/par" target="_blank" rel="noreferrer" className="hover:text-fg">GitHub</a>
          <a href="https://mezo.org/docs/developers/musd" target="_blank" rel="noreferrer" className="hover:text-fg">MUSD docs</a>
        </div>
      </div>
    </footer>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <Providers>
      <Header />
      {path === "/" ? <main>{children}</main> : <main className="mx-auto max-w-6xl px-5 py-10">{children}</main>}
      <Footer />
    </Providers>
  )
}

"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { NETWORK } from "@/lib/config"

export function Header() {
  const path = usePathname()
  const nav = [
    { href: "/vault", label: "Vault" },
    { href: "/vault/new-guarantee", label: "Guarantee" },
    { href: "/circuit", label: "Circuit" },
  ]
  return (
    <header className="sticky top-0 z-30 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <span className="inline-block h-3 w-3 rounded-full bg-btc" />
            Par
            {NETWORK !== "mainnet" && <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-ink-300">{NETWORK}</span>}
          </Link>
          <nav className="hidden gap-4 text-sm sm:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className={path === n.href ? "text-white" : "text-ink-400 hover:text-white"}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
    </header>
  )
}

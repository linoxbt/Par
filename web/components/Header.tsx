"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { NETWORK } from "@/lib/config"
import { useMarket } from "@/lib/hooks"
import { fmtRatio, fmtUsd, toNum } from "@/lib/format"

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <rect width="22" height="22" rx="6" fill="#0A0A0B" />
        <path d="M7 16V6h4.4a2.9 2.9 0 0 1 0 5.8H7" fill="none" stroke="#fff" strokeWidth="1.7" />
        <circle cx="15.5" cy="15.5" r="1.6" fill="#F7931A" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">Par</span>
    </span>
  )
}

/** Compact live status: oracle price, system TCR, mode. */
export function LiveStatus() {
  const m = useMarket()
  return (
    <div className="hidden items-center gap-3 rounded-full border border-line bg-white px-3 py-1.5 text-xs md:flex">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${m.recoveryMode ? "bg-warn" : "bg-ok"} animate-pulseDot`} />
        <span className="text-muted">{m.recoveryMode === undefined ? "connecting" : m.recoveryMode ? "Recovery Mode" : "Normal"}</span>
      </span>
      <span className="h-3 w-px bg-line" />
      <span className="num">BTC {m.price ? fmtUsd(toNum(m.price)) : "…"}</span>
      <span className="h-3 w-px bg-line" />
      <span className="num text-muted">TCR {fmtRatio(m.tcr)}</span>
    </div>
  )
}

export function Header() {
  const path = usePathname()
  const nav = [
    { href: "/vault", label: "Vault" },
    { href: "/vault/new-guarantee", label: "Guarantee" },
    { href: "/circuit", label: "Circuit" },
  ]
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            {NETWORK !== "mainnet" && <span className="rounded-md bg-soft px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">{NETWORK}</span>}
          </Link>
          <nav className="hidden gap-1 text-sm sm:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 transition ${path === n.href ? "bg-white font-medium text-fg shadow-card" : "text-muted hover:text-fg"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LiveStatus />
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        </div>
      </div>
    </header>
  )
}

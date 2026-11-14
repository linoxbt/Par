"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { NETWORK, chain } from "@/lib/config"
import { useMarket } from "@/lib/hooks"
import { fmtBps, fmtMusd, fmtRatio, fmtUsd, toNum } from "@/lib/format"

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect x="1" y="1" width="24" height="24" rx="3" fill="none" stroke="#F7931A" strokeWidth="1.5" />
        <path d="M8 18V8h5.2a3.2 3.2 0 0 1 0 6.4H8" fill="none" stroke="#F7931A" strokeWidth="1.8" />
        <path d="M13 18h5" stroke="#F7931A" strokeWidth="1.8" />
      </svg>
      <span className="font-serif text-2xl leading-none">Par</span>
    </span>
  )
}

function Ticker() {
  const m = useMarket()
  const items: [string, React.ReactNode, string?][] = [
    ["BTC/USD", m.price ? fmtUsd(toNum(m.price)) : "…"],
    ["SYSTEM TCR", fmtRatio(m.tcr)],
    ["MODE", m.recoveryMode === undefined ? "…" : m.recoveryMode ? "RECOVERY" : "NORMAL", m.recoveryMode ? "text-warn" : "text-ok"],
    ["NEW TROVE RATE", m.globalRate !== undefined ? fmtBps(m.globalRate) : "…"],
    ["MIN DEBT", `${fmtMusd(m.minNetDebt, 0)} MUSD`],
    ["MCR", "110%"],
    ["CCR", "150%"],
    ["STRESS TEST", "−40% · ≥160%"],
    ["CHAIN", `${chain.name.toUpperCase()} · ${chain.id}`],
  ]
  const row = (k: string) => (
    <div className="flex shrink-0 items-center" key={k}>
      {items.map(([l, v, c]) => (
        <span key={l + k} className="flex items-center gap-2 px-5 font-mono text-[11px] uppercase tracking-[0.12em]">
          <span className="text-ink-400">{l}</span>
          <span className={c ?? "text-white"}>{v}</span>
          <span className="pl-5 text-ink-600">/</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="overflow-hidden border-b border-ink-700 bg-ink-950 py-2">
      <div className="flex w-max animate-ticker">
        {row("a")}
        {row("b")}
      </div>
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
    <header className="sticky top-0 z-30 bg-ink-900/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Logo />
          </Link>
          {NETWORK !== "mainnet" && (
            <span className="rounded-[3px] border border-ink-600 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-300">{NETWORK}</span>
          )}
        </div>
        <nav className="hidden gap-8 text-sm sm:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "text-white" : "text-ink-300 hover:text-white"}>
              {n.label}
            </Link>
          ))}
        </nav>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>
      <Ticker />
    </header>
  )
}

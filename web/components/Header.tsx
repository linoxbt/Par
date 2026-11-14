"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useMarket } from "@/lib/hooks"
import { fmtRatio, fmtUsd, toNum } from "@/lib/format"

/** Par mark: a coin split into two equal halves ("at par"): locked BTC above, the payment it backs below. */
export function Mark({ size = 24, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M3 15a13 13 0 0 1 26 0z" fill={inverted ? "#FFFFFF" : "#0A0A0B"} />
      <path d="M3 17h26a13 13 0 0 1-26 0z" fill="#F7931A" />
    </svg>
  )
}

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label="Par">
      <Mark size={24} inverted={inverted} />
      <span className={`text-[21px] font-semibold leading-none tracking-[-0.05em] ${inverted ? "text-white" : "text-fg"}`}>par</span>
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
          <Link href="/" className="flex items-center">
            <Logo />
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

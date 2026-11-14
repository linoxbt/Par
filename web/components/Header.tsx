"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
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
      <Mark size={22} inverted={inverted} />
      <span className={`text-[20px] font-semibold leading-none tracking-[-0.05em] ${inverted ? "text-white" : "text-fg"}`}>par</span>
    </span>
  )
}

/** Compact live status: oracle price, system TCR, mode. */
export function LiveStatus() {
  const m = useMarket()
  return (
    <div className="hidden items-center gap-3 rounded-full bg-soft px-3 py-1.5 text-xs lg:flex">
      <span className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${m.recoveryMode ? "bg-warn" : "bg-ok"} animate-pulseDot`} />
        <span className="text-muted">{m.recoveryMode === undefined ? "connecting" : m.recoveryMode ? "Recovery" : "Normal"}</span>
      </span>
      <span className="num">BTC {m.price ? fmtUsd(toNum(m.price)) : "…"}</span>
      <span className="num text-muted">TCR {fmtRatio(m.tcr)}</span>
    </div>
  )
}

const PRODUCTS = [
  { href: "/vault", t: "Vault", d: "Lock BTC once. Capacity and rate fixed at open.", i: "◐" },
  { href: "/vault/new-guarantee", t: "Guarantees", d: "Rent, supplier terms and bonds that pay themselves.", i: "§" },
  { href: "/circuit", t: "Circuit", d: "Trade credit netted onchain. Only net debts settle.", i: "⇄" },
]

function ProductsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-fg/80 hover:text-fg">
        Products <span className={`text-[10px] transition ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full pt-2">
          <div className="w-80 animate-rise rounded-2xl border border-line bg-white p-2 shadow-float">
            {PRODUCTS.map((p) => (
              <Link key={p.href} href={p.href} onClick={() => setOpen(false)} className="flex gap-3 rounded-xl p-3 hover:bg-soft">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-sm">{p.i}</span>
                <span>
                  <span className="block text-sm font-medium">{p.t}</span>
                  <span className="block text-xs text-muted">{p.d}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const MARKETING = ["/", "/developers", "/security"]

export function Header() {
  const path = usePathname()
  const marketing = MARKETING.includes(path)
  const link = (href: string, label: string) => (
    <Link href={href} className={`rounded-full px-3 py-1.5 text-sm transition ${path === href ? "text-fg" : "text-fg/70 hover:text-fg"}`}>
      {label}
    </Link>
  )
  return (
    <header className="sticky top-0 z-40 px-4 pt-3">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full border border-line bg-white/90 pl-5 pr-2 shadow-card backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <nav className="hidden items-center md:flex">
            <ProductsMenu />
            {link("/circuit", "Circuit")}
            {link("/developers", "Developers")}
            {link("/security", "Security")}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {marketing ? (
            <>
              <Link href="/vault/new-guarantee" className="hidden rounded-full px-4 py-2 text-sm text-fg/80 hover:text-fg sm:block">
                Make a guarantee
              </Link>
              <Link href="/vault" className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80">
                Open app
              </Link>
            </>
          ) : (
            <>
              <LiveStatus />
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
            </>
          )}
        </div>
      </div>
    </header>
  )
}

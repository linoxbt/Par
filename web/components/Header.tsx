"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { useMarket } from "@/lib/market"
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
  { href: "/market", t: "Market", d: "Request cover with a premium, or back requests and earn it.", i: "◎" },
]

function ProductsMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [])
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-fg/80 hover:text-fg">
        Products <span aria-hidden className={`text-[10px] transition ${open ? "rotate-180" : ""}`}>▾</span>
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

const MOBILE_LINKS: [string, string][] = [
  ["/vault", "Vault"],
  ["/vault/new-guarantee", "Guarantees"],
  ["/circuit", "Circuit"],
  ["/market", "Market"],
  ["/pilot", "Lagos pilot"],
  ["/docs", "Docs"],
  ["/developers", "Developers"],
  ["/security", "Security"],
]

/**
 * Site header. Marketing, docs and legal pages render it without a wallet (server-rendered, no wallet
 * stack). App routes pass their wallet button in, which also switches the right side to live status.
 */
export function Header({ wallet }: { wallet?: React.ReactNode }) {
  const path = usePathname()
  const app = wallet !== undefined
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("keydown", esc)
    return () => document.removeEventListener("keydown", esc)
  }, [open])
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])
  const link = (href: string, label: string) => (
    <Link href={href} className={`rounded-full px-3 py-1.5 text-sm transition ${path === href ? "text-fg" : "text-fg/70 hover:text-fg"}`}>
      {label}
    </Link>
  )
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-full border border-line bg-white/90 pl-4 pr-2 shadow-card backdrop-blur-md sm:pl-5">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <Logo />
          </Link>
          <nav className="hidden items-center md:flex">
            <ProductsMenu />
            {link("/pilot", "Pilot")}
            {link("/docs", "Docs")}
            {link("/developers", "Developers")}
            {link("/security", "Security")}
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {!app ? (
            <>
              <Link href="/vault/new-guarantee" className="hidden rounded-full px-4 py-2 text-sm text-fg/80 hover:text-fg lg:block">
                Make a guarantee
              </Link>
              <Link href="/vault" className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-white transition hover:bg-black/80">
                Open app
              </Link>
            </>
          ) : (
            <>
              <LiveStatus />
              {wallet}
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-soft md:hidden"
          >
            <span className="relative block h-3 w-4">
              <span className={`absolute left-0 h-[1.5px] w-4 bg-fg transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-1.5 h-[1.5px] w-4 bg-fg transition ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 h-[1.5px] w-4 bg-fg transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-x-0 bottom-0 top-[72px] z-40 bg-canvas/95 px-3 backdrop-blur-md md:hidden">
          <nav className="mx-auto mt-2 max-w-6xl animate-rise rounded-3xl border border-line bg-white p-2 shadow-float">
            {MOBILE_LINKS.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-[17px] ${path === href ? "bg-soft font-medium" : ""}`}
              >
                {label}
                <span aria-hidden className="text-subtle">›</span>
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-line px-2 pb-1 pt-3">
              <MobileStatus />
              {app ? (
                wallet
              ) : (
                <Link href="/vault" className="rounded-full bg-fg px-4 py-2 text-sm font-medium text-white">
                  Open app
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}

function MobileStatus() {
  const m = useMarket()
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className={`h-1.5 w-1.5 rounded-full ${m.recoveryMode ? "bg-warn" : "bg-ok"}`} />
      <span className="num">BTC {m.price ? fmtUsd(toNum(m.price)) : "…"}</span>
      <span className="num">· TCR {fmtRatio(m.tcr)}</span>
    </span>
  )
}

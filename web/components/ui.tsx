"use client"

import Link from "next/link"
import { addrUrl, txUrl } from "@/lib/config"
import { short } from "@/lib/format"

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[3px] border border-ink-700 bg-ink-900/80 p-6 ${className}`}>{children}</div>
}

export function Stat({
  label,
  value,
  unit,
  sub,
  href,
  tone,
}: {
  label: string
  value: React.ReactNode
  unit?: string
  sub?: React.ReactNode
  href?: string
  tone?: "ok" | "warn" | "bad" | "btc"
}) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "btc" ? "text-btc" : "text-white"
  const v = (
    <span className={`num text-xl ${color}`}>
      {value}
      {unit && <span className="ml-1 text-sm text-ink-400">{unit}</span>}
    </span>
  )
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="hover:underline">
          {v}
        </a>
      ) : (
        v
      )}
      {sub && <span className="text-xs text-ink-400">{sub}</span>}
    </div>
  )
}

export function Addr({ a, label }: { a?: string; label?: string }) {
  if (!a) return <span className="num text-ink-400">–</span>
  return (
    <a href={addrUrl(a)} target="_blank" rel="noreferrer" className="num text-ink-300 hover:text-btc" title={a}>
      {label ?? short(a)}
    </a>
  )
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="num text-btc hover:underline">
      {label ?? short(hash)} ↗
    </a>
  )
}

export function Button({
  children,
  onClick,
  disabled,
  busy,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  variant?: "primary" | "ghost" | "danger"
  className?: string
  type?: "button" | "submit"
}) {
  const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] px-4 py-2.5 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40"
  const style =
    variant === "primary"
      ? "bg-btc text-ink-950 hover:bg-btc-soft"
      : variant === "danger"
        ? "bg-bad/90 text-white hover:bg-bad"
        : "border border-ink-600 text-ink-300 hover:border-btc hover:text-white"
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={`${base} ${style} ${className}`}>
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const style =
    variant === "primary" ? "bg-btc text-ink-950 hover:bg-btc-soft" : "border border-ink-600 text-white hover:border-btc"
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 rounded-[3px] px-5 py-3 text-sm font-semibold tracking-wide transition ${style}`}>
      {children}
    </Link>
  )
}

export function TxStatus({ tx }: { tx: { hash?: string; error?: string; busy: boolean; done: boolean } }) {
  if (tx.error) return <p className="text-sm text-bad">{tx.error}</p>
  if (tx.hash)
    return (
      <p className="text-sm text-ink-300">
        {tx.done ? "Confirmed" : "Pending"} · <TxLink hash={tx.hash} />
      </p>
    )
  return null
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-400">{hint}</span>}
    </label>
  )
}

export const inputCls =
  "w-full rounded-[3px] border border-ink-600 bg-ink-950/70 px-3 py-2.5 font-mono text-sm text-white outline-none placeholder:text-ink-600 focus:border-btc"

export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted" | "btc"; children: React.ReactNode }) {
  const c =
    tone === "ok"
      ? "bg-ok/15 text-ok border-ok/30"
      : tone === "warn"
        ? "bg-warn/15 text-warn border-warn/30"
        : tone === "bad"
          ? "bg-bad/15 text-bad border-bad/30"
          : tone === "btc"
            ? "bg-btc/15 text-btc border-btc/30"
            : "bg-ink-700 text-ink-300 border-ink-600"
  return <span className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.12em] ${c}`}>{children}</span>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[3px] border border-dashed border-ink-600 p-10 text-center text-ink-300">{children}</div>
}

/** Stressed ICR vs target, on a 0..(target*2) scale. */
export function HealthGauge({ stressedIcr, target, ok }: { stressedIcr: bigint; target: bigint; ok: boolean }) {
  const max = Number(target) * 2.5
  const pct = Math.min(100, (Number(stressedIcr) / max) * 100)
  const tPct = (Number(target) / max) * 100
  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-[2px] bg-ink-700">
        <div className={`h-full ${ok ? "bg-btc" : "bg-bad"}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-white/70" style={{ left: `${tPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-wider text-ink-400">
        <span>stressed ICR</span>
        <span>target {Math.round(Number(target) / 1e16)}%</span>
      </div>
    </div>
  )
}

/** Page heading in the serif/mono system: "01 / VAULT" eyebrow, serif title, optional subline. */
export function PageHead({ index, eyebrow, title, sub, right }: { index?: string; eyebrow: string; title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink-700 pb-6">
      <div className="max-w-2xl">
        <div className="eyebrow">
          {index ? `${index} / ` : ""}
          {eyebrow}
        </div>
        <h1 className="display mt-3 text-4xl sm:text-5xl">{title}</h1>
        {sub && <p className="mt-3 text-ink-300">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

/** Card section title with a mono index. */
export function CardTitle({ index, children, right }: { index?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        {index && <span className="font-mono text-[11px] text-btc">{index}</span>}
        <h2 className="font-serif text-2xl">{children}</h2>
      </div>
      {right}
    </div>
  )
}

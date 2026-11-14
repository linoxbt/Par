"use client"

import Link from "next/link"
import { addrUrl, txUrl } from "@/lib/config"
import { short } from "@/lib/format"
import { useIsParVault } from "@/lib/hooks"

export function Card({ children, className = "", pad = true }: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return <div className={`rounded-2xl border border-line bg-white shadow-card ${pad ? "p-6" : ""} ${className}`}>{children}</div>
}

/** Card header: title + optional description + right slot. */
export function CardTitle({ children, sub, right }: { index?: string; children: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageHead({ eyebrow, title, muted, sub, right }: { index?: string; eyebrow?: string; title: React.ReactNode; muted?: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <div className="tag mb-2">{eyebrow}</div>}
        <h1 className="h-display text-4xl sm:text-[44px]">
          {title}
          {muted && <span className="text-subtle"> {muted}</span>}
        </h1>
        {sub && <p className="mt-3 text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Stat({
  label,
  value,
  unit,
  sub,
  href,
  tone,
  size = "md",
}: {
  label: string
  value: React.ReactNode
  unit?: string
  sub?: React.ReactNode
  href?: string
  tone?: "ok" | "warn" | "bad" | "btc"
  size?: "md" | "lg"
}) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : tone === "btc" ? "text-btc-ink" : "text-fg"
  const v = (
    <span className={`num ${size === "lg" ? "text-3xl" : "text-xl"} font-medium tracking-tight ${color}`}>
      {value}
      {unit && <span className="ml-1 text-xs font-normal text-subtle">{unit}</span>}
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
      {sub && <span className="text-xs text-subtle">{sub}</span>}
    </div>
  )
}

export function Addr({ a, label }: { a?: string; label?: string }) {
  if (!a) return <span className="num text-subtle">–</span>
  return (
    <a href={addrUrl(a)} target="_blank" rel="noreferrer" className="num text-fg underline decoration-line-strong underline-offset-4 hover:decoration-btc" title={a}>
      {label ?? short(a)}
    </a>
  )
}

export function TxLink({ hash, label }: { hash: string; label?: string }) {
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="num text-xs text-btc-ink hover:underline">
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
  size = "md",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  variant?: "primary" | "ghost" | "danger" | "accent"
  className?: string
  type?: "button" | "submit"
  size?: "sm" | "md"
}) {
  const base = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
    size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-5 py-2.5 text-sm"
  }`
  const style =
    variant === "primary"
      ? "bg-fg text-white hover:bg-black/80"
      : variant === "accent"
        ? "bg-btc text-fg hover:bg-btc-ink hover:text-white"
        : variant === "danger"
          ? "bg-bad text-white hover:bg-bad/90"
          : "border border-line-strong bg-white text-fg hover:border-fg"
  return (
    <button type={type} onClick={onClick} disabled={disabled || busy} className={`${base} ${style} ${className}`}>
      {busy && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  )
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "ghost" }) {
  const style = variant === "primary" ? "bg-fg text-white hover:bg-black/80" : "border border-line-strong bg-white text-fg hover:border-fg"
  return (
    <Link href={href} className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition ${style}`}>
      {children}
    </Link>
  )
}

export function TxStatus({ tx }: { tx: { hash?: string; error?: string; busy: boolean; done: boolean } }) {
  if (tx.error) return <p className="rounded-lg bg-bad-wash px-3 py-2 text-sm text-bad">{tx.error}</p>
  if (tx.hash)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${tx.done ? "bg-ok" : "animate-pulseDot bg-btc"}`} />
        {tx.done ? "Confirmed" : "Pending"} · <TxLink hash={tx.hash} />
      </p>
    )
  return null
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-subtle">{hint}</span>}
    </label>
  )
}

export const inputCls =
  "w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 font-mono text-sm text-fg outline-none transition placeholder:text-subtle focus:border-fg focus:ring-4 focus:ring-black/5"

export function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted" | "btc"; children: React.ReactNode }) {
  const c =
    tone === "ok"
      ? "bg-ok-wash text-ok"
      : tone === "warn"
        ? "bg-warn-wash text-warn"
        : tone === "bad"
          ? "bg-bad-wash text-bad"
          : tone === "btc"
            ? "bg-btc-wash text-btc-ink"
            : "bg-soft text-muted"
  const dot = tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : tone === "bad" ? "bg-bad" : tone === "btc" ? "bg-btc" : "bg-subtle"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </span>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line-strong bg-white p-10 text-center text-muted">{children}</div>
}

/** Stressed ICR vs target. */
export function HealthGauge({ stressedIcr, target, ok }: { stressedIcr: bigint; target: bigint; ok: boolean }) {
  const max = Number(target) * 2.5
  const pct = Math.min(100, (Number(stressedIcr) / max) * 100)
  const tPct = (Number(target) / max) * 100
  return (
    <div>
      <div className="relative h-2 overflow-hidden rounded-full bg-soft">
        <div className={`h-full rounded-full ${ok ? "bg-fg" : "bg-bad"}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-btc" style={{ left: `${tPct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>stressed ratio</span>
        <span className="text-btc-ink">floor {Math.round(Number(target) / 1e16)}%</span>
      </div>
    </div>
  )
}

/** Thin progress meter. */
export function Meter({ value, tone = "fg" }: { value: number; tone?: "fg" | "btc" | "ok" }) {
  const c = tone === "btc" ? "bg-btc" : tone === "ok" ? "bg-ok" : "bg-fg"
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-soft">
      <div className={`h-full rounded-full ${c} transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

/** Segmented control. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" className="inline-flex rounded-full border border-line bg-soft p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-sm transition ${value === o.value ? "bg-white font-medium text-fg shadow-card" : "text-muted hover:text-fg"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Shown on app pages until NEXT_PUBLIC_FACTORY / NEXT_PUBLIC_CIRCUIT point at a Par deployment. */
export function NotDeployed() {
  return (
    <div className="flex gap-4 rounded-2xl border border-btc-line bg-btc-wash p-6">
      <span className="mt-1 h-2 w-2 shrink-0 animate-pulseDot rounded-full bg-btc" />
      <div>
        <div className="font-medium">Testnet deployment pending</div>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Par&apos;s contracts aren&apos;t on Mezo testnet yet, so vaults, guarantees and circles can&apos;t be created here today. The market data in the
          header is live from Mezo&apos;s MUSD contracts. To try the full flow, run it locally with <span className="num text-fg">./scripts/dev-local.sh</span>.
        </p>
      </div>
    </div>
  )
}

/** Inline error / not-found state for app pages (bad links, missing contracts, failed reads). */
export function Problem({ title, children, action }: { title: string; children?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-line bg-white p-8 text-center">
      <div className="text-lg font-medium">{title}</div>
      {children && <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>}
      {action && (
        <a href={action.href} className="mt-5 inline-block rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-white hover:bg-black/80">
          {action.label}
        </a>
      )}
    </div>
  )
}

/**
 * Renders children only for vaults created by the Par factory (ParFactory.isVault). Any contract
 * can mimic getCommitment(), so nothing about a guarantee is shown, and no approve/pay is offered,
 * until the factory vouches for the address.
 */
export function ParVaultGate({ vault, children }: { vault: string; children: React.ReactNode }) {
  const { isVault, error, configured } = useIsParVault(vault as `0x${string}`)
  if (!configured)
    return (
      <Problem title="Par isn't deployed on this network" action={{ href: "/", label: "Back to Par" }}>
        This guarantee can&apos;t be verified here.
      </Problem>
    )
  if (isVault === false)
    return (
      <Problem title="This address isn't a Par vault" action={{ href: "/vault", label: "Open the app" }}>
        {short(vault)} was not created by the Par factory, so nothing it reports is a Par guarantee. Don&apos;t rely on this link.
      </Problem>
    )
  if (isVault === undefined && error)
    return (
      <Problem title="Couldn't verify this vault" action={{ href: "/vault", label: "Open the app" }}>
        The network didn&apos;t answer. Reload the page to try again.
      </Problem>
    )
  if (isVault === undefined) return <div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl border border-line bg-white" />
  return <>{children}</>
}

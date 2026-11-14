import { formatUnits } from "viem"

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max })

export const toNum = (v: bigint | undefined, decimals = 18) => (v === undefined ? 0 : Number(formatUnits(v, decimals)))

export const fmtMusd = (v: bigint | undefined, dp = 2) => (v === undefined ? "–" : nf(0, dp).format(toNum(v)))
export const fmtBtc = (v: bigint | undefined, dp = 4) => (v === undefined ? "–" : nf(0, dp).format(toNum(v)))
export const fmtUsd = (n: number) => "$" + nf(0, 0).format(n)
/** 1e18-scaled ratio -> "160%" */
export const fmtRatio = (v: bigint | undefined) =>
  v === undefined ? "–" : v > 10n ** 24n ? "∞" : nf(0, 0).format(toNum(v) * 100) + "%"
export const fmtPct = (n: number, dp = 0) => nf(0, dp).format(n * 100) + "%"
export const fmtBps = (bps: number | bigint, dp = 2) => nf(0, dp).format(Number(bps) / 100) + "%"

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "–")

export function fmtDuration(sec: number) {
  if (sec <= 0) return "0s"
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export const fmtDate = (ts: number | bigint) =>
  new Date(Number(ts) * 1000).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })

/**
 * Safe input parsing. Never throws: returns undefined for anything that isn't a clean number, so
 * typing "1,500", "1e3" or "0.1." can't crash a page during render.
 */
const DEC = /^\d+(\.\d+)?$/
export function parseAmount(input: string | undefined, decimals = 18): bigint | undefined {
  const s = (input ?? "").trim().replace(/_/g, "")
  if (!DEC.test(s)) return undefined
  const [w, f = ""] = s.split(".")
  if (f.length > decimals) return undefined
  try {
    return BigInt(w) * 10n ** BigInt(decimals) + BigInt((f + "0".repeat(decimals)).slice(0, decimals) || "0")
  } catch {
    return undefined
  }
}
/** Positive integer (or zero when allowZero) from a string; undefined otherwise. */
export function parseIntSafe(input: string | number | undefined, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}): number | undefined {
  const s = String(input ?? "").trim()
  if (!/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return n >= min && n <= max ? n : undefined
}
/** Unsigned integer route param as bigint; undefined if malformed. */
export function parseId(input: string | undefined): bigint | undefined {
  return input && /^\d{1,30}$/.test(input) ? BigInt(input) : undefined
}

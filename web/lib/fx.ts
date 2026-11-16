"use client"

import { useEffect, useState } from "react"
import { formatUnits } from "viem"

/** ₦ per US$ (MUSD ≈ $1), loaded once per page from /api/fx. undefined until loaded or if unavailable. */
let cached: Promise<number | undefined> | undefined
export function useNgnRate() {
  const [rate, setRate] = useState<number>()
  useEffect(() => {
    cached ??= fetch("/api/fx")
      .then((r) => (r.ok ? r.json() : undefined))
      .then((d) => (d && Number.isFinite(d.ngnPerUsd) ? (d.ngnPerUsd as number) : undefined))
      .catch(() => undefined)
    cached.then(setRate)
  }, [])
  return rate
}

export const fmtNgn = (naira: number) =>
  "₦" + new Intl.NumberFormat("en-NG", { maximumFractionDigits: naira >= 1000 ? 0 : 2 }).format(naira)

/** "≈ ₦1,352,108" for an 18-decimals MUSD amount, or null while the rate is unknown. */
export function useNgn() {
  const rate = useNgnRate()
  return (musdWei: bigint | undefined) => (rate === undefined || musdWei === undefined ? null : "≈ " + fmtNgn(Number(formatUnits(musdWei, 18)) * rate))
}

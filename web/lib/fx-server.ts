/** Server-only USD→NGN reference rate (MUSD ≈ $1). Rates by ExchangeRate-API (open access), cached 1 h. */
export type Fx = { ngnPerUsd: number; updated: string; source: string; sourceUrl: string }

export async function getFx(): Promise<Fx | null> {
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 3600 } })
    if (!r.ok) return null
    const d = await r.json()
    const ngn = Number(d?.rates?.NGN)
    if (d?.result !== "success" || !Number.isFinite(ngn) || ngn <= 0) return null
    return { ngnPerUsd: ngn, updated: d.time_last_update_utc, source: "ExchangeRate-API", sourceUrl: "https://www.exchangerate-api.com" }
  } catch {
    return null
  }
}


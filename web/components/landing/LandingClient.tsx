"use client"

import { fmtBps, fmtRatio, fmtUsd, toNum } from "@/lib/format"
import { useMarket } from "@/lib/market"
import { Story } from "./Story"
import { StressChart } from "./StressChart"

/**
 * The landing page's live-data islands. Market data comes from lib/market (plain viem reads of the
 * Mezo oracle); until it arrives nothing pretends to be a price: values show "…" and the chart a skeleton.
 */
function useLivePrice() {
  const m = useMarket()
  return { m, price: m.price ? toNum(m.price) : undefined }
}

export function LandingStory() {
  const { m, price } = useLivePrice()
  return <Story price={price} rate={m.globalRate} />
}

export function LandingProof() {
  const { m, price } = useLivePrice()
  const stats: [string, string, string][] = [
    ["BTC / USD", price !== undefined ? fmtUsd(price) : "…", price !== undefined ? "Mezo oracle, live" : m.error ? "price unavailable" : "connecting"],
    ["System TCR", m.tcr !== undefined ? fmtRatio(m.tcr) : "…", m.recoveryMode === undefined ? "connecting" : m.recoveryMode ? "Recovery Mode" : "Normal Mode"],
    ["Rate for new troves", m.globalRate !== undefined ? fmtBps(m.globalRate) : "…", "fixed for the whole capacity"],
    ["Netted in tests", "96.55%", "2,900 invoiced · 100 moved"],
  ]
  return (
    <>
      <div className="mt-12 grid grid-cols-2 border-y border-line md:grid-cols-4">
        {stats.map(([l, v, s], i) => (
          <div key={l} className={`py-6 ${i % 2 ? "pl-6" : "pr-6"} ${i > 0 ? "md:border-l md:pl-6" : ""} ${i === 1 || i === 3 ? "border-l" : ""} border-line`}>
            <div className="text-xs text-muted">{l}</div>
            <div className="num mt-1 text-3xl font-medium tracking-tight">{v}</div>
            <div className="mt-1 text-xs text-subtle">{s}</div>
          </div>
        ))}
      </div>
      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-btc" /> Vault ratio after every promise is called, as BTC falls
          </span>
          <span className="num">example vault · 0.25 BTC · 1,500 MUSD promised · live BTC price</span>
        </div>
        {price !== undefined ? (
          <StressChart price={price} />
        ) : (
          <div className="flex h-[240px] items-center justify-center rounded-2xl bg-soft text-xs text-muted sm:h-[310px]" role="status">
            Waiting for the live BTC price…
          </div>
        )}
      </div>
    </>
  )
}

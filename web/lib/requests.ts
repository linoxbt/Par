"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type Address } from "viem"
import { usePublicClient } from "wagmi"
import { parMarketAbi } from "./abi"
import { MARKET } from "./config"

export const RKIND = ["Installment guarantee", "Claim bond"] as const
export const RSTATUS = ["None", "Open", "Filled", "Cancelled"] as const
export const R_OPEN = 1
export const R_FILLED = 2
export const R_CANCELLED = 3

export type CoverRequest = {
  id: bigint
  requester: Address
  kind: number
  status: number
  deadline: bigint
  beneficiary: Address
  start: bigint
  period: number
  arbiter: Address
  grace: number
  count: number
  challengeWindow: number
  vault: Address
  expiry: bigint
  installment: bigint
  cap: bigint
  premium: bigint
  commitmentId: bigint
  ref: `0x${string}`
}

/**
 * Every cover request on ParMarket. Incremental: filled/cancelled requests are final, so each poll
 * reads only new ids and still-open ones. A request's status only ever moves forward.
 */
const cache = new Map<number, CoverRequest>()
let next = 0

export function useRequests() {
  const pc = usePublicClient()
  const [all, setAll] = useState<CoverRequest[]>(() => [...cache.values()])
  const [error, setError] = useState<string>()
  const [loaded, setLoaded] = useState(cache.size > 0)
  const load = useCallback(async () => {
    if (!pc || MARKET === "0x0000000000000000000000000000000000000000") return
    try {
      const n = Number(await pc.readContract({ address: MARKET, abi: parMarketAbi, functionName: "nextRequestId" }))
      const ids: number[] = []
      for (const [id, r] of cache) if (r.status === R_OPEN) ids.push(id)
      for (let i = next; i < n; i++) ids.push(i)
      const rows = await Promise.all(ids.map((id) => pc.readContract({ address: MARKET, abi: parMarketAbi, functionName: "getRequest", args: [BigInt(id)] })))
      rows.forEach((r: any, j) => {
        const id = ids[j]
        const prev = cache.get(id)
        const status = Number(r.status)
        if (prev && prev.status > status) return
        cache.set(id, {
          id: BigInt(id),
          requester: r.requester,
          kind: Number(r.kind),
          status,
          deadline: r.deadline,
          beneficiary: r.beneficiary,
          start: r.start,
          period: Number(r.period),
          arbiter: r.arbiter,
          grace: Number(r.grace),
          count: Number(r.count),
          challengeWindow: Number(r.challengeWindow),
          vault: r.vault,
          expiry: r.expiry,
          installment: r.installment,
          cap: r.cap,
          premium: r.premium,
          commitmentId: r.commitmentId,
          ref: r.ref,
        })
      })
      next = Math.max(next, n)
      setAll([...cache.values()].sort((a, b) => Number(b.id - a.id)))
      setError(undefined)
    } catch (e) {
      setError((e as Error)?.message?.split("\n")[0] ?? "Couldn't load requests")
    } finally {
      setLoaded(true)
    }
  }, [pc])
  useEffect(() => {
    load()
    const t = setInterval(load, 8_000)
    return () => clearInterval(t)
  }, [load])
  return useMemo(() => ({ requests: all, error, loaded, refetch: load }), [all, error, loaded, load])
}

/** Premium as an annualised share of cover, over the request's life (from deadline to expiry). */
export function premiumYield(r: Pick<CoverRequest, "premium" | "cap" | "expiry" | "start" | "deadline" | "kind">): number | undefined {
  if (r.cap === 0n) return undefined
  const from = Number(r.kind === 0 ? r.start : r.deadline)
  const years = (Number(r.expiry) - from) / (365 * 86400)
  if (years <= 0) return undefined
  return Number(r.premium) / Number(r.cap) / years
}

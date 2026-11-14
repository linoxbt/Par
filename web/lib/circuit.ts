"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { type Address } from "viem"
import { usePublicClient, useReadContract, useReadContracts } from "wagmi"
import { parCircuitAbi } from "./abi"
import { CIRCUIT } from "./config"

const C = { address: CIRCUIT, abi: parCircuitAbi } as const
const ZERO = "0x0000000000000000000000000000000000000000" as Address

export type Invoice = {
  id: bigint
  circleId: bigint
  creditor: Address
  debtor: Address
  amount: bigint
  cycle: bigint
  status: number // 1 pending, 2 accepted, 3 rejected
  ref: `0x${string}`
}

export function useCircles() {
  const { data: n } = useReadContract({ ...C, functionName: "nextCircleId", query: { refetchInterval: 15_000 } })
  const count = Number(n ?? 0n)
  const { data, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({ ...C, functionName: "circles" as const, args: [BigInt(i)] as const })),
    allowFailure: false,
    query: { enabled: count > 0 },
  })
  const { data: members } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({ ...C, functionName: "members_" as const, args: [BigInt(i)] as const })),
    allowFailure: false,
    query: { enabled: count > 0 },
  })
  return {
    circles: (data ?? []).map((c, i) => ({
      id: BigInt(i),
      admin: c[0],
      genesis: c[1],
      cycleLength: c[2],
      settleWindow: c[3],
      members: (members?.[i] ?? []) as Address[],
    })),
    refetch,
  }
}

/**
 * Invoices for one circle. Incremental: settled invoices (accepted/rejected) are immutable, so only
 * new ids and still-pending ones are re-read on each poll (not every invoice ever created).
 */
const invCache = new Map<number, Invoice>()
let invNext = 0

export function useInvoices(circleId: bigint) {
  const pc = usePublicClient()
  const [tick, setTick] = useState(0)
  const [all, setAll] = useState<Invoice[]>(() => [...invCache.values()])
  const load = useCallback(async () => {
    if (!pc) return
    try {
      const n = Number(await pc.readContract({ ...C, functionName: "nextInvoiceId" }))
      const ids: number[] = []
      for (const [id, inv] of invCache) if (inv.status === 1) ids.push(id)
      for (let i = invNext; i < n; i++) ids.push(i)
      for (let k = 0; k < ids.length; k += 200) {
        const batch = ids.slice(k, k + 200)
        const calls = batch.map((id) => ({ ...C, functionName: "invoices" as const, args: [BigInt(id)] as const }))
        // local hardhat has no Multicall3: fall back to plain reads
        const res = pc.chain?.contracts?.multicall3
          ? await pc.multicall({ contracts: calls, allowFailure: false })
          : await Promise.all(calls.map((c) => pc.readContract(c)))
        res.forEach((r: any, j: number) => {
          const id = batch[j]
          invCache.set(id, { id: BigInt(id), circleId: r[0], creditor: r[1], debtor: r[2], amount: r[3], cycle: r[4], status: Number(r[5]), ref: r[6] })
        })
      }
      invNext = Math.max(invNext, n)
      setAll([...invCache.values()])
    } catch {
      /* keep the last good snapshot; next poll retries */
    }
  }, [pc])
  useEffect(() => {
    load()
    const t = setInterval(load, 6_000)
    return () => clearInterval(t)
  }, [load, tick])
  const invoices = useMemo(() => all.filter((x) => x.circleId === circleId).sort((x, y) => Number(x.id - y.id)), [all, circleId])
  return {
    invoices,
    refetch: async () => {
      await load()
      setTick((x) => x + 1)
    },
  }
}

export function useCircle(circleId: bigint, cycle: bigint | undefined, me?: Address) {
  // 1) the circle itself. currentCycle divides by cycleLength, so it is only read once the circle exists.
  const head = useReadContract({ ...C, functionName: "circles", args: [circleId], query: { refetchInterval: 15_000 } })
  const circle = head.data as readonly [Address, bigint, bigint, bigint, boolean] | undefined
  const exists = !!circle?.[4]
  const base = useReadContracts({
    contracts: [
      { ...C, functionName: "members_", args: [circleId] },
      { ...C, functionName: "currentCycle", args: [circleId] },
      { ...C, functionName: "invites", args: [circleId, me ?? ZERO] },
    ],
    allowFailure: false,
    query: { enabled: exists, refetchInterval: 6_000 },
  })
  const members = (base.data?.[0] ?? []) as Address[]
  const current = base.data?.[1] as bigint | undefined
  const invite = base.data?.[2] as readonly [Address, bigint, boolean] | undefined
  const cyc = cycle ?? current ?? 0n

  const K = 7
  const perMember = useReadContracts({
    contracts: members.flatMap((m) => [
      { ...C, functionName: "net" as const, args: [circleId, cyc, m] as const },
      { ...C, functionName: "settled" as const, args: [circleId, cyc, m] as const },
      { ...C, functionName: "creditLimit" as const, args: [circleId, m] as const },
      { ...C, functionName: "members" as const, args: [circleId, m] as const },
      { ...C, functionName: "claimed" as const, args: [circleId, cyc, m] as const },
      { ...C, functionName: "lineHeadroom" as const, args: [circleId, m] as const },
      { ...C, functionName: "suspended" as const, args: [circleId, m] as const },
    ]),
    allowFailure: true,
    query: { enabled: exists && members.length > 0, refetchInterval: 6_000 },
  })
  const totals = useReadContracts({
    contracts: [
      { ...C, functionName: "gross", args: [circleId, cyc] },
      { ...C, functionName: "totalOwed", args: [circleId, cyc] },
      { ...C, functionName: "collected", args: [circleId, cyc] },
      { ...C, functionName: "nettingEfficiencyBps", args: [circleId, cyc] },
      { ...C, functionName: "cycleClose", args: [circleId, cyc] },
      { ...C, functionName: "finalAt", args: [circleId, cyc] },
      { ...C, functionName: "finalized", args: [circleId, cyc] },
    ],
    allowFailure: false,
    query: { enabled: exists, refetchInterval: 6_000 },
  })

  const rows = members
    .map((m, i) => {
      const d = perMember.data
      const r = <T,>(j: number) => d?.[i * K + j]?.result as T | undefined
      const mem = r<readonly [Address, bigint, boolean]>(3)
      return {
        member: m,
        net: r<bigint>(0) ?? 0n,
        settled: r<boolean>(1) ?? false,
        limit: r<bigint>(2) ?? 0n,
        vault: mem?.[0],
        lineId: mem?.[1],
        active: mem?.[2] ?? true,
        claimed: r<bigint>(4) ?? 0n,
        headroom: r<bigint>(5) ?? 0n,
        suspended: r<boolean>(6) ?? false,
      }
    })
    // removed members stay listed onchain; hide them unless they still have a position in this cycle
    .filter((r) => r.active || r.net !== 0n)
  const t = totals.data
  return {
    loading: head.isLoading,
    error: head.error,
    circle: circle ? { admin: circle[0], genesis: circle[1], cycleLength: circle[2], settleWindow: circle[3], exists: circle[4] } : undefined,
    members,
    current,
    cycle: cyc,
    rows,
    invite: invite && invite[2] ? { vault: invite[0], lineId: invite[1] } : undefined,
    gross: (t?.[0] as bigint | undefined) ?? 0n,
    totalOwed: (t?.[1] as bigint | undefined) ?? 0n,
    collected: (t?.[2] as bigint | undefined) ?? 0n,
    efficiencyBps: (t?.[3] as bigint | undefined) ?? 0n,
    close: (t?.[4] as bigint | undefined) ?? 0n,
    finalAt: (t?.[5] as bigint | undefined) ?? 0n,
    finalized: (t?.[6] as boolean | undefined) ?? false,
    refetch: async () => {
      await head.refetch()
      await base.refetch()
      await perMember.refetch()
      await totals.refetch()
    },
  }
}

// ------------------------------------------------------------------ display-only clearing (spec 7)

export type Edge = { from: string; to: string; amount: number }
export type Frame = { edges: Edge[]; cycle?: string[]; removed?: number }

/**
 * Cycle cancellation for the "Clear cycle" animation. Amounts are already netted onchain; this just
 * shows how: find a directed cycle (DFS), subtract its smallest edge everywhere on it, repeat.
 */
export function cancellationFrames(input: Edge[]): Frame[] {
  const key = (a: string, b: string) => `${a}->${b}`
  const g = new Map<string, number>()
  for (const e of input) g.set(key(e.from, e.to), (g.get(key(e.from, e.to)) ?? 0) + e.amount)
  const snapshot = (): Edge[] =>
    [...g.entries()].filter(([, v]) => v > 1e-9).map(([k, v]) => ({ from: k.split("->")[0], to: k.split("->")[1], amount: v }))
  const frames: Frame[] = [{ edges: snapshot() }]

  const findCycle = (): string[] | undefined => {
    const adj = new Map<string, string[]>()
    for (const e of snapshot()) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
    const color = new Map<string, number>()
    const stack: string[] = []
    let found: string[] | undefined
    const dfs = (u: string) => {
      if (found) return
      color.set(u, 1)
      stack.push(u)
      for (const v of adj.get(u) ?? []) {
        if (found) return
        if (color.get(v) === 1) {
          found = stack.slice(stack.indexOf(v))
          return
        }
        if (!color.get(v)) dfs(v)
      }
      stack.pop()
      color.set(u, 2)
    }
    for (const u of adj.keys()) if (!color.get(u) && !found) dfs(u)
    return found
  }

  for (let guard = 0; guard < 50; guard++) {
    const cyc = findCycle()
    if (!cyc) break
    const pairs = cyc.map((u, i) => key(u, cyc[(i + 1) % cyc.length]))
    const min = Math.min(...pairs.map((k) => g.get(k)!))
    frames.push({ edges: snapshot(), cycle: cyc, removed: min })
    for (const k of pairs) g.set(k, g.get(k)! - min)
    frames.push({ edges: snapshot() })
  }
  return frames
}

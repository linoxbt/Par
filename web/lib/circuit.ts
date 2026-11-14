"use client"

import { useMemo } from "react"
import { type Address } from "viem"
import { useReadContract, useReadContracts } from "wagmi"
import { parCircuitAbi } from "./abi"
import { CIRCUIT } from "./config"

const C = { address: CIRCUIT, abi: parCircuitAbi } as const

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

export function useInvoices(circleId: bigint) {
  const { data: n, refetch: rn } = useReadContract({ ...C, functionName: "nextInvoiceId", query: { refetchInterval: 6_000 } })
  const count = Number(n ?? 0n)
  const { data, refetch } = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({ ...C, functionName: "invoices" as const, args: [BigInt(i)] as const })),
    allowFailure: false,
    query: { enabled: count > 0, refetchInterval: 6_000 },
  })
  const invoices = useMemo(
    () =>
      ((data ?? []) as readonly (readonly [bigint, Address, Address, bigint, bigint, number, `0x${string}`])[])
        .map((r, i) => ({ id: BigInt(i), circleId: r[0], creditor: r[1], debtor: r[2], amount: r[3], cycle: r[4], status: r[5], ref: r[6] }) as Invoice)
        .filter((x) => x.circleId === circleId),
    [data, circleId],
  )
  return {
    invoices,
    refetch: async () => {
      await rn()
      await refetch()
    },
  }
}

export function useCircle(circleId: bigint, cycle: bigint | undefined) {
  const base = useReadContracts({
    contracts: [
      { ...C, functionName: "circles", args: [circleId] },
      { ...C, functionName: "members_", args: [circleId] },
      { ...C, functionName: "currentCycle", args: [circleId] },
    ],
    allowFailure: false,
    query: { refetchInterval: 6_000 },
  })
  const circle = base.data?.[0]
  const members = (base.data?.[1] ?? []) as Address[]
  const current = base.data?.[2] as bigint | undefined
  const cyc = cycle ?? current ?? 0n

  const perMember = useReadContracts({
    contracts: members.flatMap((m) => [
      { ...C, functionName: "net" as const, args: [circleId, cyc, m] as const },
      { ...C, functionName: "settled" as const, args: [circleId, cyc, m] as const },
      { ...C, functionName: "creditLimit" as const, args: [circleId, m] as const },
      { ...C, functionName: "members" as const, args: [circleId, m] as const },
    ]),
    allowFailure: false,
    query: { enabled: members.length > 0, refetchInterval: 6_000 },
  })
  const totals = useReadContracts({
    contracts: [
      { ...C, functionName: "gross", args: [circleId, cyc] },
      { ...C, functionName: "totalOwed", args: [circleId, cyc] },
      { ...C, functionName: "collected", args: [circleId, cyc] },
      { ...C, functionName: "nettingEfficiencyBps", args: [circleId, cyc] },
      { ...C, functionName: "cycleClose", args: [circleId, cyc] },
    ],
    allowFailure: false,
    query: { enabled: !!circle, refetchInterval: 6_000 },
  })

  const rows = members.map((m, i) => {
    const d = perMember.data
    const mem = d?.[i * 4 + 3] as readonly [Address, bigint, boolean] | undefined
    return {
      member: m,
      net: (d?.[i * 4] as bigint | undefined) ?? 0n,
      settled: (d?.[i * 4 + 1] as boolean | undefined) ?? false,
      limit: (d?.[i * 4 + 2] as bigint | undefined) ?? 0n,
      vault: mem?.[0],
      lineId: mem?.[1],
    }
  })
  const t = totals.data
  return {
    circle: circle
      ? { admin: circle[0], genesis: circle[1], cycleLength: circle[2], settleWindow: circle[3], exists: circle[4] }
      : undefined,
    members,
    current,
    cycle: cyc,
    rows,
    gross: (t?.[0] as bigint | undefined) ?? 0n,
    totalOwed: (t?.[1] as bigint | undefined) ?? 0n,
    collected: (t?.[2] as bigint | undefined) ?? 0n,
    efficiencyBps: (t?.[3] as bigint | undefined) ?? 0n,
    close: (t?.[4] as bigint | undefined) ?? 0n,
    refetch: async () => {
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

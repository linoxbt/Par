"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { Edge } from "@/lib/circuit"

export type GraphNode = { id: string; label: string; sub?: string; net?: number }

type Geo = { W: number; H: number; CX: number; CY: number; R: number; NR: number }
function geo(width: number): Geo {
  const narrow = width < 520
  const W = narrow ? 360 : 640
  const H = narrow ? 380 : 440
  return { W, H, CX: W / 2, CY: H / 2, R: narrow ? 128 : 165, NR: narrow ? 34 : 38 }
}
function pos(g: Geo, i: number, n: number) {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2
  return { x: g.CX + g.R * Math.cos(a), y: g.CY + g.R * Math.sin(a) }
}

/** Curved path from a to b, stopping short of node circles. */
function curve(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18, padA = 42, padB = 46) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const s = { x: a.x + ux * padA, y: a.y + uy * padA }
  const e = { x: b.x - ux * padB, y: b.y - uy * padB }
  const mx = (s.x + e.x) / 2 - uy * len * bend
  const my = (s.y + e.y) / 2 + ux * len * bend
  return { d: `M ${s.x} ${s.y} Q ${mx} ${my} ${e.x} ${e.y}`, mid: { x: (s.x + 2 * mx + e.x) / 4, y: (s.y + 2 * my + e.y) / 4 } }
}

export function CircuitGraph({
  nodes,
  edges,
  highlight,
  netted,
  fmt,
}: {
  nodes: GraphNode[]
  edges: Edge[]
  highlight?: string[]
  netted: boolean
  fmt: (n: number) => string
}) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(box.current!)
    return () => ro.disconnect()
  }, [])
  const g = geo(width)
  const { W, H, CX, CY, NR } = g
  const index = new Map(nodes.map((n, i) => [n.id, i]))
  const P = (id: string) => pos(g, index.get(id) ?? 0, nodes.length)
  const max = Math.max(1, ...edges.map((e) => e.amount), ...nodes.map((n) => Math.abs(n.net ?? 0)))
  const hl = new Set((highlight ?? []).map((u, i, arr) => `${u}->${arr[(i + 1) % arr.length]}`))

  return (
    <div ref={box} className="w-full">
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#C4C6CC" />
        </marker>
        <marker id="arr-btc" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#F7931A" />
        </marker>
      </defs>

      {/* hub */}
      <motion.g animate={{ opacity: netted ? 1 : 0.35 }}>
        <circle cx={CX} cy={CY} r={36} fill="#FFFFFF" stroke="#F7931A" strokeWidth={netted ? 2 : 1} />
        <text x={CX} y={CY - 2} textAnchor="middle" className="fill-[#0A0A0B] text-[13px] font-semibold">
          Par
        </text>
        <text x={CX} y={CY + 13} textAnchor="middle" className="fill-[#6C7078] text-[10px]">
          Circuit
        </text>
      </motion.g>

      <AnimatePresence>
        {!netted &&
          edges.map((e) => {
            const k = `${e.from}->${e.to}`
            const { d, mid } = curve(P(e.from), P(e.to))
            const on = hl.has(k)
            return (
              <motion.g key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
                <motion.path
                  d={d}
                  fill="none"
                  stroke={on ? "#F7931A" : "#C4C6CC"}
                  markerEnd={on ? "url(#arr-btc)" : "url(#arr)"}
                  animate={{ strokeWidth: 1.5 + (8 * e.amount) / max }}
                  transition={{ duration: 0.6 }}
                />
                <rect x={mid.x - 30} y={mid.y - 10} width={60} height={20} rx={6} fill="#FFFFFF" stroke="#E8E8EB" />
                <text x={mid.x} y={mid.y + 4} textAnchor="middle" className={`font-mono text-[11px] ${on ? "fill-[#A8540A]" : "fill-[#6B6E76]"}`}>
                  {fmt(e.amount)}
                </text>
              </motion.g>
            )
          })}

        {netted &&
          nodes
            .filter((n) => (n.net ?? 0) !== 0)
            .map((n) => {
              const p = P(n.id)
              const owes = (n.net ?? 0) < 0
              const { d, mid } = owes ? curve(p, { x: CX, y: CY }, 0, 42, 42) : curve({ x: CX, y: CY }, p, 0, 40, 44)
              return (
                <motion.g key={`net-${n.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}>
                  <motion.path
                    d={d}
                    fill="none"
                    stroke="#F7931A"
                    strokeWidth={2 + (8 * Math.abs(n.net ?? 0)) / max}
                    markerEnd="url(#arr-btc)"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8 }}
                  />
                  <rect x={mid.x - 30} y={mid.y - 10} width={60} height={20} rx={6} fill="#FFFFFF" stroke="#FBD9AE" />
                  <text x={mid.x} y={mid.y + 4} textAnchor="middle" className="fill-[#A8540A] font-mono text-[11px]">
                    {fmt(Math.abs(n.net ?? 0))}
                  </text>
                </motion.g>
              )
            })}
      </AnimatePresence>

      {nodes.map((n, i) => {
        const p = pos(g, i, nodes.length)
        const net = n.net ?? 0
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={NR} fill="#FFFFFF" stroke={net < 0 ? "#DC2626" : net > 0 ? "#15803D" : "#D6D6DB"} strokeWidth={2} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" className="fill-[#0A0A0B] text-[10px] font-semibold">
              {n.label}
            </text>
            {n.sub && (
              <text x={p.x} y={p.y + NR + 16} textAnchor="middle" className="fill-[#6C7078] font-mono text-[10px]">
                {n.sub}
              </text>
            )}
          </g>
        )
      })}
    </svg>
    </div>
  )
}

/** Tween a number toward `target` (for the gross → owed counter). */
export function useTween(target: number, ms = 900) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms)
      const e = 1 - Math.pow(1 - k, 3)
      const cur = a + (target - a) * e
      setV(cur)
      from.current = cur
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

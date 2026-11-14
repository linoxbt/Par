"use client"

import { useMemo, useState } from "react"

/**
 * Interactive stress curve for an example vault: collateral ratio after every promise is called,
 * as BTC falls. Arrow keys or hover read each point.
 */
export function StressChart({ price, coll = 0.25, promised = 1500 }: { price: number; coll?: number; promised?: number }) {
  const debt = 1800 * 1.001 + 200
  const need = promised * 1.001
  const W = 720
  const H = 280
  const pad = { l: 44, r: 16, t: 16, b: 30 }
  const pts = useMemo(
    () =>
      Array.from({ length: 91 }, (_, d) => {
        const p = price * (1 - d / 100)
        return { d, p, r: (coll * p) / (debt + need) }
      }),
    [price, coll, debt, need],
  )
  const maxR = Math.max(4, pts[0].r * 1.05)
  const x = (d: number) => pad.l + (d / 90) * (W - pad.l - pad.r)
  const y = (r: number) => pad.t + (1 - Math.min(r, maxR) / maxR) * (H - pad.t - pad.b)
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.d).toFixed(1)},${y(p.r).toFixed(1)}`).join(" ")
  const area = `${line} L${x(90)},${y(0)} L${x(0)},${y(0)} Z`
  const liq = pts.find((p) => p.r < 1.1)
  const [hover, setHover] = useState(40)
  const h = pts[hover]

  const refs = [
    { r: 1.6, label: "160% floor", c: "#C2650A" },
    { r: 1.5, label: "150% Recovery", c: "#B45309" },
    { r: 1.1, label: "110% liquidation", c: "#DC2626" },
  ]

  return (
    <div
      tabIndex={0}
      role="img"
      aria-label={`Stress curve. At a ${h.d}% BTC drop the vault ratio is ${(h.r * 100).toFixed(0)}%. Use arrow keys to read each point.`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setHover((v) => Math.min(90, v + 1))
        if (e.key === "ArrowLeft") setHover((v) => Math.max(0, v - 1))
      }}
      className="outline-none"
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          setHover(Math.max(0, Math.min(90, Math.round(((px - pad.l) / (W - pad.l - pad.r)) * 90))))
        }}
      >
        <defs>
          <pattern id="dotfill" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="1.6" height="1.6" fill="#F7931A" opacity="0.55" />
          </pattern>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0.85" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - pad.r} y1={y((maxR / 4) * g)} y2={y((maxR / 4) * g)} stroke="#EFEFF1" />
            <text x={pad.l - 8} y={y((maxR / 4) * g) + 4} textAnchor="end" fontSize="10" fill="#9B9EA6" fontFamily="ui-monospace,monospace">
              {Math.round((maxR / 4) * g * 100)}%
            </text>
          </g>
        ))}
        {[0, 20, 40, 60, 80].map((d) => (
          <text key={d} x={x(d)} y={H - 10} textAnchor="middle" fontSize="10" fill="#9B9EA6" fontFamily="ui-monospace,monospace">
            −{d}%
          </text>
        ))}
        <path d={area} fill="url(#dotfill)" />
        <path d={area} fill="url(#fade)" />
        <path d={line} fill="none" stroke="#F7931A" strokeWidth="2" />
        {refs.map((rf) => (
          <g key={rf.label}>
            <line x1={pad.l} x2={W - pad.r} y1={y(rf.r)} y2={y(rf.r)} stroke={rf.c} strokeDasharray="4 4" strokeOpacity="0.7" />
            <text x={W - pad.r - 4} y={y(rf.r) - 5} textAnchor="end" fontSize="10" fill={rf.c} fontFamily="ui-monospace,monospace">
              {rf.label}
            </text>
          </g>
        ))}
        <line x1={x(40)} x2={x(40)} y1={pad.t} y2={H - pad.b} stroke="#0A0A0B" strokeOpacity="0.15" />
        <text x={x(40) + 5} y={pad.t + 10} fontSize="10" fill="#6B6E76" fontFamily="ui-monospace,monospace">
          stress test
        </text>
        {liq && <circle cx={x(liq.d)} cy={y(liq.r)} r="4" fill="#DC2626" />}
        <line x1={x(h.d)} x2={x(h.d)} y1={pad.t} y2={H - pad.b} stroke="#0A0A0B" strokeOpacity="0.35" />
        <circle cx={x(h.d)} cy={y(h.r)} r="5" fill="#fff" stroke="#0A0A0B" strokeWidth="2" />
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-muted">
          BTC <span className="num text-fg">−{h.d}%</span> → <span className="num text-fg">${Math.round(h.p).toLocaleString("en-US")}</span>
        </span>
        <span className="text-muted">
          Vault ratio{" "}
          <span className={`num ${h.r >= 1.6 ? "text-fg" : h.r >= 1.1 ? "text-warn" : "text-bad"}`}>{(h.r * 100).toFixed(0)}%</span>
        </span>
        <span className="text-xs text-subtle">
          {h.r >= 1.6 ? "promises safe" : h.r >= 1.1 ? "under-reserved: owner alerted, promises still honored" : "liquidation risk: promises can fail"}
        </span>
      </div>
    </div>
  )
}

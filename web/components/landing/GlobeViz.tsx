"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Hero visual: a dotted globe (Bitcoin on Mezo) with promises routed out of one vault.
 * Payout arcs travel from the vault to each beneficiary; a dot field below rises and falls like collateral.
 */
const TARGETS = [
  { label: "LANDLORD", amount: "500", x: 0.78, y: 0.16, mx: 0.68, my: 0.06 },
  { label: "SUPPLIER", amount: "1,200", x: 0.89, y: 0.46, mx: 0.78, my: 0.42 },
  { label: "CIRCLE #1", amount: "100", x: 0.14, y: 0.3, mx: 0.22, my: 0.18 },
]
const pos = (t: (typeof TARGETS)[number], narrow: boolean) => (narrow ? { x: t.mx, y: t.my } : { x: t.x, y: t.y })

export function GlobeViz() {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  activeRef.current = active
  const [narrow, setNarrow] = useState(false)
  const narrowRef = useRef(false)
  narrowRef.current = narrow

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % TARGETS.length), 2600)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const c = canvas.current!
    const ctx = c.getContext("2d")!
    let raf = 0
    let w = 0
    let h = 0
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const resize = () => {
      const r = wrap.current!.getBoundingClientRect()
      w = r.width
      h = r.height
      c.width = w * dpr
      c.height = h * dpr
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      setNarrow(w < 560)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap.current!)

    // sphere points on a lat/lon lattice
    const pts: [number, number, number][] = []
    for (let lat = -78; lat <= 78; lat += 6) {
      const step = 6 / Math.max(0.25, Math.cos((lat * Math.PI) / 180))
      for (let lon = 0; lon < 360; lon += step) {
        const la = (lat * Math.PI) / 180
        const lo = (lon * Math.PI) / 180
        pts.push([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)])
      }
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = reduce ? 0 : (now - t0) / 1000
      ctx.clearRect(0, 0, w, h)
      const R = Math.min(w, h) * (w < 560 ? 0.38 : 0.34)
      const cx = w * 0.52
      const cy = h * 0.46
      const rot = t * 0.12
      const tilt = 0.38

      // orbit ring
      ctx.strokeStyle = "rgba(10,10,11,0.08)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(cx, cy, R * 1.45, R * 0.42, -0.12, 0, Math.PI * 2)
      ctx.stroke()

      // globe
      for (const [x0, y0, z0] of pts) {
        const x1 = x0 * Math.cos(rot) - z0 * Math.sin(rot)
        const z1 = x0 * Math.sin(rot) + z0 * Math.cos(rot)
        const y2 = y0 * Math.cos(tilt) - z1 * Math.sin(tilt)
        const z2 = y0 * Math.sin(tilt) + z1 * Math.cos(tilt)
        const px = cx + x1 * R
        const py = cy - y2 * R
        if (z2 < 0) {
          ctx.fillStyle = "rgba(10,10,11,0.06)"
          ctx.fillRect(px, py, 1.2, 1.2)
        } else {
          const a = 0.18 + z2 * 0.62
          ctx.fillStyle = `rgba(247,147,26,${a.toFixed(3)})`
          const s = 1.2 + z2 * 1.3
          ctx.fillRect(px - s / 2, py - s / 2, s, s)
        }
      }

      // vault anchor (front of the globe)
      const vx = cx + R * 0.12
      const vy = cy + R * 0.18
      ctx.fillStyle = "#0A0A0B"
      ctx.beginPath()
      ctx.arc(vx, vy, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = "rgba(247,147,26,0.55)"
      ctx.lineWidth = 1.5
      const pulse = (t * 0.8) % 1
      ctx.beginPath()
      ctx.arc(vx, vy, 6 + pulse * 18, 0, Math.PI * 2)
      ctx.globalAlpha = 1 - pulse
      ctx.stroke()
      ctx.globalAlpha = 1

      // payout arcs
      TARGETS.forEach((tg, i) => {
        const pp = pos(tg, narrowRef.current)
        const tx = pp.x * w
        const ty = pp.y * h + 22
        const mx = (vx + tx) / 2
        const my = Math.min(vy, ty) - R * 0.55
        const on = i === activeRef.current
        ctx.setLineDash([2, 5])
        ctx.strokeStyle = on ? "rgba(247,147,26,0.9)" : "rgba(10,10,11,0.18)"
        ctx.lineWidth = on ? 1.6 : 1
        ctx.beginPath()
        ctx.moveTo(vx, vy)
        ctx.quadraticCurveTo(mx, my, tx, ty)
        ctx.stroke()
        ctx.setLineDash([])
        if (on) {
          const k = ((t * 0.55) % 1 + 1) % 1
          const bx = (1 - k) * (1 - k) * vx + 2 * (1 - k) * k * mx + k * k * tx
          const by = (1 - k) * (1 - k) * vy + 2 * (1 - k) * k * my + k * k * ty
          ctx.fillStyle = "#F7931A"
          ctx.beginPath()
          ctx.arc(bx, by, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // collateral dot field
      const cols = Math.floor(w / 7)
      for (let i = 0; i < cols; i++) {
        const x = i * 7 + 3
        const d = Math.abs(x - cx) / (w * 0.5)
        const base = Math.max(0, 1 - d * 1.15)
        const n = Math.floor((Math.sin(i * 0.35 + t * 1.1) * 0.5 + 0.5) * 9 * base + base * 7)
        for (let j = 0; j < n; j++) {
          const y = h - 8 - j * 6
          ctx.fillStyle = `rgba(247,147,26,${(0.08 + (j / 16) * 0.35 * base).toFixed(3)})`
          ctx.fillRect(x, y, 2, 2)
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return (
    <div ref={wrap} className="relative h-[380px] w-full sm:h-[520px]">
      <canvas ref={canvas} className="absolute inset-0" aria-hidden />
      {TARGETS.map((tg, i) => (
        <div
          key={tg.label}
          className={`absolute -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1 font-mono text-[10px] tracking-wider transition ${
            i === active ? "border-fg bg-fg text-white" : "border-line bg-white text-muted"
          }`}
          style={{ left: `${pos(tg, narrow).x * 100}%`, top: `${pos(tg, narrow).y * 100}%` }}
        >
          {tg.label} <span className={i === active ? "text-btc" : ""}>{tg.amount}</span>
        </div>
      ))}
      <PayingCard target={TARGETS[active]} />
    </div>
  )
}

function PayingCard({ target }: { target: (typeof TARGETS)[number] }) {
  const [n, setN] = useState(0)
  const amount = Number(target.amount.replace(",", ""))
  useEffect(() => {
    setN(0)
    const start = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 1300)
      setN(amount * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [amount])
  const done = n >= amount - 0.01
  return (
    <div className="absolute bottom-4 left-0 w-52 rounded-xl border border-line bg-white/95 p-3 shadow-float backdrop-blur sm:bottom-10 sm:left-2 sm:w-60 sm:p-3.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-muted">
          <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-ok" : "animate-pulseDot bg-btc"}`} />
          {done ? "Paid" : "Paying…"}
        </span>
        <span className="num text-subtle">1 block</span>
      </div>
      <div className="num mt-1.5 text-2xl font-medium tracking-tight">
        {n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-subtle">MUSD</span>
      </div>
      <div className="mt-1 text-[11px] text-muted">
        Vault → <span className="text-fg">{target.label.toLowerCase()}</span>
      </div>
      <div className="num mt-1 text-[10px] text-subtle">promise broken · no one approved it</div>
    </div>
  )
}

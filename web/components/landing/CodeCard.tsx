"use client"

import { useEffect, useRef, useState } from "react"

const CODE = {
  Guarantee: `import { parseEther } from "viem"
import { parVaultAbi } from "./abi"

// Rent: 12 × 500 MUSD, cover 1,500, 3-day grace
const hash = await wallet.writeContract({
  address: vault,
  abi: parVaultAbi,
  functionName: "createScheduled",
  args: [landlord, tenant, parseEther("500"), start,
         MONTH, 3 * DAY, 12, parseEther("1500"), expiry],
})

// reverts with Unhealthy() unless it survives BTC −40%
const [ok, stressedIcr] = await vault.read.health([0n])`,
  Circuit: `import { parCircuitAbi } from "./abi"

// creditor logs an invoice, debtor accepts: nets update in O(1)
await circuit.write.createInvoice([circle, debtor, parseEther("1000"), ref])
await circuit.write.acceptInvoice([invoiceId])

// after cycle close + settle window, anyone can call this.
// It draws the debtor's clearing line in their own vault.
await circuit.write.forceSettle([circle, cycle, debtor, up, lo])

await circuit.read.nettingEfficiencyBps([circle, cycle]) // 9655n`,
}

const RESPONSE = {
  Guarantee: `{
  "event": "CommitmentCreated",
  "id": 0,
  "kind": "Scheduled",
  "beneficiary": "0x2361…1E8f",
  "cap": "1500.0",
  "health": { "ok": true, "stressedIcr": "2.21" }
}`,
  Circuit: `{
  "gross": "2900.0",
  "totalOwed": "100.0",
  "nettingEfficiencyBps": 9655,
  "event": "Settled",
  "debtor": "repairer",
  "amount": "100.0",
  "forced": true
}`,
}

const KW = /\b(import|from|const|await|async|unless|true|false)\b/g

function highlight(line: string) {
  const ci = line.indexOf("//")
  const code = ci >= 0 ? line.slice(0, ci) : line
  const comment = ci >= 0 ? line.slice(ci) : ""
  const parts: React.ReactNode[] = []
  const re = /("[^"]*"|\b\d[\d_]*n?\b|\b(?:import|from|const|await)\b)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(code))) {
    if (m.index > last) parts.push(code.slice(last, m.index))
    const t = m[0]
    const cls = t.startsWith('"') ? "text-[#FFB45C]" : /^\d/.test(t) ? "text-[#9CDCFE]" : "text-[#C792EA]"
    parts.push(
      <span key={k++} className={cls}>
        {t}
      </span>,
    )
    last = m.index + t.length
  }
  if (last < code.length) parts.push(code.slice(last))
  if (comment) parts.push(<span key="c" className="text-white/35">{comment}</span>)
  void KW
  return parts
}

export function CodeCard() {
  const [tab, setTab] = useState<keyof typeof CODE>("Guarantee")
  const [copied, setCopied] = useState(false)
  const code = CODE[tab]
  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-black/80 bg-[#0B0B0D] text-white shadow-float">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
        <div className="flex rounded-full bg-white/5 p-1">
          {(Object.keys(CODE) as (keyof typeof CODE)[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 text-xs transition ${tab === t ? "bg-white text-fg" : "text-white/60 hover:text-white"}`}>
              {t}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-btc" /> MEZO · 31611
        </span>
      </div>
      <pre className="overflow-x-auto px-0 py-4 font-mono text-[12.5px] leading-[1.7]">
        {code.split("\n").map((l, i) => (
          <div key={i} className="flex">
            <span className="w-10 shrink-0 select-none pr-4 text-right text-white/20">{i + 1}</span>
            <span className="whitespace-pre pr-4 text-white/85">{highlight(l)}</span>
          </div>
        ))}
      </pre>
      <div className="flex items-center justify-end gap-2 border-t border-white/10 px-3 py-2.5">
        <button
          onClick={() => {
            navigator.clipboard?.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
          className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 hover:text-white"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a href="https://github.com/linoxbt/par/tree/main/contracts" target="_blank" rel="noreferrer" className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70 hover:text-white">
          View on GitHub ↗
        </a>
      </div>
      <div className="border-t border-white/10 bg-black/40 px-4 py-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[10px] text-white/40">
          <span>RESULT</span>
          <span className="flex items-center gap-1.5 text-[#4ADE80]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" /> tests passing
          </span>
        </div>
        <pre className="overflow-x-auto font-mono text-[12px] leading-[1.6] text-white/75">{RESPONSE[tab]}</pre>
      </div>
    </div>
  )
}

export function CopyChip({ text }: { text: string }) {
  const [c, setC] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text)
        setC(true)
        setTimeout(() => setC(false), 1200)
      }}
      className="group flex w-full min-w-0 max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left font-mono text-[12px] shadow-card sm:text-[13px]"
    >
      <span className="min-w-0 truncate">
        <span className="text-subtle">$ </span>
        {text}
      </span>
      <span className="shrink-0 text-xs text-subtle group-hover:text-fg">{c ? "copied" : "copy"}</span>
    </button>
  )
}

/** Falling glyphs behind the closing CTA. */
export function GlyphRain() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!
    const ctx = c.getContext("2d")!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    let cols: { y: number; v: number; ch: string[] }[] = []
    const glyphs = "₿0123456789$=parMUSD".split("")
    const size = 14
    const resize = () => {
      const r = c.parentElement!.getBoundingClientRect()
      w = r.width
      h = r.height
      c.width = w * dpr
      c.height = h * dpr
      c.style.width = `${w}px`
      c.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Array.from({ length: Math.ceil(w / 26) }, () => ({
        y: Math.random() * h,
        v: 10 + Math.random() * 22,
        ch: Array.from({ length: 6 }, () => glyphs[Math.floor(Math.random() * glyphs.length)]),
      }))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(c.parentElement!)
    let last = performance.now()
    let raf = 0
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const draw = (now: number) => {
      const dt = reduce ? 0 : (now - last) / 1000
      last = now
      ctx.clearRect(0, 0, w, h)
      ctx.font = `${size}px ui-monospace, monospace`
      cols.forEach((col, i) => {
        col.y += col.v * dt
        if (col.y > h + size * 6) col.y = -size * 6
        col.ch.forEach((g, j) => {
          const y = col.y - j * size * 1.4
          const a = (1 - j / col.ch.length) * 0.55
          ctx.fillStyle = j === 0 ? `rgba(247,147,26,${a})` : `rgba(10,10,11,${a * 0.35})`
          ctx.fillText(g, i * 26 + 6, y)
        })
        if (Math.random() < 0.01) col.ch[Math.floor(Math.random() * col.ch.length)] = glyphs[Math.floor(Math.random() * glyphs.length)]
      })
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_22%,black_70%)]" aria-hidden />
}

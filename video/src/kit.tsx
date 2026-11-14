import React from "react"
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"

// ------------------------------------------------------------------ brand (from the live app)
export const C = {
  canvas: "#FAFAFA",
  ink: "#0A0A0B",
  muted: "#5B5F68",
  subtle: "#6C7078",
  line: "#E7E7EA",
  soft: "#F1F1F3",
  btc: "#F7931A",
  btcInk: "#A8540A",
  btcWash: "#FFF6EC",
  ok: "#15803D",
  okWash: "#ECFDF3",
  bad: "#DC2626",
  dark2: "#141416",
}
export const SANS = "Geist, system-ui, sans-serif"
export const MONO = "GeistMono, ui-monospace, monospace"

export const FontFaces = () => (
  <style>{`
    @font-face { font-family: Geist; src: url(${staticFile("fonts/geist.woff2")}) format("woff2"); font-weight: 100 900; }
    @font-face { font-family: GeistMono; src: url(${staticFile("fonts/geist-mono.woff2")}) format("woff2"); font-weight: 100 900; }
  `}</style>
)

// ------------------------------------------------------------------ time helpers
export const useT = () => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  return f / fps
}
export const EASE = Easing.bezier(0.16, 1, 0.3, 1)
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)
export const tw = (t: number, t0: number, t1: number, a = 0, b = 1, ease = EASE) =>
  interpolate(t, [t0, t1], [a, b], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease })
export const sp = (t: number, t0: number, fps = 30, damping = 16, stiffness = 120) =>
  t < t0 ? 0 : spring({ frame: (t - t0) * fps, fps, config: { damping, stiffness, mass: 0.9 } })

// ------------------------------------------------------------------ logo (split coin: locked BTC above, the payment it backs below)
export const Mark = ({ size = 64, p = 1, inverted = false }: { size?: number; p?: number; inverted?: boolean }) => {
  const gap = (1 - p) * 10
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ overflow: "visible" }}>
      <path d="M3 15a13 13 0 0 1 26 0z" fill={inverted ? "#FFFFFF" : C.ink} transform={`translate(0 ${-gap})`} opacity={Math.min(1, p * 2)} />
      <path d="M3 17h26a13 13 0 0 1-26 0z" fill={C.btc} transform={`translate(0 ${gap})`} opacity={Math.min(1, p * 2)} />
    </svg>
  )
}
export const Wordmark = ({ size = 64, inverted = false, p = 1 }: { size?: number; inverted?: boolean; p?: number }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.32 }}>
    <Mark size={size} inverted={inverted} p={p} />
    <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: size * 0.95, letterSpacing: "-0.05em", color: inverted ? "#fff" : C.ink, lineHeight: 1 }}>par</span>
  </div>
)

// ------------------------------------------------------------------ backgrounds
export const Bg = ({ dark = false, glow = true, glowX = 0.7, glowY = 0.3 }: { dark?: boolean; glow?: boolean; glowX?: number; glowY?: number }) => {
  const t = useT()
  const gx = glowX * 100 + Math.sin(t * 0.25) * 6
  const gy = glowY * 100 + Math.cos(t * 0.2) * 5
  return (
    <AbsoluteFill style={{ background: dark ? C.ink : C.canvas }}>
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${dark ? "rgba(255,255,255,0.07)" : "rgba(10,10,11,0.07)"} 1.2px, transparent 1.2px)`,
          backgroundSize: "28px 28px",
          backgroundPosition: `${-t * 6}px ${-t * 3}px`,
          maskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 70% at 50% 45%, black 40%, transparent 100%)",
        }}
      />
      {glow && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at ${gx}% ${gy}%, ${dark ? "rgba(247,147,26,0.20)" : "rgba(247,147,26,0.13)"} 0%, transparent 42%)`,
          }}
        />
      )}
      <AbsoluteFill style={{ boxShadow: `inset 0 0 220px ${dark ? "rgba(0,0,0,0.7)" : "rgba(10,10,11,0.06)"}` }} />
    </AbsoluteFill>
  )
}

// ------------------------------------------------------------------ type
export const Kicker = ({ children, dark = false, style = {} }: { children: React.ReactNode; dark?: boolean; style?: React.CSSProperties }) => (
  <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.16em", textTransform: "uppercase", color: dark ? C.btc : C.btcInk, ...style }}>{children}</div>
)

/** Words rise and sharpen in sequence. */
export const Words = ({
  text,
  t0,
  stagger = 0.06,
  size = 84,
  weight = 600,
  color = C.ink,
  muted,
  style = {},
  t,
}: {
  text: string
  t0: number
  stagger?: number
  size?: number
  weight?: number
  color?: string
  muted?: string
  style?: React.CSSProperties
  t: number
}) => {
  const parts = text.split(" ")
  const mutedFrom = muted ? parts.length - muted.split(" ").length : Infinity
  return (
    <div style={{ fontFamily: SANS, fontSize: size, fontWeight: weight, letterSpacing: "-0.045em", lineHeight: 1.04, color, display: "flex", flexWrap: "wrap", columnGap: size * 0.26, ...style }}>
      {parts.map((w, i) => {
        const p = tw(t, t0 + i * stagger, t0 + i * stagger + 0.7)
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - p) * 105}%)`,
                filter: `blur(${(1 - p) * 8}px)`,
                opacity: p,
                color: i >= mutedFrom ? "#8A8E96" : undefined,
              }}
            >
              {w}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export const Fade = ({ t, t0, t1 = Infinity, dur = 0.5, children, y = 24, style = {} }: { t: number; t0: number; t1?: number; dur?: number; children: React.ReactNode; y?: number; style?: React.CSSProperties }) => {
  const a = tw(t, t0, t0 + dur) * (t1 === Infinity ? 1 : 1 - tw(t, t1, t1 + dur * 0.8, 0, 1, EASE_IN_OUT))
  return <div style={{ opacity: a, transform: `translateY(${(1 - tw(t, t0, t0 + dur)) * y}px)`, ...style }}>{children}</div>
}

// ------------------------------------------------------------------ device frames
/**
 * Browser window showing a 1600×1000 (@2x) screenshot. The camera zooms to `focus` (0..1 coords of the
 * screenshot) with scale `zoom`. Children are positioned in screenshot coords (0..1) via <At>.
 */
export const Browser = ({
  src,
  url = "par-rosy.vercel.app",
  width = 1480,
  zoom = 1,
  focus = { x: 0.5, y: 0.5 },
  children,
  dark = false,
  shadow = true,
}: {
  src: string | { src: string; o: number }[]
  url?: string
  width?: number
  zoom?: number
  focus?: { x: number; y: number }
  children?: React.ReactNode
  dark?: boolean
  shadow?: boolean
}) => {
  const h = (width * 1000) / 1600
  const layers = typeof src === "string" ? [{ src, o: 1 }] : src
  // camera: keep the focus point centred while zoomed, clamp to edges
  const fx = Math.min(Math.max(focus.x, 0.5 / zoom), 1 - 0.5 / zoom)
  const fy = Math.min(Math.max(focus.y, 0.5 / zoom), 1 - 0.5 / zoom)
  const tx = (0.5 - fx) * width * zoom
  const ty = (0.5 - fy) * h * zoom
  return (
    <div
      style={{
        width,
        borderRadius: 18,
        overflow: "hidden",
        background: "#fff",
        border: `1px solid ${dark ? "#2A2A2E" : C.line}`,
        boxShadow: shadow ? "0 40px 120px -30px rgba(10,10,11,0.35), 0 12px 32px -12px rgba(10,10,11,0.18)" : undefined,
      }}
    >
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", background: "#F6F6F7", borderBottom: `1px solid ${C.line}` }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
        <div
          style={{
            marginLeft: 24,
            flex: 1,
            maxWidth: 560,
            height: 28,
            borderRadius: 8,
            background: "#fff",
            border: `1px solid ${C.line}`,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 12px",
            fontFamily: SANS,
            fontSize: 14,
            color: C.muted,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.4"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          {url}
        </div>
      </div>
      <div style={{ position: "relative", width, height: h, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${zoom})`, transformOrigin: "50% 50%" }}>
          {layers.map((l, i) => (
            <Img key={i} src={staticFile(l.src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: l.o }} />
          ))}
          {children}
        </div>
      </div>
    </div>
  )
}

/** Position children inside a Browser/Phone screenshot using 0..1 coordinates. */
export const At = ({ x, y, children, style = {} }: { x: number; y: number; children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, ...style }}>{children}</div>
)

export const Phone = ({ src, width = 420, scrollY = 0, children }: { src: string | { src: string; o: number }[]; width?: number; scrollY?: number; children?: React.ReactNode }) => {
  const layers = typeof src === "string" ? [{ src, o: 1 }] : src
  const h = width * 2.06
  return (
    <div
      style={{
        width: width + 28,
        height: h + 28,
        borderRadius: 64,
        background: "#0A0A0B",
        padding: 14,
        boxShadow: "0 50px 120px -30px rgba(10,10,11,0.5), inset 0 0 0 2px #2b2b30",
        position: "relative",
      }}
    >
      <div style={{ width, height: h, borderRadius: 50, overflow: "hidden", position: "relative", background: "#fff" }}>
        <div style={{ position: "absolute", left: 0, top: -scrollY, width }}>
          {layers.map((l, i) => (
            <Img key={i} src={staticFile(l.src)} style={{ position: i ? "absolute" : "relative", top: 0, left: 0, width, display: "block", opacity: l.o }} />
          ))}
          {children}
        </div>
        <div style={{ position: "absolute", top: 12, left: "50%", marginLeft: -62, width: 124, height: 34, borderRadius: 20, background: "#0A0A0B" }} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ cursor
type Pt = { t: number; x: number; y: number; click?: boolean }
export const Cursor = ({ path, t }: { path: Pt[]; t: number }) => {
  if (!path.length || t < path[0].t - 0.4) return null
  let x = path[0].x
  let y = path[0].y
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    if (t >= b.t) {
      x = b.x
      y = b.y
    } else if (t > a.t) {
      const p = tw(t, a.t, b.t, 0, 1, EASE_IN_OUT)
      x = a.x + (b.x - a.x) * p
      y = a.y + (b.y - a.y) * p
      break
    }
  }
  const clicks = path.filter((p) => p.click)
  const appear = tw(t, path[0].t - 0.4, path[0].t)
  return (
    <div style={{ position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, opacity: appear, zIndex: 50 }}>
      {clicks.map((c, i) => {
        const p = (t - c.t) / 0.6
        if (p < 0 || p > 1) return null
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: -40,
              top: -40,
              width: 80,
              height: 80,
              borderRadius: 40,
              border: `3px solid ${C.btc}`,
              transform: `scale(${0.3 + p * 1.2})`,
              opacity: 1 - p,
            }}
          />
        )
      })}
      {(() => {
        const press = clicks.some((c) => t >= c.t && t < c.t + 0.15)
        return (
          <svg width="34" height="34" viewBox="0 0 24 24" style={{ transform: `translate(-4px,-3px) scale(${press ? 0.85 : 1})`, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.35))" }}>
            <path d="M4 2l15 9.5-6.8 1.3L16 20l-2.6 1.3-3.7-7.2L4 18.5z" fill="#0A0A0B" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        )
      })()}
    </div>
  )
}

// ------------------------------------------------------------------ callouts, chips, toasts
export const Chip = ({ children, tone = "btc", size = 22, style = {} }: { children: React.ReactNode; tone?: "btc" | "ok" | "ink" | "bad" | "light"; size?: number; style?: React.CSSProperties }) => {
  const m = {
    btc: [C.btcWash, C.btcInk, "#F3D9B8"],
    ok: [C.okWash, C.ok, "#BBE7CC"],
    ink: [C.ink, "#fff", C.ink],
    bad: ["#FEF2F2", C.bad, "#FECACA"],
    light: ["#fff", C.ink, C.line],
  }[tone]
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: `${size * 0.42}px ${size * 0.8}px`,
        borderRadius: 999,
        background: m[0],
        color: m[1],
        border: `1px solid ${m[2]}`,
        fontFamily: SANS,
        fontWeight: 500,
        fontSize: size,
        whiteSpace: "nowrap",
        boxShadow: "0 10px 30px -12px rgba(10,10,11,0.25)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export const Pop = ({ t, t0, children, from = 0.6, style = {} }: { t: number; t0: number; children: React.ReactNode; from?: number; style?: React.CSSProperties }) => {
  const p = sp(t, t0, 30, 13, 170)
  return <div style={{ transform: `scale(${from + (1 - from) * p})`, opacity: Math.min(1, p * 1.6), transformOrigin: "50% 50%", ...style }}>{children}</div>
}

export const Card = ({ children, style = {}, dark = false }: { children: React.ReactNode; style?: React.CSSProperties; dark?: boolean }) => (
  <div
    style={{
      background: dark ? C.dark2 : "#fff",
      border: `1px solid ${dark ? "#26262A" : C.line}`,
      borderRadius: 26,
      padding: 34,
      boxShadow: dark ? "none" : "0 24px 60px -30px rgba(10,10,11,0.25)",
      fontFamily: SANS,
      color: dark ? "#fff" : C.ink,
      ...style,
    }}
  >
    {children}
  </div>
)

export const Num = ({ v, style = {} }: { v: string; style?: React.CSSProperties }) => <span style={{ fontFamily: MONO, letterSpacing: "-0.03em", ...style }}>{v}</span>

export const fmt = (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)

// ------------------------------------------------------------------ icons (SVG: the renderer has no emoji font)
export const Icon = ({ name, size = 44, color = "#fff" }: { name: "house" | "lock" | "chain" | "btc"; size?: number; color?: string }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (name === "house") return <svg {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></svg>
  if (name === "lock") return <svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2.2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.3" /></svg>
  if (name === "chain") return <svg {...p}><path d="M9.5 14.5 14.5 9.5" /><path d="M10.6 6.4 12.1 5a4 4 0 0 1 5.7 5.7l-1.5 1.4" /><path d="M13.4 17.6 11.9 19a4 4 0 0 1-5.7-5.7l1.5-1.4" /></svg>
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill={color} d="M15.9 10.6c.6-.4 1-1.1 1-2 0-1.9-1.5-2.7-3.4-2.9V3.8h-1.3v1.9h-1V3.8H9.9v1.9H7.3v1.4h1c.5 0 .7.2.7.6v8.6c0 .4-.2.6-.7.6h-1V18.3h2.6v1.9h1.3v-1.9h1v1.9h1.3v-1.9c2.4-.1 4.1-1 4.1-3.2 0-1.3-.7-2.2-1.7-2.5zM10.9 7.2h1.9c1 0 1.9.4 1.9 1.4s-.9 1.4-1.9 1.4h-1.9V7.2zm2.3 9.3h-2.3v-3.1h2.3c1.1 0 2.1.4 2.1 1.6 0 1.1-1 1.5-2.1 1.5z" />
    </svg>
  )
}

import React from "react"
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion"
import tl from "./timeline.json"
import script from "../script.json"
import { C, FontFaces, SANS, tw } from "./kit"
import { Builder, Cert, Circuit, Clear, Hook, Idle, Insight, Logo, Miss, Montage, Next, Outro, Tech, Vault } from "./scenes"

const SCENES: Record<string, React.FC> = { hook: Hook, idle: Idle, logo: Logo, insight: Insight, vault: Vault, builder: Builder, cert: Cert, miss: Miss, circuit: Circuit, clear: Clear, tech: Tech, next: Next, montage: Montage, outro: Outro }
const DARK = new Set(["hook", "idle", "circuit", "tech", "outro"])
const TEXT: Record<string, string> = Object.fromEntries((script as { id: string; text: string }[]).map((s) => [s.id, s.text.replace(/M U S D/g, "MUSD").replace(/I O U's/g, "IOUs")]))

/** Phrase-level captions: chunks at punctuation, timed by character share of the voice line. */
function phrases(text: string) {
  const raw = text.match(/[^,.:;?!]+[,.:;?!]*/g) ?? [text]
  const out: string[] = []
  for (const r of raw) {
    const w = r.trim().split(/\s+/)
    for (let i = 0; i < w.length; i += 9) out.push(w.slice(i, i + 9).join(" "))
  }
  return out.filter(Boolean)
}

const Captions = () => {
  const f = useCurrentFrame()
  const t = f / tl.fps
  const s = tl.scenes.find((x) => x.vo && t >= x.voStart! - 0.1 && t <= x.voStart! + x.voDur! + 0.3)
  if (!s) return null
  const ps = phrases(TEXT[s.vo!])
  const total = ps.reduce((a, p) => a + p.length, 0)
  let acc = s.voStart!
  let cur = ps[0]
  let start = acc
  for (const p of ps) {
    const d = (p.length / total) * s.voDur!
    if (t >= acc) {
      cur = p
      start = acc
    }
    acc += d
  }
  const dark = DARK.has(s.id)
  const a = tw(t, start, start + 0.18)
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 46, pointerEvents: "none" }}>
      <div
        style={{
          fontFamily: SANS,
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          padding: "12px 26px",
          borderRadius: 14,
          background: dark ? "rgba(255,255,255,0.08)" : "rgba(10,10,11,0.78)",
          color: "#fff",
          backdropFilter: "blur(8px)",
          opacity: 0.6 + 0.4 * a,
          transform: `translateY(${(1 - a) * 6}px)`,
          maxWidth: 1400,
          textAlign: "center",
        }}
      >
        {cur}
      </div>
    </AbsoluteFill>
  )
}

/** Scene wrapper: short fade + slight zoom at both ends for smooth cuts. */
const Wrap = ({ frames, children }: { frames: number; children: React.ReactNode }) => {
  const f = useCurrentFrame()
  const tin = Math.min(1, f / 9)
  const tout = Math.min(1, (frames - f) / 9)
  const o = Math.min(tin, tout)
  return <AbsoluteFill style={{ opacity: o, transform: `scale(${1.015 - 0.015 * o})` }}>{children}</AbsoluteFill>
}

const Progress = () => {
  const f = useCurrentFrame()
  return <div style={{ position: "absolute", left: 0, bottom: 0, height: 4, width: `${(f / tl.frames) * 100}%`, background: C.btc, opacity: 0.85 }} />
}

export const ParDemo = () => (
  <AbsoluteFill style={{ background: C.ink }}>
    <FontFaces />
    <Audio src={staticFile("audio/soundtrack.wav")} />
    {tl.scenes.map((s) => {
      const Comp = SCENES[s.id]
      return (
        <Sequence key={s.id} from={s.from} durationInFrames={s.frames + (s.id === "outro" ? 0 : 6)} name={s.id}>
          <Wrap frames={s.frames + 6}>
            <Comp />
          </Wrap>
        </Sequence>
      )
    })}
    <Captions />
    <Progress />
  </AbsoluteFill>
)

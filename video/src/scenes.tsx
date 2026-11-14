import React from "react"
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion"
import cues from "./cues.json"
import boxes from "./boxes.json"
import { At, Bg, Browser, C, Card, Chip, Cursor, EASE_IN_OUT, Fade, Icon, Kicker, MONO, Mark, Num, Phone, Pop, SANS, Words, fmt, sp, tw, useT, Wordmark } from "./kit"

const S = (n: string) => `shots/${n}.png`
const Center = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", ...style }}>{children}</AbsoluteFill>
)
/** Cross-fade helper for a sequence of screenshots: [[src, tStart], ...]. Later layers fade in on top. */
const xfade = (t: number, list: [string, number][], dur = 0.45) =>
  list.map(([src, t0], i) => ({ src, o: i === 0 ? 1 : tw(t, t0, t0 + dur) }))
const camera = (t: number, keys: [number, number, number, number][]) => {
  // keys: [t, zoom, fx, fy]
  let z = keys[0][1], x = keys[0][2], y = keys[0][3]
  for (let i = 1; i < keys.length; i++) {
    const [ta, za, xa, ya] = keys[i - 1]
    const [tb, zb, xb, yb] = keys[i]
    if (t >= tb) { z = zb; x = xb; y = yb } else if (t > ta) {
      const p = tw(t, ta, tb, 0, 1, EASE_IN_OUT)
      z = za + (zb - za) * p; x = xa + (xb - xa) * p; y = ya + (yb - ya) * p
      break
    }
  }
  return { zoom: z, focus: { x, y } }
}
const enter = (t: number, d = 0.8) => ({ opacity: tw(t, 0, 0.5), transform: `translateY(${(1 - tw(t, 0, d)) * 60}px) scale(${0.96 + 0.04 * tw(t, 0, d)})` })

// =================================================================== 1. hook
export const Hook = () => {
  const t = useT()
  const k = cues.hook
  const lines: [string, "house" | "lock" | "chain", number][] = [
    ["Rent, paid one to two years upfront.", "house", k.line1],
    ["Cash locked away as deposits.", "lock", k.line2],
    ["IOUs that break when one link fails.", "chain", k.line3],
  ]
  const active = lines.reduce((acc, l, i) => (t >= l[2] ? i : acc), -1)
  const shake = t > k.break && t < k.break + 0.5 ? Math.sin(t * 90) * 10 * (1 - (t - k.break) / 0.5) : 0
  return (
    <AbsoluteFill>
      <Bg dark glowX={0.8} glowY={0.75} />
      <AbsoluteFill style={{ padding: "150px 160px", transform: `translateX(${shake}px)` }}>
        <Fade t={t} t0={0.2}>
          <Kicker dark>Trust is expensive</Kicker>
        </Fade>
        <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 26 }}>
          {lines.map(([text, icon, t0], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 34, opacity: i < active ? 0.32 : 1, transition: "none" }}>
              <Pop t={t} t0={t0}>
                <div style={{ width: 92, height: 92, borderRadius: 24, background: "#17171A", border: "1px solid #2A2A2E", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={46} color={i === active ? C.btc : "#fff"} /></div>
              </Pop>
              <Words t={t} t0={t0 + 0.1} text={text} size={74} color="#fff" />
            </div>
          ))}
        </div>
        {/* the chain: five links; one snaps */}
        <div style={{ position: "absolute", left: 160, right: 160, bottom: 140, height: 120, opacity: tw(t, k.line3 + 0.6, k.line3 + 1.2) }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const broken = i === 2 && t > k.break
            const drop = broken ? tw(t, k.break, k.break + 1.2) : 0
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${i * 22}%`,
                  top: 30 + drop * 140,
                  width: "16%",
                  height: 60,
                  borderRadius: 30,
                  border: `6px solid ${broken ? C.bad : "#3A3A40"}`,
                  transform: `rotate(${drop * 24}deg)`,
                  opacity: 1 - drop * 0.6,
                }}
              />
            )
          })}
          {[0, 1, 2, 3].map((i) => {
            const near = i === 1 || i === 2
            const off = near && t > k.break ? tw(t, k.break, k.break + 0.6) * (i === 1 ? -30 : 30) : 0
            return <div key={i} style={{ position: "absolute", left: `${i * 22 + 14}%`, top: 54, width: "10%", height: 12, borderRadius: 6, background: near && t > k.break ? C.bad : "#3A3A40", transform: `translateX(${off}px)`, opacity: near && t > k.break ? 1 - tw(t, k.break + 0.2, k.break + 0.9) : 1 }} />
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// =================================================================== 2. idle
export const Idle = () => {
  const t = useT()
  const k = cues.idle
  const freeze = tw(t, k.freeze, k.freeze + 0.8)
  const angle = (t < k.freeze ? t : k.freeze) * 220
  return (
    <AbsoluteFill>
      <Bg dark glowX={0.5} glowY={0.6} />
      <Center>
        <div style={{ display: "flex", alignItems: "center", gap: 90 }}>
          <div style={{ position: "relative", width: 260, height: 260, borderRadius: 130, border: "6px solid #2E2E33", opacity: 1 - tw(t, k.btc, k.btc + 0.6) * 0.7 }}>
            <div style={{ position: "absolute", left: 127, top: 40, width: 6, height: 90, background: "#fff", borderRadius: 3, transformOrigin: "50% 100%", transform: `rotate(${angle}deg)` }} />
            <div style={{ position: "absolute", left: 127, top: 70, width: 6, height: 60, background: C.btc, borderRadius: 3, transformOrigin: "50% 100%", transform: `rotate(${angle / 12}deg)` }} />
            <div style={{ position: "absolute", inset: -30, borderRadius: 160, border: `2px solid rgba(255,255,255,${0.15 * freeze})` }} />
          </div>
          <div>
            <Words t={t} t0={0.25} text="Money, sitting still." size={96} color="#fff" />
            <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 22, opacity: tw(t, k.btc, k.btc + 0.6), transform: `translateY(${(1 - tw(t, k.btc, k.btc + 0.8)) * 30}px)` }}>
              <div style={{ width: 70, height: 70, borderRadius: 35, background: C.btc, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 ${40 + Math.sin(t * 3) * 10}px rgba(247,147,26,.6)` }}><Icon name="btc" size={46} color={C.ink} /></div>
              <span style={{ fontFamily: SANS, fontSize: 44, color: "#C9CBD0", letterSpacing: "-0.02em" }}>Value Bitcoin holders would rather not sell.</span>
            </div>
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  )
}

// =================================================================== 3. logo
export const Logo = () => {
  const t = useT()
  const k = cues.logo
  const p = tw(t, k.join - 0.8, k.join, 0, 1)
  const burst = tw(t, k.join, k.join + 1.2)
  const dark = 1 - tw(t, k.join + 0.1, k.join + 0.9)
  return (
    <AbsoluteFill>
      <Bg dark={false} glowX={0.5} glowY={0.5} />
      <AbsoluteFill style={{ background: C.ink, opacity: dark }} />
      <Center>
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 450, border: `2px solid ${C.btc}`, opacity: (1 - burst) * (t > k.join ? 0.8 : 0), transform: `scale(${0.3 + burst * 1.4})` }} />
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 450, background: `radial-gradient(circle, rgba(247,147,26,.35), transparent 60%)`, opacity: (1 - burst) * (t > k.join ? 1 : 0), transform: `scale(${0.5 + burst})` }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 46 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 46, transform: `scale(${1 + (1 - sp(t, k.join, 30, 10, 140)) * 0.15})` }}>
            <Mark size={190} p={p} inverted={dark > 0.5} />
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: 210, letterSpacing: "-0.06em", color: C.ink, lineHeight: 1, transform: `translateX(${(1 - tw(t, k.word, k.word + 0.8)) * -110}%)` }}>par</div>
            </div>
          </div>
          <Words t={t} t0={k.tag} text="Your Bitcoin, as a promise." size={68} muted="as a promise." />
          <div style={{ display: "flex", gap: 16, opacity: tw(t, k.mezo, k.mezo + 0.5) }}>
            <Chip tone="light" size={26}>Built on Mezo</Chip>
            <Chip tone="btc" size={26}>Backed by MUSD</Chip>
          </div>
        </div>
      </Center>
    </AbsoluteFill>
  )
}

// =================================================================== 4. insight
export const Insight = () => {
  const t = useT()
  const k = cues.insight
  const fill = tw(t, k.bar, k.bar + 1.4)
  const split = tw(t, k.promises, k.promises + 1.1)
  const promises = [
    ["Rent guarantee", "1,500 MUSD"],
    ["Supplier bond", "1,000 MUSD"],
    ["Circuit credit line", "150 MUSD"],
  ]
  return (
    <AbsoluteFill>
      <Bg glowX={0.2} glowY={0.2} />
      <AbsoluteFill style={{ padding: "120px 150px" }}>
        <Fade t={t} t0={0.1}>
          <Kicker>The insight</Kicker>
        </Fade>
        <Words t={t} t0={0.2} text="A MUSD trove is a fixed, BTC-backed credit line." size={70} muted="credit line." style={{ marginTop: 18, maxWidth: 1500 }} />
        <div style={{ marginTop: 90, position: "relative" }}>
          <div style={{ fontFamily: SANS, fontSize: 24, color: C.muted, marginBottom: 16, opacity: tw(t, k.bar, k.bar + 0.4) }}>Borrowing capacity, locked at open</div>
          <div style={{ height: 96, borderRadius: 22, background: "#fff", border: `1px solid ${C.line}`, overflow: "hidden", position: "relative", boxShadow: "0 20px 50px -30px rgba(0,0,0,.3)" }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${14 * fill}%`, background: C.ink }} />
            <div
              style={{
                position: "absolute",
                left: "14%",
                top: 0,
                bottom: 0,
                width: `${86 * fill}%`,
                backgroundImage: `repeating-linear-gradient(-45deg, ${C.btcWash} 0 14px, #FFE9CF 14px 28px)`,
                opacity: tw(t, k.undrawn - 0.4, k.undrawn + 0.4),
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18, fontFamily: SANS, fontSize: 24 }}>
            <span style={{ opacity: tw(t, k.bar + 0.8, k.bar + 1.3) }}>
              <b>1,800 MUSD</b> <span style={{ color: C.muted }}>drawn once, kept as a buffer</span>
            </span>
            <span style={{ color: C.btcInk, opacity: tw(t, k.undrawn, k.undrawn + 0.5) }}>
              <b>Undrawn capacity</b> · usually never used
            </span>
          </div>
          {/* the undrawn part splits into promises */}
          <div style={{ display: "flex", gap: 26, marginTop: 70, marginLeft: "14%" }}>
            {promises.map(([a, b], i) => (
              <div key={a} style={{ opacity: split, transform: `translateY(${(1 - tw(t, k.promises + i * 0.15, k.promises + i * 0.15 + 0.9)) * -90}px)` }}>
                <Card style={{ padding: "26px 32px", minWidth: 330 }}>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{a}</div>
                  <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 30, color: C.btcInk }}>{b}</div>
                </Card>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "absolute", right: 150, bottom: 120 }}>
          <Pop t={t} t0={k.zero}>
            <Chip tone="ink" size={34}>
              <Num v="0 MUSD" /> drawn until a promise is called
            </Chip>
          </Pop>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// =================================================================== 5. vault
export const Vault = () => {
  const t = useT()
  const k = cues.vault
  const shots = xfade(t, [[S("10-vault-create"), 0], [S("12-vault-open-preview"), k.trove], [S("13-vault-dashboard"), k.dash]])
  const cam = camera(t, [
    [0, 1.0, 0.5, 0.5],
    [1.4, 1.35, 0.3, 0.45],
    [k.trove + 0.3, 1.25, 0.45, 0.55],
    [k.open - 0.6, 1.3, 0.35, 0.65],
    [k.dash + 0.4, 1.0, 0.5, 0.5],
    [k.buffer, 1.45, 0.3, 0.5],
  ])
  const b = boxes as any
  return (
    <AbsoluteFill>
      <Bg glowX={0.85} glowY={0.15} />
      <AbsoluteFill style={{ padding: "60px 0 0 0", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, ...enter(t) }}>
          <Kicker>Step 1</Kicker>
          <span style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em" }}>Open a vault. Lock BTC once.</span>
        </div>
        <div style={enter(t)}>
          <Browser src={shots} url="par-rosy.vercel.app/vault" width={1500} zoom={cam.zoom} focus={cam.focus}>
            <Cursor
              t={t}
              path={[
                { t: 1.0, x: 0.55, y: 0.75 },
                { t: k.create - 0.1, x: b.createVault.x, y: b.createVault.y },
                { t: k.create, x: b.createVault.x, y: b.createVault.y, click: true },
                { t: k.open - 0.6, x: b.btcInput.x, y: b.btcInput.y },
                { t: k.open, x: b.openTrove.x, y: b.openTrove.y, click: true },
                { t: k.dash + 1.5, x: 0.7, y: 0.4 },
              ]}
            />
          </Browser>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 120, top: 330 }}>
        <Pop t={t} t0={k.trove + 0.8}>
          <Chip tone="light" size={26}>
            Capacity &amp; 1% rate <b>fixed at open</b>
          </Chip>
        </Pop>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 120 }}>
        <Pop t={t} t0={k.buffer}>
          <Chip tone="btc" size={28}>
            <Num v="1,800 MUSD" /> buffer, ready to pay
          </Chip>
        </Pop>
      </div>
    </AbsoluteFill>
  )
}

// =================================================================== 6. builder
export const Builder = () => {
  const t = useT()
  const k = cues.builder
  const b = boxes as any
  const shots = xfade(t, [[S("20-builder-empty"), 0], [S("21-builder-filled"), k.typeB + 1.4], [S("22-builder-done"), k.done]])
  const cam = camera(t, [
    [0, 1.0, 0.5, 0.5],
    [k.typeA, 1.35, 0.33, 0.55],
    [k.stress - 0.4, 1.35, 0.33, 0.6],
    [k.stress + 0.5, 1.7, 0.6, 0.33],
    [k.make - 0.9, 1.3, 0.62, 0.62],
    [k.done + 0.3, 1.0, 0.5, 0.5],
  ])
  // stress graphic
  const crash = tw(t, k.crash, k.crash + 1.6)
  const btc = 65500 * (1 - 0.4 * crash)
  const ratio = 4.67 - (4.67 - 2.8) * crash
  const showStress = tw(t, k.stress + 0.6, k.stress + 1.2) * (1 - tw(t, k.make - 0.6, k.make - 0.1))
  return (
    <AbsoluteFill>
      <Bg glowX={0.15} glowY={0.85} />
      <AbsoluteFill style={{ padding: "60px 0 0 0", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, ...enter(t) }}>
          <Kicker>Step 2</Kicker>
          <span style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em" }}>Make a promise. It's stress-tested first.</span>
        </div>
        <div style={enter(t)}>
          <Browser src={shots} url="par-rosy.vercel.app/vault/new-guarantee" width={1500} zoom={cam.zoom} focus={cam.focus}>
            <Cursor
              t={t}
              path={[
                { t: k.typeA - 0.4, x: b.benef.x, y: b.benef.y, click: true },
                { t: k.typeA + 0.8, x: b.payer.x, y: b.payer.y, click: true },
                { t: k.typeB, x: b.inst.x, y: b.inst.y, click: true },
                { t: k.typeB + 0.5, x: b.count.x, y: b.count.y, click: true },
                { t: k.typeB + 1.0, x: b.demoBtn.x, y: b.demoBtn.y, click: true },
                { t: k.typeB + 1.5, x: b.cover.x, y: b.cover.y, click: true },
                { t: k.make - 0.3, x: b.make.x, y: b.make.y },
                { t: k.make, x: b.make.x, y: b.make.y, click: true },
              ]}
            />
          </Browser>
        </div>
      </AbsoluteFill>
      {/* stress test overlay */}
      <div style={{ position: "absolute", right: 70, top: 190, opacity: showStress, transform: `translateX(${(1 - showStress) * 60}px)` }}>
        <Card style={{ width: 560, padding: 34 }}>
          <Kicker style={{ fontSize: 16 }}>Stress test</Kicker>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, alignItems: "baseline" }}>
            <span style={{ fontSize: 24, color: C.muted }}>BTC price</span>
            <Num v={`$${fmt(btc)}`} style={{ fontSize: 40, color: crash > 0.02 ? C.bad : C.ink }} />
          </div>
          <div style={{ height: 10, borderRadius: 5, background: C.soft, marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${100 - 40 * crash}%`, background: crash > 0.02 ? C.bad : C.ink }} />
          </div>
          <div style={{ marginTop: 10, fontSize: 20, color: C.bad, opacity: tw(t, k.crash, k.crash + 0.3) }}>−40% · every promise called at once</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 30, alignItems: "baseline" }}>
            <span style={{ fontSize: 24, color: C.muted }}>Vault ratio</span>
            <Num v={`${Math.round(ratio * 100)}%`} style={{ fontSize: 56, color: C.ink }} />
          </div>
          <div style={{ position: "relative", height: 14, borderRadius: 7, background: C.soft, marginTop: 10 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, (ratio / 5) * 100)}%`, background: C.ok, borderRadius: 7 }} />
            <div style={{ position: "absolute", left: `${(1.6 / 5) * 100}%`, top: -10, bottom: -10, width: 3, background: C.ink }} />
            <div style={{ position: "absolute", left: `${(1.6 / 5) * 100}%`, top: 24, fontFamily: MONO, fontSize: 18, transform: "translateX(-50%)" }}>160% needed</div>
          </div>
          <div style={{ marginTop: 56 }}>
            <Pop t={t} t0={k.fits}>
              <Chip tone="ok" size={30}>✓ Fits at 280%. The promise can exist.</Chip>
            </Pop>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 120, bottom: 110 }}>
        <Pop t={t} t0={k.typeA + 0.2}>
          <Chip tone="light" size={26}>
            Rent · <Num v="500 MUSD × 3" /> · cover <Num v="1,500" />
          </Chip>
        </Pop>
      </div>
    </AbsoluteFill>
  )
}

// =================================================================== 7. certificate
export const Cert = () => {
  const t = useT()
  const k = cues.cert
  const slide = sp(t, k.phone, 30, 14, 110)
  const scroll = tw(t, k.drop + 0.8, k.drop + 2.2) * 0
  return (
    <AbsoluteFill>
      <Bg glowX={0.5} glowY={0.4} />
      <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 120 }}>
        <div style={{ width: 640 }}>
          <Fade t={t} t0={0.2}>
            <Kicker>Step 3 · For the landlord</Kicker>
          </Fade>
          <Words t={t} t0={0.35} text="A live certificate, verifiable onchain." size={72} muted="verifiable onchain." style={{ marginTop: 18 }} />
          <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 20, alignItems: "flex-start" }}>
            <Pop t={t} t0={k.cover}>
              <Chip tone="light" size={28}>
                <Num v="1,500 MUSD" /> cover remaining
              </Chip>
            </Pop>
            <Pop t={t} t0={k.cover + 0.7}>
              <Chip tone="light" size={28}>Valid until the last installment</Chip>
            </Pop>
            <Pop t={t} t0={k.drop}>
              <Chip tone="btc" size={28}>Holds even if BTC falls 54%</Chip>
            </Pop>
          </div>
        </div>
        <div style={{ position: "relative", transform: `translateY(${(1 - slide) * 700}px) rotate(${(1 - slide) * 8}deg)` }}>
          <Phone src={S("50-cert-phone")} width={430} scrollY={scroll} />
          <div style={{ position: "absolute", right: -230, bottom: 160 }}>
            <Pop t={t} t0={k.share}>
              <div style={{ width: 320, background: "#E7FFDB", borderRadius: "22px 22px 6px 22px", padding: "18px 22px", boxShadow: "0 20px 40px -20px rgba(0,0,0,.35)", fontFamily: SANS }}>
                <div style={{ fontSize: 18, color: "#0E7A6E", fontWeight: 600 }}>WhatsApp</div>
                <div style={{ fontSize: 22, marginTop: 6, color: C.ink }}>Your rent is guaranteed by Par.</div>
                <div style={{ fontSize: 17, marginTop: 6, color: "#4B6B5A" }}>par-rosy.vercel.app/c/…</div>
              </div>
            </Pop>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// =================================================================== 8. missed payment
export const Miss = () => {
  const t = useT()
  const k = cues.miss
  const shots = xfade(t, [[S("51b-cert-desktop-timeline"), 0], [S("53-cert-missed"), k.missed - 0.2], [S("55-cert-paid-timeline"), k.paid]])
  const cam = camera(t, [
    [0, 1.0, 0.5, 0.5],
    [1.5, 1.55, 0.5, 0.66],
    [k.click + 1.5, 1.55, 0.5, 0.66],
    [k.buffer - 0.5, 1.15, 0.5, 0.55],
  ])
  const flow = tw(t, k.buffer - 0.3, k.buffer + 0.6)
  return (
    <AbsoluteFill>
      <Bg glowX={0.85} glowY={0.8} />
      <AbsoluteFill style={{ padding: "60px 0 0 90px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, ...enter(t) }}>
          <Kicker>Step 4</Kicker>
          <span style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em" }}>A payment is missed. The vault pays.</span>
        </div>
        <div style={enter(t)}>
          <Browser src={shots} url="par-rosy.vercel.app/c/0xa8cb…/1" width={1100} zoom={cam.zoom} focus={cam.focus}>
            <Cursor t={t} path={[{ t: k.click - 1.2, x: 0.75, y: 0.8 }, { t: k.click - 0.1, x: 0.61, y: 0.622 }, { t: k.click, x: 0.61, y: 0.622, click: true }, { t: k.click + 1.6, x: 0.8, y: 0.85 }]} />
          </Browser>
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", right: 90, top: 200, width: 560, display: "flex", flexDirection: "column", gap: 22 }}>
        <Pop t={t} t0={k.missed}>
          <Chip tone="bad" size={26}>● Installment 1 missed · grace over</Chip>
        </Pop>
        <Pop t={t} t0={k.paid}>
          <Chip tone="ok" size={26}>✓ 500 MUSD paid to the landlord</Chip>
        </Pop>
        <div style={{ opacity: flow, transform: `translateY(${(1 - flow) * 30}px)`, marginTop: 16 }}>
          <Card style={{ padding: 30 }}>
            <Kicker style={{ fontSize: 16 }}>Payout waterfall</Kicker>
            {[
              ["1", "MUSD buffer", "pays first, no new debt", k.buffer],
              ["2", "Mint from the trove", "only if the buffer runs out", k.mint],
              ["3", "Recovery Mode", "top up with idle BTC", k.mint + 0.6],
            ].map(([n, a, d, t0]) => (
              <div key={n as string} style={{ display: "flex", gap: 18, alignItems: "center", marginTop: 20, opacity: tw(t, t0 as number, (t0 as number) + 0.4) }}>
                <span style={{ width: 40, height: 40, borderRadius: 20, background: n === "1" ? C.btc : C.ink, color: n === "1" ? C.ink : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 18 }}>{n}</span>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 600 }}>{a}</div>
                  <div style={{ fontSize: 19, color: C.muted }}>{d}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
        <Pop t={t} t0={k.keeper}>
          <div style={{ fontFamily: MONO, fontSize: 19, background: C.ink, color: "#C9CBD0", borderRadius: 16, padding: "16px 20px" }}>
            <span style={{ color: C.btc }}>keeper</span> triggerMissed(#1, 0) → <span style={{ color: "#4ADE80" }}>success</span>
          </div>
        </Pop>
      </div>
    </AbsoluteFill>
  )
}

// =================================================================== 9. circuit intro
export const Circuit = () => {
  const t = useT()
  const k = cues.circuit
  const inv = [
    ["Member B owes A", "1,000 MUSD", k.inv1],
    ["Member C owes B", "1,000 MUSD", k.inv2],
    ["Member A owes C", "900 MUSD", k.inv3],
  ]
  return (
    <AbsoluteFill>
      <Bg dark glowX={0.25} glowY={0.3} />
      <AbsoluteFill style={{ padding: "120px 140px", flexDirection: "row", gap: 90, alignItems: "center" }}>
        <div style={{ width: 760 }}>
          <Fade t={t} t0={0.1}>
            <Kicker dark>Par Circuit</Kicker>
          </Fade>
          <Words t={t} t0={0.25} text="Trade credit that clears itself." size={84} color="#fff" muted="clears itself." style={{ marginTop: 18 }} />
          <Fade t={t} t0={1.2}>
            <div style={{ marginTop: 34, fontFamily: SANS, fontSize: 30, color: "#B4B7BD", lineHeight: 1.45 }}>Shops that sell to each other log invoices. The contract nets every one as it's accepted, in O(1).</div>
          </Fade>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {inv.map(([a, b, t0]) => (
            <Pop key={a as string} t={t} t0={t0 as number}>
              <Card dark style={{ width: 560, padding: "26px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 28 }}>{a}</span>
                <Num v={b as string} style={{ fontSize: 32, color: C.btc }} />
              </Card>
            </Pop>
          ))}
          <Fade t={t} t0={k.inv3 + 0.8}>
            <div style={{ fontFamily: MONO, fontSize: 22, color: "#8A8E96", marginTop: 6 }}>…posted 100 MUSD at a time, 29 invoices</div>
          </Fade>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// =================================================================== 10. clear
export const Clear = () => {
  const t = useT()
  const k = cues.clear
  const b = boxes as any
  const frames: [string, number][] = [[S("31-circle-before"), 0]]
  for (let i = 0; i < 6; i++) frames.push([S(`32-circle-clear-${i}`), k.collapse + i * 0.72])
  frames.push([S("33-circle-netted"), k.netted])
  frames.push([S("34-circle-members"), k.force - 0.4])
  const shots = xfade(t, frames, 0.25)
  const cam = camera(t, [
    [0, 1.0, 0.5, 0.5],
    [k.collapse, 1.25, 0.32, 0.5],
    [k.netted + 0.4, 1.2, 0.32, 0.5],
    [k.force, 1.0, 0.5, 0.5],
  ])
  const flash = t > k.netted ? 1 - tw(t, k.netted, k.netted + 0.6) : 0
  const count = tw(t, k.count, k.count + 1.6)
  return (
    <AbsoluteFill>
      <Bg glowX={0.2} glowY={0.5} />
      <AbsoluteFill style={{ padding: "60px 0 0 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, ...enter(t) }}>
          <Kicker>Clear the cycle</Kicker>
          <span style={{ fontFamily: SANS, fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em" }}>Watch the loop collapse.</span>
        </div>
        <div style={enter(t)}>
          <Browser src={shots} url="par-rosy.vercel.app/circuit/0" width={1180} zoom={cam.zoom} focus={cam.focus}>
            <Cursor t={t} path={[{ t: 0.1, x: 0.7, y: 0.9 }, { t: k.click - 0.1, x: b.clear.x, y: b.clear.y }, { t: k.click, x: b.clear.x, y: b.clear.y, click: true }, { t: k.click + 1.2, x: 0.75, y: 0.95 }]} />
          </Browser>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "#fff", opacity: flash * 0.55, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 80, top: 190, width: 540, display: "flex", flexDirection: "column", gap: 24 }}>
        <Pop t={t} t0={k.netted}>
          <Card style={{ padding: 34 }}>
            <div style={{ fontSize: 22, color: C.muted }}>Invoiced</div>
            <Num v={`${fmt(2900)} MUSD`} style={{ fontSize: 58, display: "block" }} />
            <div style={{ fontSize: 22, color: C.muted, marginTop: 18 }}>Actually moved</div>
            <Num v={`${fmt(2900 - 2800 * count)} MUSD`} style={{ fontSize: 72, color: C.btcInk, display: "block" }} />
            <div style={{ height: 12, borderRadius: 6, background: C.soft, marginTop: 18, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${96.55 * count}%`, background: C.btc }} />
            </div>
            <div style={{ marginTop: 12, fontSize: 26 }}>
              <Num v={`${(96.55 * count).toFixed(2)}%`} style={{ color: C.ok }} /> netted
            </div>
          </Card>
        </Pop>
        <Pop t={t} t0={k.force}>
          <Chip tone="ink" size={24}>Defaulter force-settled from their clearing line</Chip>
        </Pop>
      </div>
    </AbsoluteFill>
  )
}

// =================================================================== 11. tech
export const Tech = () => {
  const t = useT()
  const k = cues.tech
  const typed = "npx hardhat test".slice(0, Math.max(0, Math.floor((t - k.tests - 0.2) * 14)))
  const lines = [
    ["✔", "C1: no release while a claim is open", 0.9],
    ["✔", "H1: circuit cycles always terminate", 1.1],
    ["✔", "invariant: reserved == Σ open cover (400 steps)", 1.3],
    ["✔", "Recovery Mode via triggerMissed / drawLine", 1.5],
  ]
  const logs = ["forceSettle circle 0 · drew 100 MUSD", "triggerMissed #1[0] → success", "heartbeat · balance 0.01 BTC"]
  return (
    <AbsoluteFill>
      <Bg dark glowX={0.7} glowY={0.2} />
      <AbsoluteFill style={{ padding: "90px 120px" }}>
        <Fade t={t} t0={0.1}>
          <Kicker dark>Under the hood</Kicker>
        </Fade>
        <Words t={t} t0={0.2} text="Built on MUSD's core contracts, not just the token." size={60} color="#fff" muted="not just the token." style={{ marginTop: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginTop: 46 }}>
          {/* architecture */}
          <Pop t={t} t0={k.arch}>
            <Card dark style={{ height: 330, padding: 30 }}>
              <Kicker dark style={{ fontSize: 15 }}>Architecture</Kicker>
              <svg width="100%" height="250" viewBox="0 0 780 250" style={{ marginTop: 6 }}>
                {[
                  ["ParFactory", 20, 30],
                  ["ParVault (your clone)", 20, 120],
                  ["ParCircuit", 20, 200],
                  ["BorrowerOperations", 470, 40],
                  ["TroveManager · PriceFeed", 470, 120],
                  ["MUSD", 470, 200],
                ].map(([l, x, y], i) => (
                  <g key={i} opacity={tw(t, k.arch + 0.15 * i, k.arch + 0.15 * i + 0.4)}>
                    <rect x={x as number} y={y as number} width={290} height={46} rx={12} fill="#1E1E22" stroke={i < 3 ? C.btc : "#3A3A40"} />
                    <text x={(x as number) + 18} y={(y as number) + 30} fill="#fff" fontFamily="Geist" fontSize={20}>{l}</text>
                  </g>
                ))}
                {[
                  [310, 143, 470, 63],
                  [310, 143, 470, 143],
                  [310, 223, 165, 166],
                  [165, 76, 165, 120],
                  [310, 223, 470, 223],
                ].map(([x1, y1, x2, y2], i) => {
                  const p = tw(t, k.arch + 1 + i * 0.15, k.arch + 1.6 + i * 0.15)
                  return <line key={i} x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke="#8A8E96" strokeWidth={2} strokeDasharray="6 6" />
                })}
              </svg>
            </Card>
          </Pop>
          {/* verified */}
          <Pop t={t} t0={k.verified}>
            <Card dark style={{ height: 330, padding: 0, overflow: "hidden", position: "relative" }}>
              <Img src={staticFile(S("60-explorer-verified"))} style={{ width: "100%", opacity: 0.9 }} />
              <div style={{ position: "absolute", left: 26, bottom: 24 }}>
                <Chip tone="ok" size={24}>✓ 3 contracts verified on Mezo testnet</Chip>
              </div>
            </Card>
          </Pop>
          {/* tests */}
          <Pop t={t} t0={k.tests}>
            <Card dark style={{ height: 300, padding: 30, fontFamily: MONO, fontSize: 21, color: "#C9CBD0" }}>
              <div>
                <span style={{ color: C.btc }}>$</span> {typed}
                <span style={{ opacity: Math.floor(t * 2) % 2 ? 1 : 0 }}>▍</span>
              </div>
              {lines.map(([c, l, d]) => (
                <div key={l as string} style={{ marginTop: 10, opacity: tw(t, k.tests + (d as number), k.tests + (d as number) + 0.2) }}>
                  <span style={{ color: "#4ADE80" }}>{c}</span> {l}
                </div>
              ))}
              <div style={{ marginTop: 16, color: "#4ADE80", fontSize: 26, opacity: tw(t, k.tests + 2, k.tests + 2.2) }}>44 passing</div>
            </Card>
          </Pop>
          {/* keeper */}
          <Pop t={t} t0={k.keeper}>
            <Card dark style={{ height: 300, padding: 30 }}>
              <Kicker dark style={{ fontSize: 15 }}>Keeper · Railway · every 15 s</Kicker>
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12, fontFamily: MONO, fontSize: 20, color: "#C9CBD0" }}>
                {logs.map((l, i) => (
                  <div key={l} style={{ opacity: tw(t, k.keeper + 0.4 + i * 0.5, k.keeper + 0.6 + i * 0.5) }}>
                    <span style={{ color: "#8A8E96" }}>20:{38 + i}:0{i}</span> {l}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22, display: "flex", gap: 12 }}>
                <Chip tone="btc" size={20}>Recovery Mode handled</Chip>
                <Chip tone="light" size={20}>Alerts on change</Chip>
              </div>
            </Card>
          </Pop>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// =================================================================== 12. next
export const Next = () => {
  const t = useT()
  const k = cues.next
  const cards: [string, string, string, number][] = [
    ["Dec 2026", "Pilot", "Rent guarantees and merchant bonds with Lagos merchants.", k.c1],
    ["Q1 2027", "Underwriting", "Bitcoin holders back other people's promises for a premium.", k.c2],
    ["Q2 2027", "Mainnet", "Audit, conservative parameters, a live Circuit trade cluster.", k.c3],
  ]
  return (
    <AbsoluteFill>
      <Bg glowX={0.5} glowY={0.85} />
      <AbsoluteFill style={{ padding: "130px 140px" }}>
        <Fade t={t} t0={0.1}>
          <Kicker>What's next</Kicker>
        </Fade>
        <Words t={t} t0={0.2} text="From testnet to a live trade circle." size={76} muted="a live trade circle." style={{ marginTop: 16 }} />
        <div style={{ position: "relative", marginTop: 90 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 22, height: 3, background: C.line }} />
          <div style={{ position: "absolute", left: 0, top: 22, height: 3, width: `${tw(t, k.c1 - 0.2, k.c3 + 0.6) * 100}%`, background: C.btc }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 36 }}>
            {cards.map(([when, what, d, t0]) => (
              <div key={what}>
                <Pop t={t} t0={t0}>
                  <div style={{ width: 46, height: 46, borderRadius: 23, background: C.ink, border: `6px solid ${C.canvas}`, boxShadow: `0 0 0 3px ${C.btc}` }} />
                </Pop>
                <Fade t={t} t0={t0 + 0.1}>
                  <Card style={{ marginTop: 30 }}>
                    <Num v={when} style={{ fontSize: 22, color: C.btcInk }} />
                    <div style={{ fontSize: 40, fontWeight: 600, marginTop: 8, letterSpacing: "-0.03em" }}>{what}</div>
                    <div style={{ fontSize: 24, color: C.muted, marginTop: 10, lineHeight: 1.4 }}>{d}</div>
                  </Card>
                </Fade>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

// =================================================================== 13. montage
export const Montage = () => {
  const t = useT()
  const k = cues.montage
  const items: [string, string, number][] = [
    [S("01-landing-hero"), "par-rosy.vercel.app", k.a],
    [S("40-docs"), "par-rosy.vercel.app/docs", k.b],
    [S("42-security"), "par-rosy.vercel.app/security", k.c],
  ]
  return (
    <AbsoluteFill>
      <Bg glowX={0.5} glowY={0.5} />
      {items.map(([src, url, t0], i) => {
        const local = t - t0
        const vis = tw(t, t0, t0 + 0.35) * (i < 2 ? 1 - tw(t, items[i + 1][2], items[i + 1][2] + 0.3) : 1)
        if (vis <= 0) return null
        return (
          <Center key={src} style={{ opacity: vis }}>
            <div style={{ transform: `scale(${1.06 - 0.06 * tw(local, 0, 2.2)}) translateX(${(1 - tw(local, 0, 0.6)) * (i % 2 ? -80 : 80)}px)` }}>
              <Browser src={src} url={url} width={1500} zoom={1.08 + 0.12 * tw(local, 0, 2.2)} focus={{ x: 0.45, y: 0.4 }} />
            </div>
          </Center>
        )
      })}
    </AbsoluteFill>
  )
}

// =================================================================== 14. outro
export const Outro = () => {
  const t = useT()
  const k = cues.outro
  const p = tw(t, k.join - 0.7, k.join)
  const burst = tw(t, k.join, k.join + 1.3)
  return (
    <AbsoluteFill>
      <Bg dark glowX={0.5} glowY={0.5} />
      <Center>
        <div style={{ position: "absolute", width: 1000, height: 1000, borderRadius: 500, background: `radial-gradient(circle, rgba(247,147,26,.28), transparent 60%)`, opacity: t > k.join ? 1 - burst * 0.5 : 0, transform: `scale(${0.6 + burst * 0.6})` }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
            <Mark size={150} p={p} inverted />
            <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: 168, letterSpacing: "-0.06em", color: "#fff", lineHeight: 1, opacity: tw(t, k.join, k.join + 0.6) }}>par</span>
          </div>
          <Words t={t} t0={k.join + 0.4} text="Your Bitcoin, as a promise." size={62} color="#fff" muted="as a promise." />
          <div style={{ display: "flex", gap: 18, opacity: tw(t, k.url, k.url + 0.6), transform: `translateY(${(1 - tw(t, k.url, k.url + 0.8)) * 20}px)` }}>
            <Chip tone="btc" size={28}>par-rosy.vercel.app</Chip>
            <Chip tone="light" size={28}>github.com/linoxbt/par</Chip>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.14em", color: "#8A8E96", opacity: tw(t, k.url + 0.6, k.url + 1.2) }}>BUILT ON MEZO · BACKED BY MUSD · LIVE ON TESTNET</div>
        </div>
      </Center>
    </AbsoluteFill>
  )
}

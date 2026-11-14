import { ImageResponse } from "next/og"

export const alt = "Par · Your Bitcoin, as a promise"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OG() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FAFAFA", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 32 32">
            <path d="M3 15a13 13 0 0 1 26 0z" fill="#0A0A0B" />
            <path d="M3 17h26a13 13 0 0 1-26 0z" fill="#F7931A" />
          </svg>
          <span style={{ fontSize: 64, fontWeight: 700, letterSpacing: -3, color: "#0A0A0B" }}>par</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, color: "#0A0A0B", lineHeight: 1.05 }}>Your Bitcoin, as a promise.</span>
          <span style={{ fontSize: 32, color: "#5B5F68", marginTop: 24 }}>Guarantees and trade-credit clearing on Mezo, backed by undrawn MUSD capacity.</span>
        </div>
      </div>
    ),
    size,
  )
}

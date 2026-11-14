import { ImageResponse } from "next/og"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M3 15a13 13 0 0 1 26 0z" fill="#0A0A0B" />
          <path d="M3 17h26a13 13 0 0 1-26 0z" fill="#F7931A" />
        </svg>
      </div>
    ),
    size,
  )
}

import type { Metadata, Viewport } from "next"
import "./globals.css"
import { ClientRoot } from "./client-root"

export const metadata: Metadata = {
  title: "Par · Your Bitcoin, as a promise",
  description: "Bitcoin-backed guarantees and trade-credit clearing on Mezo, backed by undrawn MUSD capacity.",
}
export const viewport: Viewport = { themeColor: "#FAFAFA", width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  )
}

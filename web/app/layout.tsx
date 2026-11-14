import type { Metadata, Viewport } from "next"
import "./globals.css"

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://par-rosy.vercel.app"
const DESCRIPTION = "Bitcoin-backed guarantees and trade-credit clearing on Mezo, backed by undrawn MUSD capacity."

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Par · Your Bitcoin, as a promise", template: "%s · Par" },
  description: DESCRIPTION,
  applicationName: "Par",
  openGraph: { type: "website", siteName: "Par", title: "Par · Your Bitcoin, as a promise", description: DESCRIPTION, url: "/" },
  twitter: { card: "summary_large_image", title: "Par · Your Bitcoin, as a promise", description: DESCRIPTION },
}
export const viewport: Viewport = { themeColor: "#FAFAFA", width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

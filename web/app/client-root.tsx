"use client"

import dynamic from "next/dynamic"

// Mezo Passport touches `document` at import time, so the wallet stack renders client-side only.
const Shell = dynamic(() => import("./shell").then((m) => m.Shell), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-btc" />
    </div>
  ),
})

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>
}

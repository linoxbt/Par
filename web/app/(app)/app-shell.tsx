"use client"

import dynamic from "next/dynamic"
import { Header } from "@/components/Header"

// Reown AppKit and Mezo Passport touch `document` at import time, so the wallet stack is client-only.
const Impl = dynamic(() => import("./app-shell-impl").then((m) => m.AppShellImpl), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen flex-col">
      <Header wallet={<span className="inline-block h-9 w-[84px] animate-pulse rounded-full bg-soft" />} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-5 sm:py-12">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-soft" />
        <div className="mt-6 h-40 animate-pulse rounded-2xl bg-soft" />
      </main>
    </div>
  ),
})

export function AppShell({ children }: { children: React.ReactNode }) {
  return <Impl>{children}</Impl>
}

"use client"

import { Providers } from "./providers"
import { Header } from "@/components/Header"

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-ink-400">Par · built on MUSD on Mezo · testnet, unaudited</footer>
    </Providers>
  )
}

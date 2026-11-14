"use client"

import { Providers } from "../providers"
import { Header } from "@/components/Header"
import { WalletButton } from "@/components/Wallet"

export function AppShellImpl({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="flex min-h-screen flex-col">
        <Header wallet={<WalletButton size="sm" align="right" />} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-5 sm:py-12">{children}</main>
      </div>
    </Providers>
  )
}

"use client"

import "@rainbow-me/rainbowkit/styles.css"
import { darkTheme, getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { http, WagmiProvider, type Config } from "wagmi"
import { getConfig, mezoMainnet, mezoTestnet } from "@mezo-org/passport"
import { chain, localChain, NETWORK, RPC_URL, WC_PROJECT_ID } from "@/lib/config"

function makeConfig(): Config {
  if (NETWORK === "local") {
    // Local hardhat node: plain RainbowKit (MetaMask etc.). Passport only knows Mezo networks.
    return getDefaultConfig({
      appName: "Par",
      projectId: WC_PROJECT_ID,
      chains: [localChain],
      transports: { [localChain.id]: http(RPC_URL) },
      ssr: true,
    })
  }
  // Mezo Passport: BTC wallets (Xverse, Unisat, OKX) + EVM wallets. With a BTC wallet,
  // Passport routes transactions through a smart account on Mezo, which becomes the vault owner.
  return getConfig({
    appName: "Par",
    mezoNetwork: NETWORK === "mainnet" ? "mainnet" : "testnet",
    walletConnectProjectId: WC_PROJECT_ID,
    ssr: true,
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [config] = useState(makeConfig)
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }))
  const initialChain = NETWORK === "local" ? chain : NETWORK === "mainnet" ? mezoMainnet : mezoTestnet
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={qc}>
        <RainbowKitProvider initialChain={initialChain} theme={darkTheme({ accentColor: "#F7931A", accentColorForeground: "#0b0c0f" })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

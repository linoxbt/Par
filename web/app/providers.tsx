"use client"

import "@rainbow-me/rainbowkit/styles.css"
import { connectorsForWallets, getDefaultConfig, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, useContext, useState } from "react"
import { http, WagmiProvider, type Config } from "wagmi"
import { createAppKit } from "@reown/appkit/react"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { defineChain as defineAppKitChain } from "@reown/appkit/networks"
import {
  getConfig,
  mezoMainnet,
  mezoTestnet,
  okxWalletMezoMainnet,
  okxWalletMezoTestnet,
  unisatWalletMezoMainnet,
  unisatWalletMezoTestnet,
  xverseWalletMezoMainnet,
  xverseWalletMezoTestnet,
} from "@mezo-org/passport"
import { chain, localChain, NETWORK, REOWN_PROJECT_ID, RPC_URL, WC_PROJECT_ID } from "@/lib/config"

/** "appkit" = Reown AppKit for EVM wallets + Mezo Passport for Bitcoin wallets. "rainbow" = fallback. */
export type WalletMode = "appkit" | "rainbow"
const ModeContext = createContext<WalletMode>("rainbow")
export const useWalletMode = () => useContext(ModeContext)

const mainnet = NETWORK === "mainnet"
const mezoChain = mainnet ? mezoMainnet : mezoTestnet

/** Mezo as an AppKit network (CAIP-2 eip155:<id>). */
const mezoAppKitNetwork = defineAppKitChain({
  id: mezoChain.id,
  caipNetworkId: `eip155:${mezoChain.id}`,
  chainNamespace: "eip155",
  name: mainnet ? "Mezo" : "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: mainnet ? "https://explorer.mezo.org" : "https://explorer.test.mezo.org" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
})

function makeAppKitConfig(): Config {
  // Mezo Passport's Bitcoin wallets (Xverse, Unisat, OKX), routed through a Mezo smart account.
  const bitcoinConnectors = connectorsForWallets(
    [
      {
        groupName: "Bitcoin",
        wallets: mainnet
          ? [xverseWalletMezoMainnet, unisatWalletMezoMainnet, okxWalletMezoMainnet]
          : [xverseWalletMezoTestnet, unisatWalletMezoTestnet, okxWalletMezoTestnet],
      },
    ],
    { appName: "Par", projectId: REOWN_PROJECT_ID! },
  )
  const adapter = new WagmiAdapter({
    networks: [mezoAppKitNetwork],
    projectId: REOWN_PROJECT_ID!,
    ssr: false,
    transports: { [mezoChain.id]: http(RPC_URL) },
    connectors: bitcoinConnectors,
  })
  createAppKit({
    adapters: [adapter],
    networks: [mezoAppKitNetwork],
    defaultNetwork: mezoAppKitNetwork,
    projectId: REOWN_PROJECT_ID!,
    metadata: {
      name: "Par",
      description: "Bitcoin-backed promises on Mezo",
      url: typeof window !== "undefined" ? window.location.origin : "https://par-rosy.vercel.app",
      icons: [typeof window !== "undefined" ? `${window.location.origin}/icon.svg` : "https://par-rosy.vercel.app/icon.svg"],
    },
    features: { analytics: false, email: false, socials: false, swaps: false, onramp: false, send: false, history: false },
    themeMode: "light",
    themeVariables: {
      "--w3m-accent": "#0A0A0B",
      "--w3m-color-mix": "#F7931A",
      "--w3m-color-mix-strength": 4,
      "--w3m-font-family": '"Geist Variable", system-ui, sans-serif',
      "--w3m-border-radius-master": "3px",
    },
  })
  return adapter.wagmiConfig as Config
}

function makeFallbackConfig(): Config {
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
  return getConfig({ appName: "Par", mezoNetwork: mainnet ? "mainnet" : "testnet", walletConnectProjectId: WC_PROJECT_ID, ssr: true })
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mode] = useState<WalletMode>(() => (REOWN_PROJECT_ID && NETWORK !== "local" ? "appkit" : "rainbow"))
  const [config] = useState(() => (mode === "appkit" ? makeAppKitConfig() : makeFallbackConfig()))
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }))
  const initialChain = NETWORK === "local" ? chain : mezoChain
  return (
    <ModeContext.Provider value={mode}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={qc}>
          <RainbowKitProvider initialChain={initialChain} theme={lightTheme({ accentColor: "#0A0A0B", accentColorForeground: "#FFFFFF", borderRadius: "large" })}>
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ModeContext.Provider>
  )
}

"use client"

import "@rainbow-me/rainbowkit/styles.css"
import { connectorsForWallets, getDefaultConfig, lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createContext, useContext, useEffect, useState } from "react"
import { http, WagmiProvider, type Config } from "wagmi"
import { reconnect } from "wagmi/actions"
import { createAppKit } from "@reown/appkit/react"
import { OptionsController } from "@reown/appkit-controllers"
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

const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: () => T): Promise<T> =>
  Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback()), ms))])

/**
 * Mezo Passport's Bitcoin wallets (via OrangeKit), with two fixes:
 * - labelled "(Bitcoin)": Passport names its Bitcoin OKX connector plain "OKX", easily confused with OKX's EVM wallet;
 * - safe on page load: wagmi reconnects by calling every connector's isAuthorized() in turn, and OrangeKit's asks
 *   the extension for its Bitcoin accounts, which can wait forever (a locked or prompting OKX/Unisat/Xverse). One
 *   stuck check left wagmi "reconnecting" with only the saved session, so transactions failed with
 *   "connector.getChainId is not a function". Now a Bitcoin wallet is only re-checked if it was the last one used,
 *   and never for more than a few seconds.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const btcWallet = (w: any) => (opts: any) => {
  const wallet = w(opts)
  return {
    ...wallet,
    name: `${wallet.name} (Bitcoin)`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createConnector: (details: any) => {
      const create = wallet.createConnector(details)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (cfg: any) => {
        const c = create(cfg)
        const isAuthorized = c.isAuthorized
        const connect = c.connect
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.isAuthorized = async function (this: any) {
          const recent = await Promise.resolve(cfg.storage?.getItem("recentConnectorId")).catch(() => null)
          if (recent !== c.id) return false
          return withTimeout(isAuthorized.call(this).catch(() => false), 3000, () => false)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        c.connect = function (this: any, params: any) {
          const p = connect.call(this, params)
          if (!params?.isReconnecting) return p
          return Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error("Bitcoin wallet did not respond")), 8000))])
        }
        return c
      }
    },
  }
}

function makeAppKitConfig(): Config {
  // This AppKit release never forwards `enableBaseAccount` to its options store, so the wagmi adapter
  // would add a Base Account connector whose SDK loads Coinbase telemetry on page load. Set it first.
  OptionsController.setEnableBaseAccount(false)
  // Mezo Passport's Bitcoin wallets (Xverse, Unisat, OKX), routed through a Mezo smart account.
  const bitcoinConnectors = connectorsForWallets(
    [
      {
        groupName: "Bitcoin",
        wallets: mainnet
          ? [xverseWalletMezoMainnet, unisatWalletMezoMainnet, okxWalletMezoMainnet].map(btcWallet)
          : [xverseWalletMezoTestnet, unisatWalletMezoTestnet, okxWalletMezoTestnet].map(btcWallet),
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
    // No Coinbase / Base Account SDKs: they phone home (cca-lite.coinbase.com) and set storage on load.
    enableCoinbase: false,
    enableBaseAccount: false,
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

/**
 * Browser wallets announce themselves (EIP-6963) whenever their extension loads, sometimes after wagmi's
 * reconnect on page load has already given up. When the wallet used last time shows up late and nothing is
 * connected, reconnect to it. Respects an explicit disconnect (the connector's isAuthorized() is false then).
 */
function useReconnectLateWallets(config: Config) {
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = (config as any)._internal
    const seen = new Set<string>(config.connectors.map((c) => c.uid))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return internal.connectors.subscribe((connectors: any[]) => {
      for (const c of connectors) {
        if (seen.has(c.uid)) continue
        seen.add(c.uid)
        Promise.resolve(config.storage?.getItem("recentConnectorId"))
          .then((recent) => {
            if (recent === c.id && config.state.status === "disconnected") reconnect(config, { connectors: [c] }).catch(() => {})
          })
          .catch(() => {})
      }
    })
  }, [config])
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [mode] = useState<WalletMode>(() => (REOWN_PROJECT_ID && NETWORK !== "local" ? "appkit" : "rainbow"))
  const [config] = useState(() => (mode === "appkit" ? makeAppKitConfig() : makeFallbackConfig()))
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }))
  useReconnectLateWallets(config)
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

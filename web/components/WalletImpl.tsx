"use client"

import { useEffect, useRef, useState } from "react"
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi"
import { useConnectModal } from "@rainbow-me/rainbowkit"
import { useAppKit } from "@reown/appkit/react"
import { useWalletMode } from "@/app/providers"
import { addrUrl, chain } from "@/lib/config"
import { short } from "@/lib/format"

const BTC_CONNECTORS = /xverse|unisat|okx.*bitcoin|bitcoin|orangekit/i

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  return { open, setOpen, ref }
}

/** Opens Reown AppKit. Only rendered when AppKit was created (it throws otherwise). */
function AppKitOption({ onPick }: { onPick: () => void }) {
  const { open } = useAppKit()
  return <Option title="Ethereum wallet" sub="MetaMask, Rabby, OKX, or any mobile wallet by QR" tag="Reown" onClick={() => (onPick(), open({ view: "Connect" }))} />
}

function Option({ title, sub, tag, onClick, icon }: { title: string; sub: string; tag: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-soft">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-white text-sm">{icon ?? "◇"}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-medium">
          {title}
          <span className="rounded-full bg-soft px-1.5 py-0.5 text-[10px] font-normal text-muted">{tag}</span>
        </span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </button>
  )
}

export function WalletButton({ size = "md", align = "right" }: { size?: "sm" | "md"; align?: "left" | "right" }) {
  const mode = useWalletMode()
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()
  const { openConnectModal } = useConnectModal()
  const pop = usePopover()
  const [copied, setCopied] = useState(false)
  const btn = size === "sm" ? "px-3.5 py-2 text-sm" : "px-5 py-2.5 text-sm"
  const side = align === "right" ? "right-0" : "left-0"

  if (!isConnected || !address) {
    return (
      <div ref={pop.ref} className="relative">
        <button onClick={() => pop.setOpen((o) => !o)} className={`whitespace-nowrap rounded-full bg-fg font-medium text-white transition hover:bg-black/80 ${btn}`}>
          Connect
        </button>
        {pop.open && (
          <div className={`absolute ${side} top-full z-50 pt-2`}>
            <div className="w-[300px] animate-rise rounded-2xl border border-line bg-white p-2 text-left shadow-float">
              {mode === "appkit" ? (
                <AppKitOption onPick={() => pop.setOpen(false)} />
              ) : (
                <Option title="Ethereum wallet" sub="MetaMask, Rabby, OKX, WalletConnect" tag="RainbowKit" onClick={() => (pop.setOpen(false), openConnectModal?.())} />
              )}
              <Option
                title="Bitcoin wallet"
                sub="Xverse, Unisat or OKX, via a Mezo smart account"
                tag="Mezo Passport"
                icon={<span style={{ fontFamily: "system-ui" }}>₿</span>}
                onClick={() => (pop.setOpen(false), openConnectModal?.())}
              />
              <p className="px-3 pb-2 pt-1 text-[11px] text-subtle">Bitcoin wallets sign through Mezo Passport; your vault is owned by the Mezo account.</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  const wrongChain = chainId !== chain.id
  const isBtc = connector ? BTC_CONNECTORS.test(`${connector.id} ${connector.name}`) : false
  return (
    <div ref={pop.ref} className="relative">
      <button
        onClick={() => pop.setOpen((o) => !o)}
        className={`flex items-center gap-2 whitespace-nowrap rounded-full border font-medium transition ${btn} ${
          wrongChain ? "border-warn/40 bg-warn-wash text-warn" : "border-line bg-white text-fg hover:border-fg"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${wrongChain ? "bg-warn" : isBtc ? "bg-btc" : "bg-ok"}`} />
        <span className="num">{wrongChain ? "Wrong network" : short(address)}</span>
      </button>
      {pop.open && (
        <div className={`absolute ${side} top-full z-50 pt-2`}>
          <div className="w-[280px] animate-rise rounded-2xl border border-line bg-white p-4 text-left shadow-float">
            <div className="text-xs text-muted">
              {connector?.name ?? "Wallet"}
              {isBtc ? " · Mezo Passport" : mode === "appkit" ? " · Reown" : ""}
            </div>
            <div className="num mt-1 break-all text-sm">{address}</div>
            {wrongChain && (
              <button onClick={() => switchChain({ chainId: chain.id })} className="mt-3 w-full rounded-full bg-fg py-2 text-sm font-medium text-white">
                Switch to {chain.name}
              </button>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(address)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1200)
                }}
                className="rounded-full border border-line py-2 hover:border-fg"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a href={addrUrl(address)} target="_blank" rel="noreferrer" className="rounded-full border border-line py-2 text-center hover:border-fg">
                Explorer ↗
              </a>
            </div>
            <button onClick={() => (pop.setOpen(false), disconnect())} className="mt-2 w-full rounded-full py-2 text-sm text-bad hover:bg-bad-wash">
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

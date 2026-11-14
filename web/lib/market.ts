"use client"

import { useEffect, useState } from "react"
import { createPublicClient, http, type Address } from "viem"
import { chain, FACTORY, INTEREST_RATE_MANAGER, MUSD_DEFAULTS, NETWORK, RPC_URL } from "./config"
import { parFactoryAbi } from "./abi"
import { borrowerOpsAbi, interestRateManagerAbi, priceFeedAbi, troveManagerAbi } from "./mezoAbi"

/**
 * Live MUSD market data read straight from the chain with a plain viem client, so marketing pages
 * and the header can show it without loading the wallet stack.
 */
export type Market = {
  price?: bigint
  tcr?: bigint
  recoveryMode?: boolean
  minNetDebt: bigint
  globalRate?: number
  error?: boolean
}

const ZERO = "0x0000000000000000000000000000000000000000"
let client: ReturnType<typeof createPublicClient> | undefined
export const publicClient = () => (client ??= createPublicClient({ chain, transport: http(RPC_URL, { retryCount: 2 }) }))

type Addrs = { priceFeed: Address; troveManager: Address; borrowerOps: Address; irm: Address }
let addrs: Promise<Addrs | undefined> | undefined
function protocolAddrs() {
  addrs ??= (async () => {
    const d = MUSD_DEFAULTS[NETWORK]
    if (FACTORY !== ZERO) {
      try {
        const pc = publicClient()
        const f = { address: FACTORY, abi: parFactoryAbi } as const
        const [priceFeed, troveManager, borrowerOps] = await Promise.all([
          pc.readContract({ ...f, functionName: "priceFeed" }),
          pc.readContract({ ...f, functionName: "troveManager" }),
          pc.readContract({ ...f, functionName: "borrowerOps" }),
        ])
        return { priceFeed, troveManager, borrowerOps, irm: INTEREST_RATE_MANAGER ?? borrowerOps } as Addrs
      } catch {
        /* fall back to the official MUSD addresses */
      }
    }
    if (!d) return undefined
    return { ...d, irm: INTEREST_RATE_MANAGER ?? d.borrowerOps }
  })()
  return addrs
}

const DEFAULT: Market = { minNetDebt: 1800n * 10n ** 18n }
let cache: { at: number; m: Market } | undefined
const listeners = new Set<(m: Market) => void>()
let timer: ReturnType<typeof setInterval> | undefined

async function load(): Promise<Market> {
  const a = await protocolAddrs()
  if (!a) return { ...DEFAULT, error: true }
  const pc = publicClient()
  try {
    const price = await pc.readContract({ address: a.priceFeed, abi: priceFeedAbi, functionName: "fetchPrice" })
    const [tcr, recoveryMode, minNetDebt, globalRate] = await Promise.all([
      pc.readContract({ address: a.troveManager, abi: troveManagerAbi, functionName: "getTCR", args: [price] }).catch(() => undefined),
      pc.readContract({ address: a.troveManager, abi: troveManagerAbi, functionName: "checkRecoveryMode", args: [price] }).catch(() => undefined),
      pc.readContract({ address: a.borrowerOps, abi: borrowerOpsAbi, functionName: "minNetDebt" }).catch(() => undefined),
      pc.readContract({ address: a.irm, abi: interestRateManagerAbi, functionName: "interestRate" }).catch(() => undefined),
    ])
    return {
      price,
      tcr: tcr as bigint | undefined,
      recoveryMode: recoveryMode as boolean | undefined,
      minNetDebt: (minNetDebt as bigint | undefined) ?? DEFAULT.minNetDebt,
      globalRate: globalRate === undefined ? undefined : Number(globalRate),
    }
  } catch {
    return { ...(cache?.m ?? DEFAULT), error: true }
  }
}

async function refresh() {
  const m = await load()
  cache = { at: Date.now(), m }
  listeners.forEach((l) => l(m))
}

/** Shared, polled (20 s) market snapshot. One request loop for the whole page. */
export function useMarket(): Market {
  const [m, setM] = useState<Market>(() => cache?.m ?? DEFAULT)
  useEffect(() => {
    listeners.add(setM)
    if (!cache || Date.now() - cache.at > 15_000) refresh()
    else setM(cache.m)
    timer ??= setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") refresh()
    }, 20_000)
    return () => {
      listeners.delete(setM)
      if (listeners.size === 0 && timer) {
        clearInterval(timer)
        timer = undefined
      }
    }
  }, [])
  return m
}

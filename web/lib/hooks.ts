"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { type Address, type Abi, BaseError, ContractFunctionRevertedError, decodeEventLog, type Log } from "viem"
import {
  useAccount,
  useBalance,
  useBlock,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { parCircuitAbi, parFactoryAbi, parVaultAbi } from "./abi"
import { chain, CIRCUIT, FACTORY, FACTORY_BLOCK, INTEREST_RATE_MANAGER, MUSD_DEFAULTS, NETWORK } from "./config"
import { borrowerOpsAbi, erc20Abi, interestRateManagerAbi, priceFeedAbi, troveManagerAbi } from "./mezoAbi"

const ZERO = "0x0000000000000000000000000000000000000000" as Address

/** Ticking clock (seconds) for countdowns. */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** Chain time: latest block timestamp, advanced locally between blocks (works with hardhat time travel). */
export function useChainNow() {
  const now = useNow()
  const { data: block } = useBlock({ query: { refetchInterval: 4000 } })
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (block) setOffset(Number(block.timestamp) - Math.floor(Date.now() / 1000))
  }, [block])
  return now + offset
}

/** Addresses and risk params from the factory (immutable). */
export function useProtocol() {
  const f = { address: FACTORY, abi: parFactoryAbi } as const
  const { data } = useReadContracts({
    contracts: [
      { ...f, functionName: "musd" },
      { ...f, functionName: "priceFeed" },
      { ...f, functionName: "troveManager" },
      { ...f, functionName: "borrowerOps" },
      { ...f, functionName: "stressBps" },
      { ...f, functionName: "targetIcr" },
    ],
    allowFailure: false,
    query: { staleTime: Infinity, enabled: FACTORY !== ZERO },
  })
  if (!data) {
    // Par not deployed (or not configured): still read live market data from the official MUSD contracts.
    const d = FACTORY === ZERO ? MUSD_DEFAULTS[NETWORK] : undefined
    if (!d) return undefined
    return {
      ...d,
      stressBps: 4000n,
      targetIcr: 1_600_000_000_000_000_000n,
      interestRateManager: INTEREST_RATE_MANAGER ?? d.borrowerOps,
    }
  }
  const [musd, priceFeed, troveManager, borrowerOps, stressBps, targetIcr] = data
  return {
    musd,
    priceFeed,
    troveManager,
    borrowerOps,
    stressBps,
    targetIcr,
    interestRateManager: INTEREST_RATE_MANAGER ?? borrowerOps,
  }
}

/** Market data now comes from a plain viem client (lib/market.ts) shared with the marketing pages. */
export { useMarket } from "./market"

export function useVaultsOf(owner?: Address) {
  const { data: count, refetch } = useReadContract({
    address: FACTORY,
    abi: parFactoryAbi,
    functionName: "vaultCount",
    args: [owner ?? ZERO],
    query: { enabled: !!owner },
  })
  const n = Number(count ?? 0n)
  const { data: vaults, refetch: refetchVaults } = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: FACTORY,
      abi: parFactoryAbi,
      functionName: "vaultsOf" as const,
      args: [owner!, BigInt(i)] as const,
    })),
    allowFailure: false,
    query: { enabled: n > 0 },
  })
  return {
    vaults: (vaults ?? []) as Address[],
    refetch: async () => {
      await refetch()
      await refetchVaults()
    },
  }
}

/**
 * Whether `vault` was created by the Par factory. Anyone can deploy a contract that answers
 * getCommitment() with made-up numbers, so certificate/pay pages must check this before showing
 * any guarantee data. `isVault` is undefined while loading (or if the read failed: see `error`).
 */
export function useIsParVault(vault?: Address) {
  const q = useReadContract({
    address: FACTORY,
    abi: parFactoryAbi,
    functionName: "isVault",
    args: [vault ?? ZERO],
    query: { enabled: !!vault && FACTORY !== ZERO, staleTime: Infinity },
  })
  return { isVault: q.data as boolean | undefined, error: q.error, configured: FACTORY !== ZERO }
}

export type VaultState = ReturnType<typeof useVault>["data"]

export function useVault(vault?: Address) {
  const p = useProtocol()
  const v = { address: vault, abi: parVaultAbi } as const
  const q = useReadContracts({
    contracts: [
      { ...v, functionName: "owner" },
      { ...v, functionName: "reserved" },
      { ...v, functionName: "nextId" },
      { ...v, functionName: "troveState" },
      { ...v, functionName: "health", args: [0n] },
      { address: p?.musd, abi: erc20Abi, functionName: "balanceOf", args: [vault ?? ZERO] },
      { address: p?.troveManager, abi: troveManagerAbi, functionName: "getTroveInterestRate", args: [vault ?? ZERO] },
      { address: p?.troveManager, abi: troveManagerAbi, functionName: "getTroveStatus", args: [vault ?? ZERO] },
    ],
    query: { enabled: !!vault && !!p, refetchInterval: 10_000 },
  })
  const { data: btc, refetch: refetchBtc } = useBalance({ address: vault, query: { enabled: !!vault, refetchInterval: 10_000 } })
  const data = useMemo(() => {
    const r = q.data
    if (!r) return undefined
    const get = <T,>(i: number) => r[i]?.result as T | undefined
    const ts = get<readonly [bigint, bigint, bigint]>(3)
    const h = get<readonly [boolean, bigint, bigint]>(4)
    return {
      owner: get<Address>(0),
      reserved: get<bigint>(1) ?? 0n,
      nextId: get<bigint>(2) ?? 0n,
      coll: ts?.[0] ?? 0n,
      debt: ts?.[1] ?? 0n,
      capacity: ts?.[2] ?? 0n,
      healthOk: h?.[0] ?? false,
      stressedIcr: h?.[1] ?? 0n,
      headroom: h?.[2] ?? 0n,
      buffer: get<bigint>(5) ?? 0n,
      rate: get<number>(6),
      troveActive: get<number>(7) === 1,
      idleBtc: btc?.value ?? 0n,
    }
  }, [q.data, btc])
  return {
    data,
    refetch: async () => {
      await q.refetch()
      await refetchBtc()
    },
  }
}

export type Commitment = {
  id: bigint
  kind: number
  status: number
  beneficiary: Address
  principal: Address
  arbiter: Address
  expiry: bigint
  cap: bigint
  paidOut: bigint
  installment: bigint
  start: bigint
  period: number
  grace: number
  count: number
  challengeWindow: number
}

export const KIND_LABEL = ["Installment guarantee", "Claim bond", "Circuit clearing line"] as const

export function useCommitments(vault?: Address, nextId?: bigint) {
  const n = Number(nextId ?? 0n)
  const q = useReadContracts({
    contracts: Array.from({ length: n }, (_, i) => ({
      address: vault,
      abi: parVaultAbi,
      functionName: "getCommitment" as const,
      args: [BigInt(i)] as const,
    })),
    allowFailure: false,
    query: { enabled: !!vault && n > 0, refetchInterval: 10_000 },
  })
  const list = useMemo(
    () => ((q.data ?? []) as Omit<Commitment, "id">[]).map((c, i) => ({ ...c, id: BigInt(i) }) as Commitment),
    [q.data],
  )
  return { list, refetch: q.refetch }
}

export function useCommitment(vault?: Address, id?: bigint) {
  const q = useReadContract({
    address: vault,
    abi: parVaultAbi,
    functionName: "getCommitment",
    args: [id ?? 0n],
    // a missing vault/commitment reverts deterministically: don't spend ~15 s on retries before saying so
    query: { enabled: !!vault && id !== undefined, refetchInterval: 8_000, retry: 1 },
  })
  return { c: q.data ? ({ ...(q.data as object), id: id! } as Commitment) : undefined, refetch: q.refetch, error: q.error }
}

export type DecodedLog = { eventName: string; args: any; transactionHash: string; blockNumber: bigint }

/**
 * Event logs for one contract since the factory block (light indexer, spec 6.5).
 * Mezo's RPC rejects getLogs ranges over 10,000 blocks, so this scans in chunks and caches per
 * address, then only fetches new blocks on each poll. Each chunk is published as it lands (a long
 * first scan shows history filling in), and a poll is skipped while the previous scan is still
 * running. Errors are surfaced, never swallowed into [].
 */
const LOG_CHUNK = 9_000n
const logCache = new Map<string, { to: bigint; logs: DecodedLog[] }>()

export function useLogs(address: Address | undefined, abi: Abi, refreshKey = 0) {
  const pc = usePublicClient()
  const [state, setState] = useState<{ logs?: DecodedLog[]; error?: string }>(() =>
    address ? { logs: logCache.get(address.toLowerCase())?.logs } : {},
  )
  useEffect(() => {
    if (!pc || !address) return
    let dead = false
    let running = false
    const key = address.toLowerCase()
    const cachedNow = logCache.get(key)
    setState(cachedNow ? { logs: cachedNow.logs } : {})
    const load = async () => {
      if (running) return // previous scan still in flight: don't start a second, overlapping one
      running = true
      try {
        const head = await pc.getBlockNumber()
        const cached = logCache.get(key)
        let from = cached ? cached.to + 1n : FACTORY_BLOCK
        const out = cached ? [...cached.logs] : []
        while (from <= head && !dead) {
          const to = from + LOG_CHUNK - 1n < head ? from + LOG_CHUNK - 1n : head
          const raw: Log[] = await pc.getLogs({ address, fromBlock: from, toBlock: to })
          const before = out.length
          for (const l of raw) {
            try {
              const d = decodeEventLog({ abi, data: l.data, topics: l.topics }) as any
              out.push({ eventName: d.eventName, args: d.args, transactionHash: l.transactionHash!, blockNumber: l.blockNumber! })
            } catch {
              /* event from another ABI version: skip */
            }
          }
          const snapshot = out.slice()
          logCache.set(key, { to, logs: snapshot })
          from = to + 1n
          // partial results: publish each chunk that added logs; the final chunk is published below
          if (!dead && out.length > before && from <= head) setState({ logs: snapshot })
        }
        if (!dead) setState({ logs: out.slice() })
      } catch (e) {
        if (!dead) setState((s) => ({ logs: s.logs, error: (e as Error)?.message?.split("\n")[0] ?? "Couldn't load history" }))
      } finally {
        running = false
      }
    }
    load()
    const t = setInterval(load, 10_000)
    return () => {
      dead = true
      clearInterval(t)
    }
  }, [pc, address, abi, refreshKey])
  return state
}

/** Human-readable revert reason. */
export function errorText(e: unknown): string {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError)
    if (r instanceof ContractFunctionRevertedError) {
      const name = r.data?.errorName
      const args = r.data?.args
      const map: Record<string, string> = {
        Unhealthy: "Doesn't fit: the vault would fail the stress test or exceed its capacity.",
        RecoveryModeNeedsReserve: "Mezo is in Recovery Mode: the vault needs idle BTC to draw.",
        ReservedCommitments: "Close or let all commitments expire first.",
        OverLimit: "This would push the debtor over their clearing line.",
        NotOwner: "Only the vault owner can do this.",
        NotAuthorized: "Your address can't do this.",
        TooEarly: "Too early.",
        TooLate: "Too late.",
        AlreadySettled: "Already settled.",
        NotActive: "Not active.",
        NotYet: "Not yet.",
        Done: "Nothing to do.",
        WrongCycle: "This invoice belongs to a closed cycle; re-issue it.",
        BadParams: "Invalid parameters.",
        ClaimOpen: "A claim is open on this commitment; it has to be paid or resolved first.",
        ReserveLocked: "Mezo is in Recovery Mode: the BTC reserve stays in the vault while promises are live.",
        LineOwed: "The circuit is still owed on this line; it can be closed once that debt is paid.",
        Suspended: "This member is suspended in the circle: no new invoices to or from them.",
        LineInUse: "That clearing line already backs a circle membership.",
        HasObligations: "This member still owes or is owed in an open cycle.",
        LineExpiresTooSoon: "The clearing line expires before this cycle's settlement deadline; pledge a longer line.",
        NotParVault: "That address isn't a Par vault.",
        NotInvited: "There's no matching invite for this vault and line.",
        NotMember: "Not a member of this circle.",
        NotAdmin: "Only the circle admin can do this.",
        NotVault: "Only Par vaults can do this.",
      }
      if (name) {
        // Show error arguments in human units, never as raw wei or Unix timestamps.
        const a = (args ?? []) as unknown[]
        const musd = (v: unknown) => `${(Number(v as bigint) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 2 })} MUSD`
        const when = (v: unknown) => new Date(Number(v as bigint) * 1000).toLocaleString()
        const extra =
          name === "RecoveryModeNeedsReserve" && a[0] !== undefined
            ? ` Needed: ${(Number(a[0] as bigint) / 1e18).toFixed(6)} BTC.`
            : name === "OverLimit" && a.length === 2
              ? ` Line available ${musd(a[0])}, would owe ${musd(a[1])}.`
              : name === "LineExpiresTooSoon" && a.length === 2
                ? ` It expires ${when(a[0])}; it must last until at least ${when(a[1])}.`
                : ""
        return (map[name] ?? name) + extra
      }
      if (r.reason) return r.reason
    }
    return e.shortMessage
  }
  return (e as Error)?.message ?? String(e)
}

/**
 * Simulate, then writeContract pinned to the app chain, then wait for the receipt.
 * - Simulation runs eth_call, which returns revert data on Mezo (eth_estimateGas does not), so
 *   custom errors decode into readable messages before the wallet even opens.
 * - If the wallet is on another chain it is asked to switch first; writes never go to another chain.
 * - A second send while one is in flight is ignored.
 */
export function useTx(onDone?: (receipt: any) => void) {
  const { writeContractAsync, isPending, reset } = useWriteContract()
  const { address, chainId: walletChain } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const pc = usePublicClient({ chainId: chain.id })
  const [hash, setHash] = useState<`0x${string}`>()
  const [error, setError] = useState<string>()
  const [preparing, setPreparing] = useState(false)
  const inflight = useRef(false)
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chain.id })
  useEffect(() => {
    if (receipt.data) onDone?.(receipt.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.data])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = async (args: any) => {
    if (inflight.current) return
    inflight.current = true
    setError(undefined)
    setHash(undefined)
    setPreparing(true)
    try {
      if (!address) throw new Error("Connect a wallet first.")
      if (walletChain !== chain.id) {
        try {
          await switchChainAsync({ chainId: chain.id })
        } catch {
          throw new Error(`Switch your wallet to ${chain.name} to continue.`)
        }
      }
      if (pc) await pc.simulateContract({ ...args, account: address })
      const h = await writeContractAsync({ ...args, chainId: chain.id })
      setHash(h)
      return h
    } catch (e) {
      setError(errorText(e))
      reset()
    } finally {
      setPreparing(false)
      inflight.current = false
    }
  }
  return {
    send,
    hash,
    error: error ?? (receipt.error ? errorText(receipt.error) : undefined),
    busy: preparing || isPending || (!!hash && receipt.isLoading),
    done: receipt.isSuccess,
    receipt: receipt.data,
  }
}

export function useMe() {
  const { address, isConnected } = useAccount()
  return { me: address, isConnected }
}

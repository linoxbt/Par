"use client"

import { useEffect, useMemo, useState } from "react"
import { type Address, type Abi, BaseError, ContractFunctionRevertedError, decodeEventLog, type Log } from "viem"
import {
  useAccount,
  useBalance,
  useBlock,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi"
import { parCircuitAbi, parFactoryAbi, parVaultAbi } from "./abi"
import { CIRCUIT, FACTORY, FACTORY_BLOCK, INTEREST_RATE_MANAGER, NETWORK } from "./config"
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
  const { data: block } = useBlock({ watch: true, query: { refetchInterval: 4000 } })
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
  if (!data) return undefined
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

export function useMarket() {
  const p = useProtocol()
  const { data: price } = useReadContract({
    address: p?.priceFeed,
    abi: priceFeedAbi,
    functionName: "fetchPrice",
    query: { enabled: !!p, refetchInterval: 15_000 },
  })
  const { data } = useReadContracts({
    contracts: [
      { address: p?.troveManager, abi: troveManagerAbi, functionName: "getTCR", args: [price ?? 0n] },
      { address: p?.troveManager, abi: troveManagerAbi, functionName: "checkRecoveryMode", args: [price ?? 0n] },
      { address: p?.borrowerOps, abi: borrowerOpsAbi, functionName: "minNetDebt" },
      { address: p?.interestRateManager, abi: interestRateManagerAbi, functionName: "interestRate" },
    ],
    query: { enabled: !!p && price !== undefined, refetchInterval: 30_000 },
  })
  return {
    price,
    tcr: data?.[0]?.result as bigint | undefined,
    recoveryMode: data?.[1]?.result as boolean | undefined,
    minNetDebt: (data?.[2]?.result as bigint | undefined) ?? 1800n * 10n ** 18n,
    globalRate: data?.[3]?.result as number | undefined,
  }
}

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

export const KIND = ["Scheduled", "Claim", "ClearingLine"] as const
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
    query: { enabled: !!vault && id !== undefined, refetchInterval: 8_000 },
  })
  return { c: q.data ? ({ ...(q.data as object), id: id! } as Commitment) : undefined, refetch: q.refetch, error: q.error }
}

/** Event logs for one contract since the factory block (light indexer, spec 6.5). */
export function useLogs(address: Address | undefined, abi: Abi, refreshKey = 0) {
  const pc = usePublicClient()
  const [logs, setLogs] = useState<{ eventName: string; args: any; transactionHash: string; blockNumber: bigint }[]>()
  useEffect(() => {
    if (!pc || !address) return
    let dead = false
    const load = async () => {
      try {
        const raw: Log[] = await pc.getLogs({ address, fromBlock: FACTORY_BLOCK, toBlock: "latest" })
        const out = []
        for (const l of raw) {
          try {
            const d = decodeEventLog({ abi, data: l.data, topics: l.topics }) as any
            out.push({ eventName: d.eventName, args: d.args, transactionHash: l.transactionHash!, blockNumber: l.blockNumber! })
          } catch {}
        }
        if (!dead) setLogs(out)
      } catch {
        if (!dead) setLogs([])
      }
    }
    load()
    const t = setInterval(load, 10_000)
    return () => {
      dead = true
      clearInterval(t)
    }
  }, [pc, address, abi, refreshKey])
  return logs
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
      }
      if (name) return (map[name] ?? name) + (args?.length ? ` (${args.map(String).join(", ")})` : "")
      if (r.reason) return r.reason
    }
    return e.shortMessage
  }
  return (e as Error)?.message ?? String(e)
}

/** writeContract + wait for receipt, with status. */
export function useTx(onDone?: (receipt: any) => void) {
  const { writeContractAsync, isPending, reset } = useWriteContract()
  const [hash, setHash] = useState<`0x${string}`>()
  const [error, setError] = useState<string>()
  const receipt = useWaitForTransactionReceipt({ hash })
  useEffect(() => {
    if (receipt.data) onDone?.(receipt.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.data])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const send = async (args: any) => {
    setError(undefined)
    setHash(undefined)
    try {
      const h = await writeContractAsync(args)
      setHash(h)
      return h
    } catch (e) {
      setError(errorText(e))
      reset()
    }
  }
  return {
    send,
    hash,
    error: error ?? (receipt.error ? errorText(receipt.error) : undefined),
    busy: isPending || (!!hash && receipt.isLoading),
    done: receipt.isSuccess,
    receipt: receipt.data,
  }
}

export function useMe() {
  const { address, isConnected } = useAccount()
  return { me: address, isConnected }
}

export function useCircuit() {
  return { address: CIRCUIT, abi: parCircuitAbi } as const
}

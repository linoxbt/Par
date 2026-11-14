// Par keeper: permissionless jobs that make Par promises self-executing.
//
//   1. Missed installments  -> vault.triggerMissed(id, i, up, lo)
//   2. Undisputed claims    -> vault.executeClaim(id, up, lo)
//   3. Circuit defaulters   -> circuit.forceSettle(circle, cycle, debtor, up, lo)
//   4. Health watch         -> alert the owner when health(0).ok == false
//   5. Recovery Mode        -> decode RecoveryModeNeedsReserve(b), alert with b, retry next tick
//
// Every call is simulated first, so a job that is not due (or already done by someone else)
// costs nothing. Uses chain time (latest block timestamp), not wall-clock time.
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  defineChain,
  formatEther,
  http,
  parseAbi,
  type Address,
  type Chain,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { mezoTestnet } from "viem/chains"
import { parCircuitAbi, parFactoryAbi, parVaultAbi } from "./abi.js"

// ------------------------------------------------------------------ config

const env = (k: string, d?: string) => {
  const v = process.env[k] ?? d
  if (v === undefined || v === "") throw new Error(`missing env ${k}`)
  return v
}
const opt = (k: string) => (process.env[k] ? (process.env[k] as Address) : undefined)

const CHAIN = process.env.CHAIN ?? "testnet"
const mezoMainnet = defineChain({
  id: 31612,
  name: "Mezo",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc-http.mezo.boar.network"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.mezo.org" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
})
const local = defineChain({
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
})
const chain: Chain = CHAIN === "mainnet" ? mezoMainnet : CHAIN === "local" ? local : mezoTestnet

const OFFICIAL_HINTS: Record<string, { tm: Address; hh: Address; st: Address } | undefined> = {
  testnet: {
    tm: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
    hh: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
    st: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  },
  mainnet: {
    tm: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
    hh: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3",
    st: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
  },
}
const hintCfg = {
  tm: opt("TROVE_MANAGER") ?? OFFICIAL_HINTS[CHAIN]?.tm,
  hh: opt("HINT_HELPERS") ?? OFFICIAL_HINTS[CHAIN]?.hh,
  st: opt("SORTED_TROVES") ?? OFFICIAL_HINTS[CHAIN]?.st,
}

const FACTORY = env("FACTORY") as Address
const CIRCUIT = opt("CIRCUIT")
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 15_000)
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL
const ONCE = process.argv.includes("--once")

const transport = http(process.env.RPC_URL ?? chain.rpcUrls.default.http[0])
const pc = createPublicClient({ chain, transport })
const account = privateKeyToAccount(env("KEEPER_KEY") as `0x${string}`)
const wc = createWalletClient({ chain, transport, account })

const ZERO = "0x0000000000000000000000000000000000000000" as Address
const Kind = { Scheduled: 0, Claim: 1, ClearingLine: 2 } as const
const CStatus = { None: 0, Active: 1, Closed: 2 } as const

// ------------------------------------------------------------------ hints (spec 6.3)

const tmAbi = parseAbi([
  "function getTroveOwnersCount() view returns (uint256)",
  "function getEntireDebtAndColl(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
])
const hhAbi = parseAbi(["function getApproxHint(uint256,uint256,uint256) view returns (address,uint256,uint256)"])
const stAbi = parseAbi(["function findInsertPosition(uint256,address,address) view returns (address,address)"])

/** Hints for a draw of `amount` from `vault`'s trove. Falls back to zero hints on any failure. */
async function hintsForDraw(vault: Address, amount: bigint): Promise<{ upper: Address; lower: Address }> {
  if (!hintCfg.tm || !hintCfg.hh || !hintCfg.st) return { upper: ZERO, lower: ZERO }
  try {
    const [coll, principal, , pendingColl, pendingPrincipal] = await pc.readContract({
      address: hintCfg.tm,
      abi: tmAbi,
      functionName: "getEntireDebtAndColl",
      args: [vault],
    })
    const fee = amount / 1000n // 0.1% borrowing fee (slightly off is fine; hints are only a starting point)
    const nicr = ((coll + pendingColl) * 10n ** 20n) / (principal + pendingPrincipal + amount + fee)
    const n = await pc.readContract({ address: hintCfg.tm, abi: tmAbi, functionName: "getTroveOwnersCount" })
    const trials = BigInt(Math.max(1, Math.ceil(15 * Math.sqrt(Number(n)))))
    const [approx] = await pc.readContract({
      address: hintCfg.hh,
      abi: hhAbi,
      functionName: "getApproxHint",
      args: [nicr, trials, 42n],
    })
    const [upper, lower] = await pc.readContract({
      address: hintCfg.st,
      abi: stAbi,
      functionName: "findInsertPosition",
      args: [nicr, approx, approx],
    })
    return { upper, lower }
  } catch {
    return { upper: ZERO, lower: ZERO }
  }
}

// ------------------------------------------------------------------ helpers

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a)

async function alert(kind: string, data: Record<string, unknown>) {
  log(`ALERT ${kind}`, JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v)))
  if (!ALERT_WEBHOOK_URL) return
  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, ...data }, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
    })
  } catch (e) {
    log("alert webhook failed", (e as Error).message)
  }
}

/** Decodes a revert into { name, args } when it is a custom error from our ABIs. */
function decodeRevert(e: unknown): { name: string; args: readonly unknown[] } | undefined {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError)
    if (r instanceof ContractFunctionRevertedError && r.data?.errorName) {
      return { name: r.data.errorName, args: r.data.args ?? [] }
    }
  }
  return undefined
}

/** Simulate, then send and wait. Returns true when a tx was mined successfully. */
async function execute(label: string, req: Parameters<typeof pc.simulateContract>[0]): Promise<boolean> {
  try {
    const { request } = await pc.simulateContract({ ...req, account } as any)
    const hash = await wc.writeContract(request as any)
    const rc = await pc.waitForTransactionReceipt({ hash })
    const url = chain.blockExplorers?.default.url
    log(`${label} -> ${rc.status} ${url ? `${url}/tx/${hash}` : hash}`)
    return rc.status === "success"
  } catch (e) {
    const err = decodeRevert(e)
    if (err?.name === "RecoveryModeNeedsReserve") {
      await alert("recovery-mode-needs-reserve", {
        job: label,
        vault: req.address,
        btcNeeded: formatEther(err.args[0] as bigint),
      })
    } else if (err) {
      log(`${label} skipped: ${err.name}`)
    } else {
      log(`${label} failed: ${(e as Error).message.split("\n")[0]}`)
    }
    return false
  }
}

// ------------------------------------------------------------------ discovery

async function listVaults(): Promise<Address[]> {
  const n = await pc.readContract({ address: FACTORY, abi: parFactoryAbi, functionName: "allVaultsLength" })
  const calls = Array.from({ length: Number(n) }, (_, i) => ({
    address: FACTORY,
    abi: parFactoryAbi,
    functionName: "allVaults" as const,
    args: [BigInt(i)] as const,
  }))
  return readMany<Address>(calls)
}

/** Multicall when the chain has Multicall3, sequential reads otherwise (local hardhat). */
async function readMany<T>(calls: any[]): Promise<T[]> {
  if (calls.length === 0) return []
  if (chain.contracts?.multicall3) {
    const res = await pc.multicall({ contracts: calls, allowFailure: false })
    return res as T[]
  }
  const out: T[] = []
  for (const c of calls) out.push((await pc.readContract(c)) as T)
  return out
}

type Commitment = {
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

// ------------------------------------------------------------------ jobs

// Commitments already known closed never need re-reading.
const closed = new Set<string>()

async function vaultJobs(vault: Address, now: bigint) {
  const nextId = await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "nextId" })
  const ids = Array.from({ length: Number(nextId) }, (_, i) => BigInt(i)).filter((id) => !closed.has(`${vault}:${id}`))
  const cs = await readMany<Commitment>(
    ids.map((id) => ({ address: vault, abi: parVaultAbi, functionName: "getCommitment", args: [id] })),
  )

  let anyActive = false
  for (let k = 0; k < ids.length; k++) {
    const id = ids[k]
    const c = cs[k]
    if (c.status !== CStatus.Active) {
      closed.add(`${vault}:${id}`)
      continue
    }
    anyActive = true

    if (c.kind === Kind.Scheduled) {
      if (now > c.expiry) continue
      let paidOut = c.paidOut
      for (let i = 0; i < c.count; i++) {
        if (paidOut >= c.cap) break // cover exhausted: the commitment closed itself
        const due = c.start + BigInt(i) * BigInt(c.period)
        if (now <= due + BigInt(c.grace)) break // later indices are not due either
        const settled = await pc.readContract({
          address: vault,
          abi: parVaultAbi,
          functionName: "installmentSettled",
          args: [id, BigInt(i)],
        })
        if (settled) continue
        const { upper, lower } = await hintsForDraw(vault, c.installment)
        const ok = await execute(`triggerMissed ${vault}#${id}[${i}]`, {
          address: vault,
          abi: parVaultAbi,
          functionName: "triggerMissed",
          args: [id, BigInt(i), upper, lower],
        } as any)
        if (ok) paidOut += c.installment < c.cap - paidOut ? c.installment : c.cap - paidOut
      }
    }

    if (c.kind === Kind.Claim) {
      const [amount, filedAt, disputed, open] = await pc.readContract({
        address: vault,
        abi: parVaultAbi,
        functionName: "pendingClaims",
        args: [id],
      })
      if (open && !disputed && now > filedAt + BigInt(c.challengeWindow)) {
        const { upper, lower } = await hintsForDraw(vault, amount)
        await execute(`executeClaim ${vault}#${id}`, {
          address: vault,
          abi: parVaultAbi,
          functionName: "executeClaim",
          args: [id, upper, lower],
        } as any)
      }
    }
  }

  // Health watch: only meaningful while something is reserved.
  if (anyActive) {
    try {
      const [ok, stressedIcr] = await pc.readContract({
        address: vault,
        abi: parVaultAbi,
        functionName: "health",
        args: [0n],
      })
      if (!ok) {
        const owner = await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "owner" })
        await alert("under-reserved", { vault, owner, stressedIcr: formatEther(stressedIcr) })
      }
    } catch (e) {
      log(`health(${vault}) failed: ${(e as Error).message.split("\n")[0]}`)
    }
  }
}

// circleId -> first cycle that may still have unsettled debtors
const circleCursor = new Map<bigint, bigint>()

async function circuitJobs(now: bigint) {
  if (!CIRCUIT) return
  const n = await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "nextCircleId" })
  for (let cid = 0n; cid < n; cid++) {
    const [, , , settleWindow] = await pc.readContract({
      address: CIRCUIT,
      abi: parCircuitAbi,
      functionName: "circles",
      args: [cid],
    })
    const members = await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "members_", args: [cid] })
    const current = await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "currentCycle", args: [cid] })
    let cyc = circleCursor.get(cid) ?? 0n
    for (; cyc < current; cyc++) {
      const close = await pc.readContract({
        address: CIRCUIT,
        abi: parCircuitAbi,
        functionName: "cycleClose",
        args: [cid, cyc],
      })
      if (now < close + settleWindow) break // window still open: debtors may settle themselves
      let allDone = true
      for (const m of members) {
        const [net, settled] = await Promise.all([
          pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "net", args: [cid, cyc, m] }),
          pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "settled", args: [cid, cyc, m] }),
        ])
        if (net >= 0n || settled) continue
        const [vault] = await pc.readContract({
          address: CIRCUIT,
          abi: parCircuitAbi,
          functionName: "members",
          args: [cid, m],
        })
        const { upper, lower } = await hintsForDraw(vault, -net)
        const ok = await execute(`forceSettle circle ${cid} cycle ${cyc} debtor ${m} (${formatEther(-net)} MUSD)`, {
          address: CIRCUIT,
          abi: parCircuitAbi,
          functionName: "forceSettle",
          args: [cid, cyc, m, upper, lower],
        } as any)
        if (!ok) allDone = false
      }
      if (!allDone) break // retry this cycle next tick
    }
    circleCursor.set(cid, cyc)
  }
}

// ------------------------------------------------------------------ loop

let running = false
async function tick() {
  if (running) return
  running = true
  try {
    const block = await pc.getBlock()
    const now = block.timestamp
    const vaults = await listVaults()
    for (const v of vaults) {
      try {
        await vaultJobs(v, now)
      } catch (e) {
        log(`vault ${v} failed: ${(e as Error).message.split("\n")[0]}`)
      }
    }
    await circuitJobs(now)
  } catch (e) {
    log(`tick failed: ${(e as Error).message.split("\n")[0]}`)
  } finally {
    running = false
  }
}

log(`Par keeper on ${chain.name} (${chain.id}) as ${account.address}; factory ${FACTORY}; circuit ${CIRCUIT ?? "-"}`)
const bal = await pc.getBalance({ address: account.address })
log(`keeper balance ${formatEther(bal)} BTC`)
await tick()
if (!ONCE) setInterval(tick, INTERVAL_MS)

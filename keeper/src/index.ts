// Par keeper: permissionless jobs that make Par promises self-executing.
//
//   1. Missed installments  -> vault.triggerMissed(id, i, up, lo)
//   2. Undisputed claims    -> vault.executeClaim(id, up, lo)
//   3. Circuit defaulters   -> circuit.forceSettle(circle, cycle, debtor, up, lo)
//   4. Health watch         -> alert the owner when health(0).ok == false
//   5. Recovery Mode        -> decode RecoveryModeNeedsReserve(b), alert with b, retry next tick
//
//   6. Expired commitments  -> vault.closeCommitment(id) to free reserved capacity (AUTO_CLOSE_EXPIRED)
//
// Every call is simulated first, so a job that is not due (or already done by someone else)
// costs nothing. Uses chain time (latest block timestamp), not wall-clock time.
// Alerts are deduplicated (sent on state change, then at most once per ALERT_COOLDOWN_MS) and go
// to the log plus, when configured, Telegram and/or a JSON webhook.
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  decodeErrorResult,
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
const num = (k: string, d: number, min = 0) => {
  const v = Number(process.env[k])
  return Number.isFinite(v) && v >= min ? v : d
}
const INTERVAL_MS = num("INTERVAL_MS", 15_000, 1_000)
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const ALERT_COOLDOWN_MS = num("ALERT_COOLDOWN_MS", 30 * 60_000)
const LOW_BALANCE_BTC = num("LOW_BALANCE_BTC", 0.005)
const HEARTBEAT_MS = num("HEARTBEAT_MS", 5 * 60_000, 10_000)
const TICK_TIMEOUT_MS = num("TICK_TIMEOUT_MS", 10 * 60_000, 30_000)
const MAX_RETRIES = num("MAX_RETRIES", 40, 1)
const AUTO_CLOSE_EXPIRED = (process.env.AUTO_CLOSE_EXPIRED ?? "true") !== "false"
const ONCE = process.argv.includes("--once")

const transport = http(process.env.RPC_URL ?? chain.rpcUrls.default.http[0], { timeout: 20_000, retryCount: 3 })
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

let borrowerOps: Address | undefined
const boAbi = parseAbi(["function getBorrowingFee(uint256) view returns (uint256)"])
async function borrowingFee(amount: bigint): Promise<bigint> {
  try {
    borrowerOps ??= (await pc.readContract({ address: FACTORY, abi: parFactoryAbi, functionName: "borrowerOps" })) as Address
    return await pc.readContract({ address: borrowerOps, abi: boAbi, functionName: "getBorrowingFee", args: [amount] })
  } catch {
    return amount / 1000n // MUSD's 0.1% fee; hints are only a starting point
  }
}

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
    const fee = await borrowingFee(amount)
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

const json = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v))

// key -> last time sent; a key is a condition (e.g. "under-reserved:<vault>")
const alertSent = new Map<string, number>()

/**
 * Raise (or keep raising) an alert for a condition. Sent when it first appears, then at most once
 * per ALERT_COOLDOWN_MS while it persists. `clear(key)` marks it resolved so the next occurrence
 * alerts immediately.
 */
async function alert(key: string, kind: string, data: Record<string, unknown>) {
  const last = alertSent.get(key)
  if (last !== undefined && Date.now() - last < ALERT_COOLDOWN_MS) return
  alertSent.set(key, Date.now())
  log(`ALERT ${kind}`, json(data))
  const text = `Par keeper · ${kind}\n` + Object.entries(data).map(([k, v]) => `${k}: ${typeof v === "bigint" ? v.toString() : String(v)}`).join("\n")
  const sends: Promise<unknown>[] = []
  if (ALERT_WEBHOOK_URL)
    sends.push(
      fetch(ALERT_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: json({ kind, ...data, text }), signal: AbortSignal.timeout(8_000) }),
    )
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID)
    sends.push(
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: json({ chat_id: TELEGRAM_CHAT_ID, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(8_000),
      }),
    )
  for (const r of await Promise.allSettled(sends)) if (r.status === "rejected") log("alert delivery failed", (r.reason as Error)?.message)
}
function clear(key: string, kind?: string, data?: Record<string, unknown>) {
  if (alertSent.delete(key) && kind) log(`RESOLVED ${kind}`, json(data ?? {}))
}

// All Par ABIs: errors bubbling up from a vault through ParCircuit.forceSettle must decode too.
const allAbis = [...parVaultAbi, ...parCircuitAbi, ...parFactoryAbi] as const

/** Decodes a revert into { name, args } when it is a custom error from any Par ABI. */
function decodeRevert(e: unknown): { name: string; args: readonly unknown[] } | undefined {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError)
    if (r instanceof ContractFunctionRevertedError) {
      if (r.data?.errorName) return { name: r.data.errorName, args: r.data.args ?? [] }
      // Raw data from a nested call: try every Par ABI.
      const raw = (r as any).raw as `0x${string}` | undefined
      if (raw && raw.length >= 10) {
        try {
          const d = decodeErrorResult({ abi: allAbis as any, data: raw })
          return { name: d.errorName, args: (d.args ?? []) as readonly unknown[] }
        } catch {
          /* unknown error */
        }
      }
    }
  }
  return undefined
}

// label -> tx hash still waiting to be mined (prevents re-sending after a receipt timeout)
const pending = new Map<string, { hash: `0x${string}`; at: number }>()
const DROPPED_AFTER_MS = 10 * 60_000
// after MAX_RETRIES consecutive failures a job backs off to one attempt every BACKOFF_TICKS ticks
// (it never gives up: a Recovery Mode reserve may be funded hours later)
const BACKOFF_TICKS = 20
// label -> consecutive failures
const failures = new Map<string, number>()

type Ctx = { vault: Address; owner?: Address }

/** Simulate, then send and wait. Returns true when a tx was mined successfully. */
async function execute(label: string, req: Parameters<typeof pc.simulateContract>[0], ctx: Ctx): Promise<boolean> {
  const prev = pending.get(label)
  if (prev) {
    const rc = await pc.getTransactionReceipt({ hash: prev.hash }).catch(() => undefined)
    if (!rc) {
      // still in flight: don't double-submit, unless the node no longer knows the tx (dropped)
      if (Date.now() - prev.at < DROPPED_AFTER_MS) return false
      const tx = await pc.getTransaction({ hash: prev.hash }).catch(() => undefined)
      if (tx) return false
      log(`${label}: tx ${prev.hash} was dropped; retrying`)
      pending.delete(label)
    } else {
      pending.delete(label)
      if (rc.status === "success") return true
    }
  }
  const fails = failures.get(label) ?? 0
  if (fails >= MAX_RETRIES && ticks % BACKOFF_TICKS !== 0) return false
  try {
    const { request } = await pc.simulateContract({ ...req, account } as any)
    const hash = await wc.writeContract(request as any)
    pending.set(label, { hash, at: Date.now() })
    const rc = await pc.waitForTransactionReceipt({ hash, timeout: 120_000 })
    pending.delete(label)
    const url = chain.blockExplorers?.default.url
    log(`${label} -> ${rc.status} ${url ? `${url}/tx/${hash}` : hash}`)
    if (rc.status === "success") failures.delete(label)
    return rc.status === "success"
  } catch (e) {
    if ((e as Error)?.name === "WaitForTransactionReceiptTimeoutError") {
      log(`${label} still pending; will check its receipt next tick`)
      return false
    }
    pending.delete(label)
    const n = (failures.get(label) ?? 0) + 1
    failures.set(label, n)
    const err = decodeRevert(e)
    if (err?.name === "RecoveryModeNeedsReserve") {
      const owner = ctx.owner ?? (await ownerOf(ctx.vault))
      await alert(`recovery:${ctx.vault}`, "recovery-mode-needs-reserve", {
        job: label,
        vault: ctx.vault,
        owner,
        btcNeeded: formatEther(err.args[0] as bigint),
        action: "Send the BTC to the vault as idle reserve; the keeper keeps retrying (backing off after repeated failures).",
      })
    } else if (err) {
      log(`${label} skipped: ${err.name}${err.args.length ? ` (${err.args.map(String).join(", ")})` : ""}`)
    } else {
      log(`${label} failed: ${(e as Error).message.split("\n")[0]}`)
    }
    if (n === MAX_RETRIES) await alert(`stuck:${label}`, "job-keeps-failing", { job: label, attempts: n, lastError: err?.name ?? (e as Error).message.split("\n")[0] })
    return false
  }
}

async function ownerOf(vault: Address): Promise<Address | undefined> {
  return pc.readContract({ address: vault, abi: parVaultAbi, functionName: "owner" }).catch(() => undefined) as Promise<Address | undefined>
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

// Commitments already known closed never need re-reading; installments known settled likewise.
const closed = new Set<string>()
const settledIdx = new Set<string>()
// vaults whose trove is inactive (liquidated/redeemed/closed): alerted once
const deadTrove = new Set<string>()

async function vaultJobs(vault: Address, now: bigint) {
  const nextId = await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "nextId" })
  const ids = Array.from({ length: Number(nextId) }, (_, i) => BigInt(i)).filter((id) => !closed.has(`${vault}:${id}`))
  const cs = await readMany<Commitment>(ids.map((id) => ({ address: vault, abi: parVaultAbi, functionName: "getCommitment", args: [id] })))

  let anyActive = false
  for (let k = 0; k < ids.length; k++) {
    const id = ids[k]
    const c = cs[k]
    if (c.status !== CStatus.Active) {
      closed.add(`${vault}:${id}`)
      continue
    }
    anyActive = true

    // Claims first: executeClaim has no expiry check, so a claim filed near expiry (or a dispute
    // whose 7-day arbiter deadline runs past it) must still be paid.
    let claimOpen = false
    if (c.kind === Kind.Claim) {
      const p = await pendingClaim(vault, id)
      claimOpen = p.open
      resolveWindow ??= await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "RESOLVE_WINDOW" }).catch(() => 7n * 86400n)
      const undisputedDue = !p.disputed && now > p.filedAt + BigInt(c.challengeWindow)
      // An arbiter who doesn't decide within RESOLVE_WINDOW forfeits: anyone can execute (default: pay).
      const arbiterLapsed = p.disputed && p.disputedAt > 0n && now > p.disputedAt + resolveWindow
      if (p.open && (undisputedDue || arbiterLapsed)) {
        const { upper, lower } = await hintsForDraw(vault, p.amount)
        await execute(`executeClaim ${vault}#${id}`, { address: vault, abi: parVaultAbi, functionName: "executeClaim", args: [id, upper, lower] } as any, { vault })
      }
    }

    if (now > c.expiry) {
      // Past expiry nothing new can be triggered. Free the reserved capacity (permissionless), unless
      // a claim is still open or the circuit is still owed on a clearing line (the vault refuses both).
      if (AUTO_CLOSE_EXPIRED && !claimOpen) {
        let owed = 0n
        if (c.kind === Kind.ClearingLine && CIRCUIT && c.beneficiary.toLowerCase() === CIRCUIT.toLowerCase())
          owed = (await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "outstanding", args: [vault, id] })) as bigint
        if (owed === 0n)
          await execute(`closeCommitment ${vault}#${id}`, { address: vault, abi: parVaultAbi, functionName: "closeCommitment", args: [id] } as any, { vault })
      }
      continue
    }

    if (c.kind === Kind.Scheduled) {
      let paidOut = c.paidOut
      for (let i = 0; i < c.count; i++) {
        if (paidOut >= c.cap) break // cover exhausted: the commitment closed itself
        const key = `${vault}:${id}:${i}`
        if (settledIdx.has(key)) continue
        const due = c.start + BigInt(i) * BigInt(c.period)
        if (now <= due + BigInt(c.grace)) break // later indices are not due either
        if (c.expiry - now < 15n) break // too close to expiry: a tx would likely land after it
        const settled = await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "installmentSettled", args: [id, BigInt(i)] })
        if (settled) {
          settledIdx.add(key)
          continue
        }
        const { upper, lower } = await hintsForDraw(vault, c.installment)
        const ok = await execute(
          `triggerMissed ${vault}#${id}[${i}]`,
          { address: vault, abi: parVaultAbi, functionName: "triggerMissed", args: [id, BigInt(i), upper, lower] } as any,
          { vault },
        )
        if (ok) {
          settledIdx.add(key)
          paidOut += c.installment < c.cap - paidOut ? c.installment : c.cap - paidOut
        }
      }
    }

  }

  // Health watch: only meaningful while something is reserved. Alert on change, not every tick.
  if (anyActive) {
    try {
      const [ok, stressedIcr] = await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "health", args: [0n] })
      const [coll] = await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "troveState" })
      if (coll === 0n) {
        if (!deadTrove.has(vault)) {
          deadTrove.add(vault)
          await alert(`trove-inactive:${vault}`, "trove-inactive", { vault, owner: await ownerOf(vault), note: "Trove is closed or liquidated while commitments are active." })
        }
      } else if (!ok) {
        await alert(`under-reserved:${vault}`, "under-reserved", {
          vault,
          owner: await ownerOf(vault),
          stressedIcr: formatEther(stressedIcr),
          action: "Top up collateral or release commitments.",
        })
      } else clear(`under-reserved:${vault}`, "under-reserved", { vault })
    } catch (e) {
      log(`health(${vault}) failed: ${(e as Error).message.split("\n")[0]}`)
    }
  }
}

let resolveWindow: bigint | undefined

async function pendingClaim(vault: Address, id: bigint) {
  const r = (await pc.readContract({ address: vault, abi: parVaultAbi, functionName: "pendingClaims", args: [id] })) as any
  return {
    amount: r[0] as bigint,
    filedAt: r[1] as bigint,
    disputed: r[2] as boolean,
    open: r[3] as boolean,
    disputedAt: (r[5] as bigint | undefined) ?? 0n, // [4] is the evidence hash
  }
}

/**
 * Circuit force-settle. ParCircuit tracks each member line's unsettled debt across every cycle
 * (`outstanding[vault][lineId]`). Members with nothing outstanding cost one read. For the rest, the
 * keeper keeps a per-member cache of cycles that still owe and the newest cycle it has scanned:
 * after the first full walk-back it only scans new cycles, so cost per tick stays flat even if a
 * debt is never collected. If the cache no longer accounts for the outstanding amount it rescans.
 * Nothing is persisted, nothing is skipped after a restart, and one failing debtor never blocks others.
 */
type DebtCache = { scanned: bigint; debts: Set<bigint> }
const debtCache = new Map<string, DebtCache>()

async function netOf(cid: bigint, cyc: bigint, m: Address) {
  const [net, settled] = await Promise.all([
    pc.readContract({ address: CIRCUIT!, abi: parCircuitAbi, functionName: "net", args: [cid, cyc, m] }),
    pc.readContract({ address: CIRCUIT!, abi: parCircuitAbi, functionName: "settled", args: [cid, cyc, m] }),
  ])
  return { owes: !settled && (net as bigint) < 0n ? -(net as bigint) : 0n }
}

async function circuitJobs(now: bigint) {
  if (!CIRCUIT) return
  const n = await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "nextCircleId" })
  for (let cid = 0n; cid < n; cid++) {
    const circle = (await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "circles", args: [cid] })) as any
    const settleWindow = circle[3] as bigint
    const members = (await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "members_", args: [cid] })) as Address[]
    const current = await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "currentCycle", args: [cid] })
    for (const m of members) {
      const key = `${cid}:${m}`
      try {
        const [vault, lineId] = (await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "members", args: [cid, m] })) as any
        const owed = (await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "outstanding", args: [vault, lineId] })) as bigint
        if (owed === 0n) {
          debtCache.set(key, { scanned: current, debts: new Set() })
          continue
        }
        let cache = debtCache.get(key)
        if (cache) {
          // only cycles newer than the last scan can have added debt
          for (let cyc = cache.scanned + 1n; cyc <= current; cyc++) if ((await netOf(cid, cyc, m)).owes > 0n) cache.debts.add(cyc)
          cache.scanned = current
        }
        // verify the cache still explains the whole outstanding amount; otherwise do a full walk-back
        let sum = 0n
        const live = new Map<bigint, bigint>()
        for (const cyc of cache?.debts ?? []) {
          const { owes } = await netOf(cid, cyc, m)
          if (owes > 0n) {
            live.set(cyc, owes)
            sum += owes
          }
        }
        if (!cache || sum !== owed) {
          live.clear()
          sum = 0n
          for (let cyc = current; cyc >= 0n && sum < owed; cyc--) {
            const { owes } = await netOf(cid, cyc, m)
            if (owes > 0n) {
              live.set(cyc, owes)
              sum += owes
            }
          }
        }
        cache = { scanned: current, debts: new Set(live.keys()) }
        debtCache.set(key, cache)

        for (const [cyc, owes] of [...live.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
          const close = await pc.readContract({ address: CIRCUIT, abi: parCircuitAbi, functionName: "cycleClose", args: [cid, cyc] })
          if (now < close + settleWindow) continue // window still open: the debtor may settle themselves
          const label = `forceSettle circle ${cid} cycle ${cyc} debtor ${m}`
          const { upper, lower } = await hintsForDraw(vault, owes)
          const ok = await execute(
            label,
            { address: CIRCUIT, abi: parCircuitAbi, functionName: "forceSettle", args: [cid, cyc, m, upper, lower] } as any,
            { vault, owner: m },
          )
          if (ok) {
            cache.debts.delete(cyc)
            log(`${label}: drew ${formatEther(owes)} MUSD from the member's clearing line`)
          }
        }
      } catch (e) {
        log(`circle ${cid} member ${m} failed: ${(e as Error).message.split("\n")[0]}`)
      }
    }
  }
}

// ------------------------------------------------------------------ loop

let running = false
let tickStarted = 0
let ticks = 0
let lastBalance = 0n

async function tick() {
  if (running) {
    if (Date.now() - tickStarted > TICK_TIMEOUT_MS) {
      log(`tick stuck for ${Math.round((Date.now() - tickStarted) / 1000)}s; exiting so the platform restarts the keeper`)
      process.exit(1)
    }
    return
  }
  running = true
  tickStarted = Date.now()
  try {
    const block = await pc.getBlock()
    const now = block.timestamp
    lastBalance = await pc.getBalance({ address: account.address })
    if (Number(formatEther(lastBalance)) < LOW_BALANCE_BTC)
      await alert("low-balance", "keeper-low-balance", { keeper: account.address, balance: formatEther(lastBalance), threshold: LOW_BALANCE_BTC })
    else clear("low-balance", "keeper-low-balance")
    const vaults = await listVaults()
    for (const v of vaults) {
      try {
        await vaultJobs(v, now)
      } catch (e) {
        log(`vault ${v} failed: ${(e as Error).message.split("\n")[0]}`)
      }
    }
    await circuitJobs(now)
    ticks++
  } catch (e) {
    log(`tick failed: ${(e as Error).message.split("\n")[0]}`)
  } finally {
    running = false
  }
}

log(`Par keeper on ${chain.name} (${chain.id}) as ${account.address}; factory ${FACTORY}; circuit ${CIRCUIT ?? "-"}`)
log(`alerts: ${[TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID ? "telegram" : "", ALERT_WEBHOOK_URL ? "webhook" : ""].filter(Boolean).join("+") || "log only"}`)
const bal = await pc.getBalance({ address: account.address })
log(`keeper balance ${formatEther(bal)} BTC`)
await tick()
if (!ONCE) {
  const loop = setInterval(tick, INTERVAL_MS)
  const beat = setInterval(() => log(`heartbeat: ${ticks} ticks, balance ${formatEther(lastBalance)} BTC, pending ${pending.size}`), HEARTBEAT_MS)
  const stop = async (sig: string) => {
    log(`${sig}: stopping`)
    clearInterval(loop)
    clearInterval(beat)
    const t0 = Date.now()
    while (running && Date.now() - t0 < 20_000) await new Promise((r) => setTimeout(r, 250))
    process.exit(0)
  }
  process.on("SIGTERM", () => void stop("SIGTERM"))
  process.on("SIGINT", () => void stop("SIGINT"))
}

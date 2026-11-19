"use client"

import Link from "next/link"
import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { formatEther, isAddress, type Address } from "viem"
import { useBalance, useReadContract } from "wagmi"
import { WalletButton } from "@/components/Wallet"
import { parFactoryAbi, parVaultAbi } from "@/lib/abi"
import { CIRCUIT, CONFIGURED, FACTORY, GAS_COMP, addrUrl, chain } from "@/lib/config"
import { erc20Abi } from "@/lib/mezoAbi"
import { fmtBps, fmtBtc, fmtDate, fmtMusd, fmtPct, fmtRatio, fmtUsd, parseAmount, parseIntSafe, short, toNum } from "@/lib/format"
import { KIND_LABEL, useChainNow, useCommitments, useMarket, useMe, useProtocol, useTx, useVault, useVaultsOf, type Commitment } from "@/lib/hooks"
import { liquidationPrice, maxDrop, openPreview } from "@/lib/risk"
import { Addr, Badge, Button, Card, CardTitle, Empty, Field, HealthGauge, LinkButton, Meter, NotDeployed, Num, PageHead, Segmented, Stat, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address

export default function VaultPage() {
  return (
    <Suspense>
      <VaultInner />
    </Suspense>
  )
}

function VaultInner() {
  const { me, isConnected } = useMe()
  const { vaults, refetch } = useVaultsOf(me)
  const sp = useSearchParams()
  const router = useRouter()
  // Only honour ?v= for one of the connected wallet's own vaults: a crafted link must not make a
  // foreign contract look like "your vault" (and get BTC sent to it). Anything else is ignored.
  const qv = sp.get("v")?.toLowerCase()
  const selected = vaults.find((x) => x.toLowerCase() === qv) ?? vaults[vaults.length - 1]
  const { data, refetch: refetchVault } = useVault(selected)

  if (!CONFIGURED)
    return (
      <div className="flex flex-col gap-8">
        <PageHead eyebrow="Vault" title="Your vault." muted="Lock BTC once, back many promises." />
        <NotDeployed />
        <Steps active={0} />
      </div>
    )
  if (!isConnected)
    return (
      <div className="flex flex-col gap-8">
        <PageHead eyebrow="Vault" title="Your vault." muted="Lock BTC once, back many promises." />
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-btc text-xl text-fg" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>₿</span>
          <div className="text-lg font-medium">Connect a wallet to open your vault</div>
          <p className="max-w-md text-sm text-muted">Bitcoin wallets (Xverse, Unisat, OKX) connect through Mezo Passport. EVM wallets work too.</p>
          <WalletButton align="left" />
        </Card>
        <Steps active={0} />
      </div>
    )

  const stage = vaults.length === 0 ? 0 : data && !data.troveActive ? 1 : 2
  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Vault"
        title="Your vault"
        sub="Lock BTC once, back many promises."
        right={
          <div className="flex items-center gap-2">
            {vaults.length > 1 && (
              <select className={inputCls + " w-auto rounded-full py-2"} value={selected} onChange={(e) => router.push(`/vault?v=${e.target.value}`)}>
                {vaults.map((v, i) => (
                  <option key={v} value={v}>
                    Vault {i + 1} · {short(v)}
                  </option>
                ))}
              </select>
            )}
            {selected && (
              <a href={addrUrl(selected)} target="_blank" rel="noreferrer" className="num rounded-full border border-line bg-white px-3 py-2 text-xs text-muted hover:text-fg">
                {short(selected)} ↗
              </a>
            )}
            {stage === 2 && <LinkButton href={`/vault/new-guarantee?v=${selected}`}>New guarantee</LinkButton>}
          </div>
        }
      />
      {stage < 2 && <Steps active={stage} />}
      {vaults.length === 0 ? (
        <CreateVault onDone={refetch} />
      ) : !data ? (
        <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
      ) : !data.troveActive ? (
        <>
          <OpenTrove vault={selected!} onDone={refetchVault} />
          <ClaimSurplus vault={selected!} onDone={refetchVault} />
        </>
      ) : (
        <Dashboard vault={selected!} />
      )}
      {vaults.length > 0 && <CreateVault onDone={refetch} secondary />}
      <VaultRecovery onDone={refetch} />
    </div>
  )
}

function Steps({ active }: { active: number }) {
  const s = [
    ["Create a vault", "Your own contract on Mezo"],
    ["Open the trove", "Lock BTC, capacity fixed"],
    ["Make a promise", "Stress-tested before it exists"],
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {s.map(([t, d], i) => (
        <div key={t} className={`flex items-center gap-3 rounded-2xl border p-4 ${i === active ? "border-fg bg-white shadow-card" : "border-line bg-white/60"}`}>
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs ${
              i < active ? "bg-fg text-white" : i === active ? "bg-btc text-fg" : "bg-soft text-subtle"
            }`}
          >
            {i < active ? "✓" : i + 1}
          </span>
          <div>
            <div className={`text-sm font-medium ${i > active ? "text-subtle" : ""}`}>{t}</div>
            <div className="text-xs text-subtle">{d}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CreateVault({ onDone, secondary }: { onDone: () => void; secondary?: boolean }) {
  const tx = useTx(() => onDone())
  if (secondary)
    return (
      <div className="text-right text-xs text-subtle">
        One vault holds one trove ·{" "}
        <button
          className="font-medium text-fg hover:text-btc-ink disabled:opacity-40"
          disabled={tx.busy}
          onClick={() => tx.send({ address: FACTORY, abi: parFactoryAbi, functionName: "createVault" })}
        >
          {tx.busy ? "Creating…" : "Create another vault"}
        </button>
        <TxStatus tx={tx} />
      </div>
    )
  return (
    <Card className="flex flex-col items-start gap-4">
      <CardTitle sub="An EIP-1167 clone that owns a MUSD trove and holds your promises. Only you control it.">Create your vault</CardTitle>
      <Button busy={tx.busy} onClick={() => tx.send({ address: FACTORY, abi: parFactoryAbi, functionName: "createVault" })}>
        Create vault
      </Button>
      <TxStatus tx={tx} />
    </Card>
  )
}

function OpenTrove({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const { me } = useMe()
  const p = useProtocol()
  const m = useMarket()
  const { data: bal } = useBalance({ address: me, chainId: chain.id })
  const [btc, setBtc] = useState("0.25")
  const [seed, setSeed] = useState("")
  const { data: vs } = useVault(vault)
  const seedWei = seed.trim() ? parseAmount(seed) : m.minNetDebt
  const collWei = parseAmount(btc) ?? 0n
  const pv = p && m.price && seedWei !== undefined ? openPreview(collWei, m.price, seedWei, p.stressBps, p.targetIcr) : undefined
  // Unknown owner (still loading, or a failed read) counts as not-owner: never offer to send BTC blind.
  const ownerKnown = !!vs?.owner && !!me
  const notOwner = !ownerKnown || vs!.owner!.toLowerCase() !== me!.toLowerCase()
  const problem = !ownerKnown
    ? "Checking the vault owner…"
    : notOwner
      ? "Only the vault owner can open its trove."
      : parseAmount(btc) === undefined
      ? "Enter the BTC amount as a plain number, e.g. 0.25."
      : collWei === 0n
        ? "Enter how much BTC to lock."
        : bal && collWei > bal.value
          ? "That's more BTC than your wallet holds."
          : seedWei === undefined
            ? "Enter the buffer as a plain number, e.g. 1800."
            : seedWei < m.minNetDebt
              ? `MUSD's minimum loan is ${fmtMusd(m.minNetDebt, 0)} MUSD.`
              : pv && pv.icr < 1_100_000_000_000_000_000n
                ? "Not enough BTC for this loan: the collateral ratio would be under 110%."
                : undefined
  const walletBtc = bal ? Number(formatEther(bal.value)) : 0
  const max = bal ? Math.max(0.001, walletBtc * 0.98) : 1
  const tx = useTx(() => onDone())
  const total = pv ? toNum(pv.capacity) : 0
  const pct = (x?: bigint) => (total > 0 && x !== undefined ? (toNum(x) / total) * 100 : 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardTitle sub="Open with all the BTC you intend to pledge. Capacity and rate are fixed now; later top-ups add safety, not capacity.">Open the trove</CardTitle>
        <div className="rounded-xl border border-line bg-soft p-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Collateral</span>
            {bal && <span className="num">Wallet {fmtBtc(bal.value)} BTC</span>}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <input
              className="num w-full bg-transparent text-4xl font-medium tracking-tight outline-none"
              value={btc}
              onChange={(e) => setBtc(e.target.value)}
              inputMode="decimal"
            />
            <span className="text-sm text-muted">BTC</span>
          </div>
          <input type="range" aria-label="Collateral in BTC" min={0.001} max={max} step={0.001} value={Number(btc) || 0} onChange={(e) => setBtc(e.target.value)} className="mt-3 w-full accent-[#0A0A0B]" />
          <div className="mt-2 flex gap-2">
            {["0.1", "0.25", "0.5"].map((v) => (
              <button key={v} onClick={() => setBtc(v)} className="rounded-full border border-line bg-white px-3 py-1 font-mono text-xs hover:border-fg">
                {v}
              </button>
            ))}
            {bal && (
              <button onClick={() => setBtc((walletBtc * 0.98).toFixed(4))} className="rounded-full border border-line bg-white px-3 py-1 font-mono text-xs hover:border-fg">
                Max
              </button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <Field label="Buffer draw (MUSD)" hint={`MUSD's minimum loan is ${fmtMusd(m.minNetDebt, 0)}. It stays in the vault and pays the first claims without new debt.`}>
            <input className={inputCls} inputMode="decimal" placeholder={formatEther(m.minNetDebt)} value={seed} onChange={(e) => setSeed(e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button
            busy={tx.busy}
            disabled={!!problem || notOwner}
            onClick={() => !notOwner && tx.send({ address: vault, abi: parVaultAbi, functionName: "openTrove", args: [seedWei, Z, Z], value: collWei })}
          >
            Open trove with {fmtBtc(collWei)} BTC
          </Button>
          <TxStatus tx={tx} />
          {problem && <p className="w-full text-sm text-warn">{problem}</p>}
        </div>
      </Card>

      <Card>
        <CardTitle sub={m.price ? `At ${fmtUsd(toNum(m.price))} per BTC` : undefined}>Preview</CardTitle>
        <div className="num text-5xl font-medium tracking-tight">{fmtMusd(pv?.maxCover, 0)}</div>
        <div className="mt-1 text-sm text-muted">MUSD of cover you can promise{p ? `, surviving a ${Number(p.stressBps) / 100}% BTC drop` : ""}</div>
        <div className="mt-6">
          <div className="flex h-3 overflow-hidden rounded-full bg-soft">
            <div className="bg-fg" style={{ width: `${pct(pv?.debt)}%` }} />
            <div className="bg-btc" style={{ width: `${pct(pv?.maxCover)}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
            <Legend c="bg-fg">Opening debt {fmtMusd(pv?.debt, 0)}</Legend>
            <Legend c="bg-btc">Cover {fmtMusd(pv?.maxCover, 0)}</Legend>
            <Legend c="bg-soft border border-line">Unused capacity</Legend>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5">
          <Stat label="Capacity (fixed)" value={fmtMusd(pv?.capacity, 0)} unit="MUSD" />
          <Stat label="Rate (locked)" value={m.globalRate !== undefined ? fmtBps(m.globalRate) : "–"} />
          <Stat label="Collateral value" value={pv ? fmtUsd(toNum(pv.value)) : "–"} />
          <Stat label="Payable in practice" value={fmtMusd(pv?.payable, 0)} unit="MUSD" />
        </div>
      </Card>
    </div>
  )
}

function Legend({ c, children }: { c: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${c}`} />
      {children}
    </span>
  )
}

function Dashboard({ vault }: { vault: Address }) {
  const { me } = useMe()
  const p = useProtocol()
  const m = useMarket()
  const { data: v, refetch } = useVault(vault)
  const { list, refetch: refetchC } = useCommitments(vault, v?.nextId)
  const now = useChainNow()
  if (!v || !p) return null

  const drop = m.price ? maxDrop(v.coll, v.debt, v.reserved, m.price) : 0
  const liq = liquidationPrice(v.coll, v.debt, v.reserved)
  const isOwner = !!me && !!v.owner && me.toLowerCase() === v.owner.toLowerCase()
  const refreshAll = () => {
    refetch()
    refetchC()
  }
  const cap = toNum(v.capacity) || 1
  const seg = (x: bigint) => (toNum(x) / cap) * 100
  const active = list.filter((c) => c.status === 1 && Number(c.expiry) >= now).length

  return (
    <div className="flex flex-col gap-5">
      {m.recoveryMode && <RecoveryBanner vault={vault} reserved={v.reserved} buffer={v.buffer} price={m.price} idle={v.idleBtc} />}
      {!v.healthOk && (
        <div className="rounded-2xl border border-bad/20 bg-bad-wash p-4 text-sm text-bad">
          <b>Under-reserved.</b> At today&apos;s price this vault no longer passes the stress test. Existing promises are still honored, but no new ones can
          be made. Top up to restore health.
        </div>
      )}

      <Card pad={false} className="grid grid-cols-2 sm:grid-cols-4 [&>div]:border-line max-sm:[&>div:nth-child(-n+2)]:border-b max-sm:[&>div:nth-child(even)]:border-l sm:[&>div+div]:border-l">
        <div className="p-5 sm:p-6">
          <Stat label="Collateral" value={fmtBtc(v.coll)} unit="BTC" sub={m.price ? fmtUsd(toNum(v.coll) * toNum(m.price)) : undefined} />
        </div>
        <div className="p-5 sm:p-6">
          <Stat label="Promised" value={fmtMusd(v.reserved, 0)} unit="MUSD" sub={`${active} active commitment${active === 1 ? "" : "s"}`} />
        </div>
        <div className="p-5 sm:p-6">
          <Stat label="Room for more" value={fmtMusd(v.headroom, 0)} unit="MUSD" sub="under capacity" />
        </div>
        <div className="p-5 sm:p-6">
          <Stat label="Holds if BTC falls" value={`−${fmtPct(drop)}`} tone="btc" sub="ratio stays above 150%" />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle sub="Fixed at open. Debt only grows when a promise is called and the buffer is used up.">Capacity</CardTitle>
          <div className="flex h-4 overflow-hidden rounded-full bg-soft">
            <div className="bg-fg" style={{ width: `${seg(v.debt)}%` }} title="Debt" />
            <div className="bg-btc" style={{ width: `${seg(v.reserved)}%` }} title="Promised" />
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
            <Legend c="bg-fg">Debt {fmtMusd(v.debt, 0)}</Legend>
            <Legend c="bg-btc">Promised {fmtMusd(v.reserved, 0)}</Legend>
            <Legend c="bg-soft border border-line">Free {fmtMusd(v.headroom, 0)}</Legend>
            <span className="ml-auto num">of {fmtMusd(v.capacity, 0)} MUSD</span>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-5 border-t border-line pt-5 sm:grid-cols-4">
            <Stat label="Buffer" value={fmtMusd(v.buffer, 0)} unit="MUSD" sub="pays first" />
            <Stat label="Rate (locked)" value={v.rate !== undefined ? fmtBps(v.rate) : "–"} sub="drawn MUSD only" />
            <Stat label="Idle reserve" value={fmtBtc(v.idleBtc, 4)} unit="BTC" sub="for Recovery Mode" />
            <Stat label="Liquidation" value={fmtUsd(toNum(liq))} sub="if all are called" />
          </div>
        </Card>
        <Card>
          <CardTitle right={<Badge tone={v.healthOk ? "ok" : "bad"}>{v.healthOk ? "Healthy" : "Under-reserved"}</Badge>}>Health</CardTitle>
          <div className="num text-5xl font-medium tracking-tight">{fmtRatio(v.stressedIcr)}</div>
          <p className="mb-5 mt-1 text-sm text-muted">
            Collateral ratio if BTC fell {Number(p.stressBps) / 100}% and every promise were called. Must stay above {fmtRatio(p.targetIcr)}.
          </p>
          <HealthGauge stressedIcr={v.stressedIcr} target={p.targetIcr} ok={v.healthOk} />
        </Card>
      </div>

      <Card pad={false}>
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Commitments</h2>
            <p className="mt-1 text-sm text-muted">Nothing is borrowed on a commitment until it&apos;s called.</p>
          </div>
          {isOwner && (
            <LinkButton href={`/vault/new-guarantee?v=${vault}`} variant="ghost">
              + New
            </LinkButton>
          )}
        </div>
        {list.length === 0 ? (
          <div className="border-t border-line px-6 py-10 text-center text-sm text-muted">No promises yet.</div>
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {list
              .slice()
              .reverse()
              .map((c) => (
                <CommitmentRow key={String(c.id)} vault={vault} c={c} now={now} />
              ))}
          </div>
        )}
      </Card>

      {isOwner && (
        <Actions vault={vault} buffer={v.buffer} idle={v.idleBtc} headroom={v.headroom} debt={v.debt} reserved={v.reserved} onDone={refreshAll} />
      )}
    </div>
  )
}

const KIND_ICON = ["⌂", "§", "⇄"]

function CommitmentRow({ vault, c, now }: { vault: Address; c: Commitment; now: number }) {
  const expired = Number(c.expiry) < now
  const paidPct = c.cap > 0n ? (toNum(c.paidOut) / toNum(c.cap)) * 100 : 0
  return (
    <Link href={`/c/${vault}/${c.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 transition hover:bg-canvas sm:grid-cols-[auto_1.4fr_1fr_auto_auto]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-soft text-sm">{KIND_ICON[c.kind]}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {KIND_LABEL[c.kind]} <span className="num text-subtle">#{String(c.id)}</span>
        </div>
        <div className="truncate text-xs text-muted">
          to {c.beneficiary === CIRCUIT ? "Par Circuit" : short(c.beneficiary)} · until {fmtDate(c.expiry)}
        </div>
      </div>
      <div className="hidden sm:block">
        <div className="num text-sm">
          {fmtMusd(c.paidOut, 0)} <span className="text-subtle">/ {fmtMusd(c.cap, 0)}</span>
        </div>
        <div className="mt-1.5 w-32">
          <Meter value={paidPct} tone="btc" />
        </div>
      </div>
      <div className="hidden sm:block">
        {c.status === 1 && !expired ? <Badge tone="ok">Active</Badge> : c.status === 1 ? <Badge tone="warn">Expired</Badge> : <Badge tone="muted">Closed</Badge>}
      </div>
      <span className="text-subtle">›</span>
    </Link>
  )
}

function RecoveryBanner({ vault, reserved, buffer, price, idle }: { vault: Address; reserved: bigint; buffer: bigint; price?: bigint; idle: bigint }) {
  const draw = reserved > buffer ? reserved - buffer : 0n
  const { data: need } = useReadContract({
    address: vault,
    abi: parVaultAbi,
    functionName: "recoveryTopUp",
    args: [draw, price ?? 0n],
    query: { enabled: draw > 0n && !!price },
  })
  return (
    <div className="rounded-2xl border border-warn/20 bg-warn-wash p-4 text-sm text-warn">
      <b>Mezo is in Recovery Mode.</b> New MUSD debt needs a collateral top-up. To pay {fmtMusd(draw, 0)} MUSD beyond the buffer this vault needs{" "}
      {need !== undefined ? fmtBtc(need, 6) : "…"} BTC of idle reserve (it has {fmtBtc(idle, 6)}). Fund it below; the keeper retries automatically.
    </div>
  )
}

type Tab = "topup" | "reserve" | "buffer" | "repay" | "line" | "collateral" | "borrow" | "refinance" | "owner" | "close"

function Actions({
  vault,
  buffer,
  idle,
  headroom,
  debt,
  reserved,
  onDone,
}: {
  vault: Address
  buffer: bigint
  idle: bigint
  headroom: bigint
  debt: bigint
  reserved: bigint
  onDone: () => void
}) {
  const [tab, setTab] = useState<Tab>("topup")
  return (
    <Card>
      <CardTitle sub="Owner actions. Anything that would weaken the vault below its promises is rejected.">Manage</CardTitle>
      <div className="overflow-x-auto">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "topup", label: "Top up" },
            { value: "reserve", label: "Reserve" },
            { value: "buffer", label: "Buffer" },
            { value: "repay", label: "Repay" },
            { value: "line", label: "Circuit line" },
            { value: "collateral", label: "Collateral" },
            { value: "borrow", label: "Borrow" },
            { value: "refinance", label: "Refinance" },
            { value: "owner", label: "Ownership" },
            { value: "close", label: "Close" },
          ]}
        />
      </div>
      <div className="mt-6 max-w-xl">
        {tab === "topup" && <TopUp vault={vault} onDone={onDone} />}
        {tab === "reserve" && <Reserve vault={vault} idle={idle} onDone={onDone} />}
        {tab === "buffer" && <BufferOut vault={vault} buffer={buffer} onDone={onDone} />}
        {tab === "repay" && <Repay vault={vault} onDone={onDone} />}
        {tab === "line" && <ClearingLine vault={vault} headroom={headroom} onDone={onDone} />}
        {tab === "collateral" && <WithdrawColl vault={vault} onDone={onDone} />}
        {tab === "borrow" && <Borrow vault={vault} headroom={headroom} onDone={onDone} />}
        {tab === "refinance" && <Refinance vault={vault} onDone={onDone} />}
        {tab === "owner" && <Ownership vault={vault} onDone={onDone} />}
        {tab === "close" && <CloseTrove vault={vault} debt={debt} buffer={buffer} reserved={reserved} onDone={onDone} />}
      </div>
    </Card>
  )
}

function AmountRow({ label, hint, unit, value, onChange, action }: { label: string; hint?: string; unit: string; value: string; onChange: (v: string) => void; action: React.ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input className={inputCls + " pr-14"} placeholder="0.0" value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-subtle">{unit}</span>
        </div>
        {action}
      </div>
    </Field>
  )
}

function TopUp({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const [v, setV] = useState("")
  const t = useTx(onDone)
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Add collateral"
        hint="Adds safety, not capacity: MUSD fixed capacity when the trove opened."
        unit="BTC"
        value={v}
        onChange={setV}
        action={
          <Button busy={t.busy} disabled={!parseAmount(v)} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "topUp", args: [Z, Z], value: parseAmount(v)! })}>
            Top up
          </Button>
        }
      />
      <TxStatus tx={t} />
    </div>
  )
}

function Reserve({ vault, idle, onDone }: { vault: Address; idle: bigint; onDone: () => void }) {
  const [v, setV] = useState("")
  const tFund = useTx(() => {
    setV("")
    onDone()
  })
  const tIdle = useTx(onDone)
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Fund the Recovery Mode reserve"
        hint={`Idle BTC the vault can add as collateral when MUSD is in Recovery Mode. Current reserve: ${fmtBtc(idle, 6)} BTC.`}
        unit="BTC"
        value={v}
        onChange={setV}
        action={
          <Button busy={tFund.busy} disabled={!parseAmount(v)} onClick={() => tFund.send({ to: vault, value: parseAmount(v)! })}>
            Fund
          </Button>
        }
      />
      <TxStatus tx={tFund} />
      {idle > 0n && (
        <div>
          <Button variant="ghost" size="sm" busy={tIdle.busy} onClick={() => tIdle.send({ address: vault, abi: parVaultAbi, functionName: "withdrawIdleBTC", args: [idle] })}>
            Withdraw reserve ({fmtBtc(idle, 6)} BTC)
          </Button>
          <TxStatus tx={tIdle} />
        </div>
      )}
    </div>
  )
}

function BufferOut({ vault, buffer, onDone }: { vault: Address; buffer: bigint; onDone: () => void }) {
  const { me } = useMe()
  const [v, setV] = useState("")
  const t = useTx(onDone)
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Withdraw buffer MUSD"
        hint={`The buffer isn't counted in health checks. Balance: ${fmtMusd(buffer)} MUSD.`}
        unit="MUSD"
        value={v}
        onChange={setV}
        action={
          <Button
            busy={t.busy}
            disabled={!parseAmount(v) || parseAmount(v)! > buffer || !me}
            onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "withdrawMUSDBuffer", args: [parseAmount(v)!, me!] })}
          >
            Withdraw
          </Button>
        }
      />
      <TxStatus tx={t} />
    </div>
  )
}

function Repay({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const [v, setV] = useState("")
  const t = useTx(onDone)
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Repay debt from the vault's MUSD"
        hint="Send MUSD to the vault first if the buffer is short. Debt can't go below MUSD's minimum."
        unit="MUSD"
        value={v}
        onChange={setV}
        action={
          <Button busy={t.busy} disabled={!parseAmount(v)} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "repay", args: [parseAmount(v)!, Z, Z] })}>
            Repay
          </Button>
        }
      />
      <TxStatus tx={t} />
    </div>
  )
}

function ClearingLine({ vault, headroom, onDone }: { vault: Address; headroom: bigint; onDone: () => void }) {
  const [cap, setCap] = useState("1500")
  const [days, setDays] = useState("60")
  const capWei = parseAmount(cap)
  const dayN = parseIntSafe(days, { min: 1, max: 3650 })
  const { data: fits } = useReadContract({
    address: vault,
    abi: parVaultAbi,
    functionName: "health",
    args: [capWei ?? 0n],
    query: { enabled: !!capWei },
  })
  const t = useTx(onDone)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Pledge a credit line to Par Circuit to join a trade circle. It can only be drawn to settle what you owe at cycle end. Then send the circle admin
        your vault address and the line number.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Line" hint={`Room: ${fmtMusd(headroom, 0)} MUSD`}>
          <input className={inputCls} inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <Field label="Expires in (days)" hint="Must outlast every cycle you trade in, plus its settle window.">
          <input className={inputCls} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
      </div>
      {fits && (
        <div className="flex items-center gap-2 text-sm">
          <Badge tone={fits[0] ? "ok" : "bad"}>{fits[0] ? "Fits" : "Doesn't fit"}</Badge>
          <span className="text-muted">stressed ratio {fmtRatio(fits[1])}</span>
        </div>
      )}
      <div>
        <Button
          busy={t.busy}
          disabled={!fits?.[0] || CIRCUIT === Z || !capWei || !dayN}
          onClick={() =>
            t.send({
              address: vault,
              abi: parVaultAbi,
              functionName: "createClearingLine",
              // expiry computed at click time, not when the field was edited
              args: [CIRCUIT, capWei!, BigInt(Math.floor(Date.now() / 1000) + dayN! * 86400)],
            })
          }
        >
          Pledge line
        </Button>
      </div>
      <TxStatus tx={t} />
    </div>
  )
}

function WithdrawColl({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const [v, setV] = useState("")
  const t = useTx(onDone)
  const w = parseAmount(v)
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Withdraw collateral"
        hint="BTC goes back to your wallet. Rejected if the vault would fail its stress test or drop below what its promises need."
        unit="BTC"
        value={v}
        onChange={setV}
        action={
          <Button busy={t.busy} disabled={!w} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "withdrawCollateral", args: [w!, Z, Z] })}>
            Withdraw
          </Button>
        }
      />
      <TxStatus tx={t} />
    </div>
  )
}

function Borrow({ vault, headroom, onDone }: { vault: Address; headroom: bigint; onDone: () => void }) {
  const { me } = useMe()
  const [v, setV] = useState("")
  const t = useTx(onDone)
  const w = parseAmount(v)
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Borrow MUSD to your wallet"
        hint={`Draws new debt from the trove (0.1% fee). Room under capacity: ${fmtMusd(headroom, 0)} MUSD. Must still pass the stress test.`}
        unit="MUSD"
        value={v}
        onChange={setV}
        action={
          <Button busy={t.busy} disabled={!w || !me} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "borrow", args: [w!, me!, Z, Z] })}>
            Borrow
          </Button>
        }
      />
      <TxStatus tx={t} />
    </div>
  )
}

function Refinance({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const t = useTx(onDone)
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        Refinancing moves the trove to MUSD&apos;s current interest rate and re-snapshots capacity at today&apos;s BTC price (MUSD charges a refinancing
        fee). Useful after BTC has risen. It is rejected if the vault would then fail its stress test.
      </p>
      <div>
        <Button busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "refinance", args: [Z, Z] })}>
          Refinance trove
        </Button>
      </div>
      <TxStatus tx={t} />
    </div>
  )
}

function Ownership({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const [to, setTo] = useState("")
  const t = useTx(onDone)
  const { data: pending, refetch } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "pendingOwner" })
  const ok = isAddress(to)
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted">
        Ownership moves in two steps so a typo can&apos;t lose the vault: you propose a new owner, and they accept from their own wallet on this page.
        The vault keeps its trove, promises and any circle membership.
      </p>
      <Field label="New owner">
        <input className={inputCls} placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button busy={t.busy} disabled={!ok} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "transferOwnership", args: [to as Address] }).then(() => refetch())}>
          Propose new owner
        </Button>
        {pending && pending !== Z && (
          <span className="text-xs text-muted">
            Pending: <Addr a={pending as string} />
          </span>
        )}
      </div>
      <TxStatus tx={t} />
    </div>
  )
}

function CloseTrove({ vault, debt, buffer, reserved, onDone }: { vault: Address; debt: bigint; buffer: bigint; reserved: bigint; onDone: () => void }) {
  const p = useProtocol()
  const { me } = useMe()
  const t = useTx(onDone)
  const tSend = useTx(onDone)
  // MUSD's closeTrove repays everything except the 200 MUSD gas compensation, which it burns itself.
  const need = debt > GAS_COMP ? debt - GAS_COMP : 0n
  const short = need > buffer ? need - buffer : 0n
  // a little headroom for interest accrued between now and the transaction
  const sendAmt = short > 0n ? short + short / 200n + 10n ** 18n : 0n
  const { data: walletMusd } = useReadContract({ address: p?.musd, abi: erc20Abi, functionName: "balanceOf", args: [me ?? Z], query: { enabled: !!p && !!me, refetchInterval: 8_000 } })
  const canSend = walletMusd !== undefined && (walletMusd as bigint) >= sendAmt
  return (
    <div className="flex flex-col gap-3 text-sm">
      {reserved > 0n ? (
        <p className="rounded-lg bg-warn-wash px-3 py-2 text-warn">
          {fmtMusd(reserved, 0)} MUSD is still reserved by live promises. Release them or let them expire (then close them from their certificate) before
          closing the trove.
        </p>
      ) : (
        <>
          <p className="text-muted">
            Closing repays the trove&apos;s debt from the vault&apos;s MUSD and sends all its BTC back to you. The vault needs about{" "}
            <Num v={fmtMusd(need, 0)} /> MUSD; it holds <Num v={fmtMusd(buffer, 0)} />.
          </p>
          {short > 0n && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-warn">Short by about {fmtMusd(short, 0)} MUSD.</span>
                <Button
                  variant="ghost"
                  busy={tSend.busy}
                  disabled={!p || !me || !canSend}
                  onClick={() => tSend.send({ address: p!.musd, abi: erc20Abi, functionName: "transfer", args: [vault, sendAmt] })}
                >
                  Send {fmtMusd(sendAmt, 0)} MUSD to the vault
                </Button>
              </div>
              {!canSend && (
                <p className="text-xs text-muted">
                  Your wallet holds {fmtMusd(walletMusd as bigint | undefined, 2)} MUSD. Borrowing from this vault won&apos;t close the gap (it adds the same
                  amount to the debt): get MUSD elsewhere, for example by swapping BTC for MUSD in the Mezo app, then send it here.
                </p>
              )}
            </div>
          )}
          <div>
            <Button variant="danger" busy={t.busy} disabled={short > 0n} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "closeTrove", args: [] })}>
              Close trove and withdraw all BTC
            </Button>
          </div>
        </>
      )}
      <TxStatus tx={tSend} />
      <TxStatus tx={t} />
    </div>
  )
}

/** For a wallet that has been proposed as a vault's new owner, or a vault whose trove was liquidated/redeemed. */
function VaultRecovery({ onDone }: { onDone: () => void }) {
  const { me } = useMe()
  const [vault, setVault] = useState("")
  const ok = isAddress(vault)
  const { data: isPar } = useReadContract({ address: FACTORY, abi: parFactoryAbi, functionName: "isVault", args: [(ok ? vault : Z) as Address], query: { enabled: ok } })
  const { data: pending } = useReadContract({ address: (ok ? vault : Z) as Address, abi: parVaultAbi, functionName: "pendingOwner", query: { enabled: ok && !!isPar } })
  const t = useTx(onDone)
  const canAccept = ok && isPar && pending && me && (pending as string).toLowerCase() === me.toLowerCase()
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <CardTitle sub="Someone is handing you a vault? Paste its address and accept it from this wallet.">Accept a vault transfer</CardTitle>
      <Field label="Vault address">
        <input className={inputCls} placeholder="0x…" value={vault} onChange={(e) => setVault(e.target.value)} />
      </Field>
      {ok && isPar === false && <p className="text-warn">That address isn&apos;t a Par vault.</p>}
      {ok && isPar && !canAccept && <p className="text-muted">This wallet isn&apos;t the proposed new owner of that vault.</p>}
      <div>
        <Button busy={t.busy} disabled={!canAccept} onClick={() => t.send({ address: vault as Address, abi: parVaultAbi, functionName: "acceptOwnership", args: [] })}>
          Accept ownership
        </Button>
      </div>
      <TxStatus tx={t} />
    </Card>
  )
}

/** After a liquidation or a full redemption MUSD holds any collateral surplus for the vault. */
function ClaimSurplus({ vault, onDone }: { vault: Address; onDone: () => void }) {
  const t = useTx(onDone)
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <CardTitle sub="If this vault's trove was liquidated or fully redeemed, MUSD keeps any leftover BTC for it. Pull it into the vault, then withdraw it from the Reserve tab.">
        Recover surplus collateral
      </CardTitle>
      <div>
        <Button variant="ghost" busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "claimCollateral", args: [] })}>
          Claim surplus collateral
        </Button>
      </div>
      <TxStatus tx={t} />
    </Card>
  )
}

"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { formatEther, parseEther, type Address } from "viem"
import { useBalance, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { parFactoryAbi, parVaultAbi } from "@/lib/abi"
import { CIRCUIT, CONFIGURED, FACTORY, addrUrl } from "@/lib/config"
import { fmtBps, fmtBtc, fmtDate, fmtMusd, fmtPct, fmtRatio, fmtUsd, short, toNum } from "@/lib/format"
import { KIND_LABEL, errorText, useChainNow, useCommitments, useMarket, useMe, useProtocol, useTx, useVault, useVaultsOf, type Commitment } from "@/lib/hooks"
import { liquidationPrice, maxDrop, openPreview } from "@/lib/risk"
import { Badge, Button, Card, CardTitle, Empty, Field, HealthGauge, LinkButton, Meter, NotDeployed, PageHead, Segmented, Stat, TxLink, TxStatus, inputCls } from "@/components/ui"

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
  const selected = (sp.get("v") as Address | null) ?? vaults[vaults.length - 1]
  const { data, refetch: refetchVault } = useVault(selected)

  if (!CONFIGURED)
    return (
      <div className="flex flex-col gap-8">
        <PageHead eyebrow="Vault" title="Your vault" sub="Lock BTC once, back many promises." />
        <NotDeployed />
        <Steps active={0} />
      </div>
    )
  if (!isConnected)
    return (
      <div className="flex flex-col gap-8">
        <PageHead eyebrow="Vault" title="Your vault" sub="Lock BTC once, back many promises." />
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-btc text-xl text-white" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>₿</span>
          <div className="text-lg font-medium">Connect a wallet to open your vault</div>
          <p className="max-w-md text-sm text-muted">Bitcoin wallets (Xverse, Unisat, OKX) connect through Mezo Passport. EVM wallets work too.</p>
          <ConnectButton />
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
        <OpenTrove vault={selected!} onDone={refetchVault} />
      ) : (
        <Dashboard vault={selected!} />
      )}
      {vaults.length > 0 && <CreateVault onDone={refetch} secondary />}
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
              i < active ? "bg-fg text-white" : i === active ? "bg-btc text-white" : "bg-soft text-subtle"
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
        <button className="font-medium text-fg hover:text-btc-ink" onClick={() => tx.send({ address: FACTORY, abi: parFactoryAbi, functionName: "createVault" })}>
          Create another vault
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
  const { data: bal } = useBalance({ address: me })
  const [btc, setBtc] = useState("0.25")
  const [seed, setSeed] = useState("")
  const seedWei = seed ? parseEther(seed) : m.minNetDebt
  const collWei = btc && Number(btc) > 0 ? parseEther(btc) : 0n
  const walletBtc = bal ? Number(formatEther(bal.value)) : 0
  const max = bal ? Math.max(0.001, walletBtc * 0.98) : 1
  const pv = p && m.price ? openPreview(collWei, m.price, seedWei, p.stressBps, p.targetIcr) : undefined
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
          <input type="range" min={0.001} max={max} step={0.001} value={btc || 0} onChange={(e) => setBtc(e.target.value)} className="mt-3 w-full accent-[#0A0A0B]" />
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
            <input className={inputCls} placeholder={formatEther(m.minNetDebt)} value={seed} onChange={(e) => setSeed(e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button
            busy={tx.busy}
            disabled={!collWei || (pv && pv.icr < 1_100_000_000_000_000_000n)}
            onClick={() => tx.send({ address: vault, abi: parVaultAbi, functionName: "openTrove", args: [seedWei, Z, Z], value: collWei })}
          >
            Open trove with {btc || 0} BTC
          </Button>
          <TxStatus tx={tx} />
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
  const isOwner = me?.toLowerCase() === v.owner?.toLowerCase()
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

      <Card pad={false} className="grid divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-6">
          <Stat label="Collateral" value={fmtBtc(v.coll)} unit="BTC" sub={m.price ? fmtUsd(toNum(v.coll) * toNum(m.price)) : undefined} />
        </div>
        <div className="p-6">
          <Stat label="Promised" value={fmtMusd(v.reserved, 0)} unit="MUSD" sub={`${active} active commitment${active === 1 ? "" : "s"}`} />
        </div>
        <div className="p-6">
          <Stat label="Room for more" value={fmtMusd(v.headroom, 0)} unit="MUSD" sub="under capacity" />
        </div>
        <div className="p-6">
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

      {isOwner && <Actions vault={vault} buffer={v.buffer} idle={v.idleBtc} headroom={v.headroom} onDone={refreshAll} />}
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

type Tab = "topup" | "reserve" | "buffer" | "repay" | "line"

function Actions({ vault, buffer, idle, headroom, onDone }: { vault: Address; buffer: bigint; idle: bigint; headroom: bigint; onDone: () => void }) {
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
          ]}
        />
      </div>
      <div className="mt-6 max-w-xl">
        {tab === "topup" && <TopUp vault={vault} onDone={onDone} />}
        {tab === "reserve" && <Reserve vault={vault} idle={idle} onDone={onDone} />}
        {tab === "buffer" && <BufferOut vault={vault} buffer={buffer} onDone={onDone} />}
        {tab === "repay" && <Repay vault={vault} onDone={onDone} />}
        {tab === "line" && <ClearingLine vault={vault} headroom={headroom} onDone={onDone} />}
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
          <Button busy={t.busy} disabled={!v} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "topUp", args: [Z, Z], value: parseEther(v) })}>
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
  const send = useSendTransaction()
  const rc = useWaitForTransactionReceipt({ hash: send.data })
  const tIdle = useTx(onDone)
  useEffect(() => {
    if (rc.isSuccess) {
      setV("")
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rc.isSuccess])
  return (
    <div className="flex flex-col gap-3">
      <AmountRow
        label="Fund the Recovery Mode reserve"
        hint={`Idle BTC the vault can add as collateral when MUSD is in Recovery Mode. Current reserve: ${fmtBtc(idle, 6)} BTC.`}
        unit="BTC"
        value={v}
        onChange={setV}
        action={
          <Button busy={send.isPending || rc.isLoading} disabled={!v} onClick={() => send.sendTransaction({ to: vault, value: parseEther(v) })}>
            Fund
          </Button>
        }
      />
      {send.data && (
        <p className="text-sm text-muted">
          {rc.isSuccess ? "Confirmed" : "Pending"} · <TxLink hash={send.data} />
        </p>
      )}
      {send.error && <p className="rounded-lg bg-bad-wash px-3 py-2 text-sm text-bad">{errorText(send.error)}</p>}
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
          <Button busy={t.busy} disabled={!v} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "withdrawMUSDBuffer", args: [parseEther(v), me!] })}>
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
          <Button busy={t.busy} disabled={!v} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "repay", args: [parseEther(v), Z, Z] })}>
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
  const [days, setDays] = useState("30")
  const { data: fits } = useReadContract({
    address: vault,
    abi: parVaultAbi,
    functionName: "health",
    args: [cap ? parseEther(cap) : 0n],
    query: { enabled: !!cap },
  })
  const t = useTx(onDone)
  const expiry = useMemo(() => BigInt(Math.floor(Date.now() / 1000) + Number(days || 0) * 86400), [days])
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Pledge a credit line to Par Circuit to join a trade circle. It can only be drawn to settle what you owe at cycle end. Then send the circle admin
        your vault address and the line number.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Line" hint={`Room: ${fmtMusd(headroom, 0)} MUSD`}>
          <input className={inputCls} value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <Field label="Expires in (days)">
          <input className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} />
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
          disabled={!fits?.[0] || CIRCUIT === Z}
          onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "createClearingLine", args: [CIRCUIT, parseEther(cap), expiry] })}
        >
          Pledge line
        </Button>
      </div>
      <TxStatus tx={t} />
    </div>
  )
}

"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { formatEther, parseEther, type Address } from "viem"
import { useBalance, useReadContract, useSendTransaction, useWaitForTransactionReceipt } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { parFactoryAbi, parVaultAbi } from "@/lib/abi"
import { CIRCUIT, FACTORY, addrUrl } from "@/lib/config"
import { fmtBps, fmtBtc, fmtDate, fmtMusd, fmtPct, fmtRatio, fmtUsd, short, toNum } from "@/lib/format"
import { KIND_LABEL, errorText, useChainNow, useCommitments, useMarket, useMe, useProtocol, useTx, useVault, useVaultsOf } from "@/lib/hooks"
import { liquidationPrice, maxDrop, openPreview } from "@/lib/risk"
import { Addr, Badge, Button, Card, CardTitle, Empty, Field, HealthGauge, LinkButton, PageHead, Stat, TxLink, TxStatus, inputCls } from "@/components/ui"

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

  if (!isConnected)
    return (
      <Empty>
        <p className="mb-4">Connect a Bitcoin wallet (Xverse, Unisat, OKX) through Mezo Passport, or any EVM wallet.</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </Empty>
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <PageHead index="01" eyebrow="Vault" title="Your vault" sub="One trove, many promises. Capacity and rate are fixed at open; health is re-checked on every action." />
        {vaults.length > 1 && (
          <select
            className={inputCls + " w-auto"}
            value={selected}
            onChange={(e) => router.push(`/vault?v=${e.target.value}`)}
          >
            {vaults.map((v, i) => (
              <option key={v} value={v}>
                Vault {i + 1} · {short(v)}
              </option>
            ))}
          </select>
        )}
      </div>
      {vaults.length === 0 ? (
        <CreateVault onDone={refetch} />
      ) : !data ? (
        <Card>Loading vault…</Card>
      ) : !data.troveActive ? (
        <OpenTrove vault={selected!} onDone={refetchVault} />
      ) : (
        <Dashboard vault={selected!} />
      )}
      {vaults.length > 0 && (
        <CreateVault onDone={refetch} secondary />
      )}
    </div>
  )
}

function CreateVault({ onDone, secondary }: { onDone: () => void; secondary?: boolean }) {
  const tx = useTx(() => onDone())
  if (secondary)
    return (
      <div className="text-right text-xs text-ink-400">
        One vault holds one trove.{" "}
        <button className="text-btc hover:underline" onClick={() => tx.send({ address: FACTORY, abi: parFactoryAbi, functionName: "createVault" })}>
          Create another vault
        </button>
        <TxStatus tx={tx} />
      </div>
    )
  return (
    <Card className="flex flex-col items-start gap-4">
      <CardTitle index="01">Create your Par vault</CardTitle>
      <p className="text-ink-300">
        A vault is your own contract (an EIP-1167 clone). It owns a MUSD trove on Mezo and holds your promises. Only you
        control it.
      </p>
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
  const [btc, setBtc] = useState("0.1")
  const [seed, setSeed] = useState("")
  const seedWei = seed ? parseEther(seed) : m.minNetDebt
  const collWei = btc ? parseEther(btc) : 0n
  const max = bal ? Math.max(0.001, Number(formatEther(bal.value)) * 0.98) : 1
  const pv = p && m.price ? openPreview(collWei, m.price, seedWei, p.stressBps, p.targetIcr) : undefined
  const tx = useTx(() => onDone())

  return (
    <Card className="flex flex-col gap-6">
      <div>
        <CardTitle index="02">Open the trove</CardTitle>
        <p className="mt-1 text-sm text-ink-300">
          Open with <b>all</b> the BTC you intend to pledge. MUSD snapshots your borrowing capacity and locks your rate at open; later
          top-ups add safety, not capacity. The seed draw (MUSD&apos;s minimum loan) stays in the vault as a buffer that pays the first
          claims without new debt.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field label={`Collateral: ${btc || 0} BTC`} hint={bal ? `Wallet: ${fmtBtc(bal.value)} BTC` : undefined}>
            <input
              type="range"
              min={0.001}
              max={max}
              step={0.001}
              value={btc || 0}
              onChange={(e) => setBtc(e.target.value)}
              className="accent-btc"
            />
            <input className={inputCls} value={btc} onChange={(e) => setBtc(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Seed draw (MUSD)" hint={`Minimum net debt: ${fmtMusd(m.minNetDebt, 0)} MUSD`}>
            <input className={inputCls} placeholder={formatEther(m.minNetDebt)} value={seed} onChange={(e) => setSeed(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-5 rounded-[3px] border border-ink-700 bg-ink-950/60 p-5">
          <Stat label="Collateral value" value={pv ? fmtUsd(toNum(pv.value)) : "–"} />
          <Stat label="Rate locked at" value={m.globalRate !== undefined ? fmtBps(m.globalRate) : "–"} sub="fixed for the whole capacity" />
          <Stat label="Capacity snapshot" value={fmtMusd(pv?.capacity, 0)} unit="MUSD" sub="coll × price / 1.1" />
          <Stat label="Opening debt" value={fmtMusd(pv?.debt, 1)} unit="MUSD" sub="seed + 0.1% fee + 200 gas comp" />
          <Stat label="Cover you can promise" value={fmtMusd(pv?.maxCover, 0)} unit="MUSD" tone="btc" sub={p ? `survives a ${Number(p.stressBps) / 100}% BTC drop` : ""} />
          <Stat label="Payable in practice" value={fmtMusd(pv?.payable, 0)} unit="MUSD" sub="cover + seed buffer" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Button
          busy={tx.busy}
          disabled={!collWei || (pv && pv.icr < 1_100_000_000_000_000_000n)}
          onClick={() =>
            tx.send({ address: vault, abi: parVaultAbi, functionName: "openTrove", args: [seedWei, Z, Z], value: collWei })
          }
        >
          Open trove with {btc} BTC
        </Button>
        <TxStatus tx={tx} />
      </div>
    </Card>
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

  return (
    <div className="flex flex-col gap-6">
      {m.recoveryMode && <RecoveryBanner vault={vault} reserved={v.reserved} buffer={v.buffer} price={m.price} idle={v.idleBtc} />}
      {!v.healthOk && (
        <div className="rounded-[3px] border border-bad/40 bg-bad/10 p-4 text-sm text-bad">
          Under-reserved: at today&apos;s price this vault no longer passes the stress test. Existing promises are still honored, but no new
          ones can be made and collateral can&apos;t be withdrawn. Top up to restore health.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-2xl"><span className="mr-3 font-mono text-[11px] text-btc">01</span>Trove</h2>
            <a href={addrUrl(vault)} target="_blank" rel="noreferrer" className="num text-xs text-ink-400 hover:text-btc">
              {short(vault)} ↗
            </a>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Stat label="Collateral" value={fmtBtc(v.coll)} unit="BTC" sub={m.price ? fmtUsd(toNum(v.coll) * toNum(m.price)) : undefined} tone="btc" />
            <Stat label="Debt" value={fmtMusd(v.debt)} unit="MUSD" sub="principal + interest" />
            <Stat label="Buffer" value={fmtMusd(v.buffer)} unit="MUSD" sub="pays claims before any new debt" />
            <Stat label="Capacity snapshot" value={fmtMusd(v.capacity, 0)} unit="MUSD" sub="max debt, fixed at open" />
            <Stat label="Locked rate" value={v.rate !== undefined ? fmtBps(v.rate) : "–"} sub="simple interest, drawn principal only" />
            <Stat label="Idle BTC reserve" value={fmtBtc(v.idleBtc, 6)} unit="BTC" sub="for Recovery Mode draws" />
          </div>
        </Card>
        <Card>
          <CardTitle index="02">Promises</CardTitle>
          <div className="flex flex-col gap-4">
            <Stat label="Reserved" value={fmtMusd(v.reserved, 0)} unit="MUSD" sub="undrawn capacity pledged" />
            <HealthGauge stressedIcr={v.stressedIcr} target={p.targetIcr} ok={v.healthOk} />
            <div className="grid grid-cols-2 gap-4">
              <Stat label="Stressed ICR" value={fmtRatio(v.stressedIcr)} tone={v.healthOk ? "ok" : "bad"} sub={`BTC −${Number(p.stressBps) / 100}%, all called`} />
              <Stat label="Headroom" value={fmtMusd(v.headroom, 0)} unit="MUSD" sub="under capacity" />
              <Stat label="Covered if BTC falls" value={fmtPct(drop)} tone="btc" sub="ICR stays ≥ 150%" />
              <Stat label="Liquidation below" value={fmtUsd(toNum(liq))} sub="if every promise is called" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl"><span className="mr-3 font-mono text-[11px] text-btc">03</span>Commitments</h2>
          {isOwner && (
            <LinkButton href={`/vault/new-guarantee?v=${vault}`} variant="ghost">
              + New guarantee
            </LinkButton>
          )}
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-ink-400">No promises yet. Nothing is borrowed and no interest is paid on a commitment until it&apos;s called.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-400">
                <tr>
                  <th className="py-2">#</th>
                  <th>Type</th>
                  <th>Beneficiary</th>
                  <th className="text-right">Cover</th>
                  <th className="text-right">Paid out</th>
                  <th>Expiry</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list
                  .slice()
                  .reverse()
                  .map((c) => {
                    const expired = Number(c.expiry) < now
                    return (
                      <tr key={String(c.id)} className="border-t border-ink-800">
                        <td className="num py-2.5">{String(c.id)}</td>
                        <td>{KIND_LABEL[c.kind]}</td>
                        <td>
                          <Addr a={c.beneficiary} label={c.beneficiary === CIRCUIT ? "Par Circuit" : undefined} />
                        </td>
                        <td className="num text-right">{fmtMusd(c.cap, 0)}</td>
                        <td className="num text-right">{fmtMusd(c.paidOut, 0)}</td>
                        <td className="num text-xs text-ink-300">{fmtDate(c.expiry)}</td>
                        <td>
                          {c.status === 1 && !expired ? <Badge tone="ok">Active</Badge> : c.status === 1 ? <Badge tone="warn">Expired</Badge> : <Badge tone="muted">Closed</Badge>}
                        </td>
                        <td className="text-right">
                          <Link className="text-btc hover:underline" href={`/c/${vault}/${c.id}`}>
                            Certificate →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isOwner && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Manage vault={vault} buffer={v.buffer} idle={v.idleBtc} onDone={refreshAll} />
          <ClearingLineForm vault={vault} onDone={refreshAll} headroomHint={v.headroom} />
        </div>
      )}
    </div>
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
    <div className="rounded-[3px] border border-warn/40 bg-warn/10 p-4 text-sm text-warn">
      <b>Mezo is in Recovery Mode.</b> MUSD only lets debt rise alongside a collateral top-up that improves the ratio. Promises stay
      valid; to pay {fmtMusd(draw, 0)} MUSD beyond the buffer this vault needs {need !== undefined ? fmtBtc(need, 6) : "…"} BTC of idle
      reserve (it has {fmtBtc(idle, 6)}). Fund it below; the keeper retries automatically.
    </div>
  )
}

function Manage({ vault, buffer, idle, onDone }: { vault: Address; buffer: bigint; idle: bigint; onDone: () => void }) {
  const { me } = useMe()
  const [topUp, setTopUp] = useState("")
  const [reserve, setReserve] = useState("")
  const [out, setOut] = useState("")
  const [repay, setRepay] = useState("")
  const tTop = useTx(onDone)
  const tOut = useTx(onDone)
  const tRepay = useTx(onDone)
  const tIdle = useTx(onDone)
  const send = useSendTransaction()
  const sendRc = useWaitForTransactionReceipt({ hash: send.data })
  useEffect(() => {
    if (sendRc.isSuccess) {
      setReserve("")
      onDone()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendRc.isSuccess])

  return (
    <Card className="flex flex-col gap-5">
      <CardTitle index="04">Manage</CardTitle>
      <Row label="Top up collateral (adds safety, not capacity)">
        <input className={inputCls} placeholder="BTC" value={topUp} onChange={(e) => setTopUp(e.target.value)} />
        <Button busy={tTop.busy} disabled={!topUp} onClick={() => tx(tTop, { address: vault, abi: parVaultAbi, functionName: "topUp", args: [Z, Z], value: parseEther(topUp) })}>
          Top up
        </Button>
      </Row>
      <TxStatus tx={tTop} />
      <Row label="Fund Recovery Mode reserve (idle BTC in the vault)">
        <input className={inputCls} placeholder="BTC" value={reserve} onChange={(e) => setReserve(e.target.value)} />
        <Button busy={send.isPending || sendRc.isLoading} disabled={!reserve} onClick={() => send.sendTransaction({ to: vault, value: parseEther(reserve) })}>
          Fund
        </Button>
      </Row>
      {send.data && <p className="text-sm text-ink-300"><TxLink hash={send.data} /></p>}
      {send.error && <p className="text-sm text-bad">{errorText(send.error)}</p>}
      {idle > 0n && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-400">Idle reserve: {fmtBtc(idle, 6)} BTC</span>
          <Button variant="ghost" busy={tIdle.busy} onClick={() => tx(tIdle, { address: vault, abi: parVaultAbi, functionName: "withdrawIdleBTC", args: [idle] })}>
            Withdraw reserve
          </Button>
        </div>
      )}
      <Row label={`Withdraw buffer MUSD (balance ${fmtMusd(buffer)})`}>
        <input className={inputCls} placeholder="MUSD" value={out} onChange={(e) => setOut(e.target.value)} />
        <Button variant="ghost" busy={tOut.busy} disabled={!out} onClick={() => tx(tOut, { address: vault, abi: parVaultAbi, functionName: "withdrawMUSDBuffer", args: [parseEther(out), me!] })}>
          Withdraw
        </Button>
      </Row>
      <TxStatus tx={tOut} />
      <Row label="Repay debt from the vault's MUSD">
        <input className={inputCls} placeholder="MUSD" value={repay} onChange={(e) => setRepay(e.target.value)} />
        <Button variant="ghost" busy={tRepay.busy} disabled={!repay} onClick={() => tx(tRepay, { address: vault, abi: parVaultAbi, functionName: "repay", args: [parseEther(repay), Z, Z] })}>
          Repay
        </Button>
      </Row>
      <TxStatus tx={tRepay} />
    </Card>
  )
}

function tx(t: ReturnType<typeof useTx>, args: any) {
  return t.send(args)
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs uppercase tracking-wider text-ink-400">{label}</span>
      <div className="flex gap-2">{children}</div>
    </div>
  )
}

function ClearingLineForm({ vault, onDone, headroomHint }: { vault: Address; onDone: () => void; headroomHint: bigint }) {
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
    <Card className="flex flex-col gap-4">
      <CardTitle index="05">Pledge a Circuit clearing line</CardTitle>
      <p className="text-sm text-ink-300">
        Join a trade circle: pledge a credit line to the Par Circuit contract. It can only draw this line to force-settle what you
        owe at cycle end. Then ask the circle admin to add you with this vault and the line id.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Line (MUSD)">
          <input className={inputCls} value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
        <Field label="Expires in (days)">
          <input className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} />
        </Field>
      </div>
      {fits && (
        <p className={`text-sm ${fits[0] ? "text-ok" : "text-bad"}`}>
          {fits[0] ? `Fits · stressed ICR ${fmtRatio(fits[1])}` : `Doesn't fit · stressed ICR would be ${fmtRatio(fits[1])}`}
        </p>
      )}
      <Button
        busy={t.busy}
        disabled={!fits?.[0] || CIRCUIT === Z}
        onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "createClearingLine", args: [CIRCUIT, parseEther(cap), expiry] })}
      >
        Pledge line
      </Button>
      <TxStatus tx={t} />
      <p className="text-xs text-ink-400">Headroom under capacity: {fmtMusd(headroomHint, 0)} MUSD</p>
    </Card>
  )
}

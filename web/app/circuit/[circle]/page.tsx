"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { isAddress, type Address } from "viem"
import { useReadContract } from "wagmi"
import { parCircuitAbi } from "@/lib/abi"
import { CIRCUIT } from "@/lib/config"
import { cancellationFrames, useCircle, useInvoices, type Edge } from "@/lib/circuit"
import { erc20Abi } from "@/lib/mezoAbi"
import { fmtBps, fmtDuration, fmtMusd, short, toNum } from "@/lib/format"
import { useChainNow, useMe, useProtocol, useTx } from "@/lib/hooks"
import { CircuitGraph, useTween } from "@/components/CircuitGraph"
import { Addr, Badge, Button, Card, Field, LinkButton, Stat, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address
const NAMES = ["Importer", "Wholesaler", "Repairer", "Shop D", "Shop E", "Shop F", "Shop G", "Shop H"]
const n0 = (x: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(x)

export default function CircleBoard({ params }: { params: { circle: string } }) {
  const circleId = BigInt(params.circle)
  const { invoices, refetch: refetchInv } = useInvoices(circleId)
  const [picked, setPicked] = useState<bigint>()
  const now = useChainNow()

  // Default to the latest cycle that has accepted invoices (so a closed cycle stays in view for settlement).
  const activeCycles = useMemo(() => [...new Set(invoices.filter((i) => i.status === 2).map((i) => i.cycle))].sort((a, b) => Number(a - b)), [invoices])
  const latestActive = activeCycles[activeCycles.length - 1]
  const s = useCircle(circleId, picked ?? latestActive)
  const { me } = useMe()

  const nodes = useMemo(
    () =>
      s.rows.map((r, i) => ({
        id: r.member.toLowerCase(),
        label: NAMES[i] ?? short(r.member),
        sub: `${toNum(r.net) >= 0 ? "+" : ""}${n0(toNum(r.net))}`,
        net: toNum(r.net),
      })),
    [s.rows],
  )
  const edges: Edge[] = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 2 && i.cycle === s.cycle)
        .map((i) => ({ from: i.debtor.toLowerCase(), to: i.creditor.toLowerCase(), amount: toNum(i.amount) })),
    [invoices, s.cycle],
  )

  // ---- clear animation
  const frames = useMemo(() => cancellationFrames(edges), [edges])
  const [phase, setPhase] = useState<"idle" | "clearing" | "netted">("idle")
  const [fi, setFi] = useState(0)
  useEffect(() => {
    setPhase("idle")
    setFi(0)
  }, [s.cycle, edges.length])
  useEffect(() => {
    if (phase !== "clearing") return
    if (fi >= frames.length - 1) {
      const t = setTimeout(() => setPhase("netted"), 900)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setFi((x) => x + 1), 1000)
    return () => clearTimeout(t)
  }, [phase, fi, frames.length])
  const frame = phase === "idle" ? { edges } : frames[Math.min(fi, frames.length - 1)]
  const remaining = phase === "netted" ? toNum(s.totalOwed) : frame.edges.reduce((a, e) => a + e.amount, 0)
  const counter = useTween(remaining)

  const closed = now >= Number(s.close)
  const windowEnd = Number(s.close) + Number(s.circle?.settleWindow ?? 0n)
  const forceable = now >= windowEnd
  const isAdmin = me && s.circle && me.toLowerCase() === s.circle.admin.toLowerCase()
  const meRow = s.rows.find((r) => me && r.member.toLowerCase() === me.toLowerCase())

  const refreshAll = () => {
    s.refetch()
    refetchInv()
  }

  if (!s.circle) return <Card>Loading circle…</Card>
  if (!s.circle.exists) return <Card>No such circle.</Card>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/circuit" className="text-xs text-ink-400 hover:text-white">
            ← circles
          </Link>
          <h1 className="text-2xl font-bold">Circle #{String(circleId)}</h1>
          <p className="text-sm text-ink-400">
            {s.members.length} members · cycle {fmtDuration(Number(s.circle.cycleLength))} · settle window {fmtDuration(Number(s.circle.settleWindow))} · admin{" "}
            <Addr a={s.circle.admin} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={s.cycle === 0n} onClick={() => setPicked(s.cycle - 1n)}>
            ←
          </Button>
          <span className="num text-sm">
            cycle {String(s.cycle)}
            {s.current === s.cycle ? " (current)" : ""}
          </span>
          <Button variant="ghost" disabled={s.current === undefined || s.cycle >= s.current} onClick={() => setPicked(s.cycle + 1n)}>
            →
          </Button>
          <LinkButton href={`/circuit/${circleId}/invoice`}>Invoices</LinkButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CircuitGraph nodes={nodes} edges={frame.edges} highlight={"cycle" in frame ? frame.cycle : undefined} netted={phase === "netted"} fmt={n0} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="num text-lg">
              {phase === "netted" ? (
                <span className="text-btc">
                  {fmtMusd(s.gross, 0)} cleared · {fmtMusd(s.totalOwed, 0)} moved · {fmtBps(s.efficiencyBps)} netted
                </span>
              ) : (
                <>
                  <span className="text-ink-400">needs money: </span>
                  <span>{n0(counter)} MUSD</span>
                  {"removed" in frame && frame.removed ? <span className="ml-2 text-sm text-btc">−{n0(frame.removed)} around a loop</span> : null}
                </>
              )}
            </div>
            <div className="flex gap-2">
              {phase !== "idle" && (
                <Button variant="ghost" onClick={() => (setPhase("idle"), setFi(0))}>
                  Reset
                </Button>
              )}
              <Button disabled={edges.length === 0 || phase === "clearing"} onClick={() => (setFi(0), setPhase("clearing"))}>
                Clear cycle
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="grid grid-cols-2 gap-4">
            <Stat label="Gross invoiced" value={fmtMusd(s.gross, 0)} unit="MUSD" />
            <Stat label="Net owed" value={fmtMusd(s.totalOwed, 0)} unit="MUSD" tone="btc" />
            <Stat label="Netting efficiency" value={fmtBps(s.efficiencyBps)} tone="ok" />
            <Stat label="Collected" value={fmtMusd(s.collected, 0)} unit="MUSD" />
            <div className="col-span-2">
              <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                <div className="h-full bg-ok" style={{ width: `${Number(s.efficiencyBps) / 100}%` }} />
              </div>
            </div>
          </Card>
          <Card className="flex flex-col gap-2 text-sm">
            {!closed ? (
              <>
                <span className="text-ink-400">Cycle closes in</span>
                <span className="num text-3xl">{fmtDuration(Number(s.close) - now)}</span>
                <span className="text-xs text-ink-400">Invoices accepted now net into this cycle.</span>
              </>
            ) : !forceable ? (
              <>
                <span className="text-ink-400">Closed · net debtors settle within</span>
                <span className="num text-3xl text-warn">{fmtDuration(windowEnd - now)}</span>
                <span className="text-xs text-ink-400">After that, anyone can force-settle a debtor from their vault.</span>
              </>
            ) : s.collected >= s.totalOwed ? (
              <>
                <span className="text-ink-400">Cycle settled</span>
                <span className="text-lg text-ok">Every net debtor has paid. Net creditors can claim.</span>
              </>
            ) : (
              <>
                <span className="text-ink-400">Settle window over</span>
                <span className="text-lg text-bad">Unpaid debtors can be force-settled</span>
              </>
            )}
          </Card>
          {meRow && <MyPosition circleId={circleId} cycle={s.cycle} row={meRow} closed={closed} canClaim={s.collected >= s.totalOwed} onDone={refreshAll} />}
        </div>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Members</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-ink-400">
              <tr>
                <th className="py-2">Member</th>
                <th>Vault · line</th>
                <th className="text-right">Line available</th>
                <th className="text-right">Net this cycle</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => (
                <MemberRow key={r.member} i={i} r={r} circleId={circleId} cycle={s.cycle} forceable={closed && forceable} onDone={refreshAll} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isAdmin && <AddMember circleId={circleId} onDone={refreshAll} />}
    </div>
  )
}

function MemberRow({ i, r, circleId, cycle, forceable, onDone }: { i: number; r: any; circleId: bigint; cycle: bigint; forceable: boolean; onDone: () => void }) {
  const t = useTx(onDone)
  const net = r.net as bigint
  return (
    <tr className="border-t border-ink-800">
      <td className="py-2.5">
        <div className="font-semibold">{NAMES[i] ?? "Member"}</div>
        <Addr a={r.member} />
      </td>
      <td>
        <Addr a={r.vault} /> <span className="num text-xs text-ink-400">#{String(r.lineId ?? "")}</span>
      </td>
      <td className="num text-right">{fmtMusd(r.limit, 0)}</td>
      <td className={`num text-right ${net < 0n ? "text-bad" : net > 0n ? "text-ok" : ""}`}>
        {net > 0n ? "+" : ""}
        {fmtMusd(net, 0)}
      </td>
      <td>
        {net < 0n ? r.settled ? <Badge tone="ok">Paid</Badge> : <Badge tone="warn">Owes</Badge> : net > 0n ? r.settled ? <Badge tone="ok">Claimed</Badge> : <Badge tone="btc">Receives</Badge> : <Badge tone="muted">Even</Badge>}
      </td>
      <td className="text-right">
        {net < 0n && !r.settled && forceable && (
          <Button
            variant="danger"
            busy={t.busy}
            onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "forceSettle", args: [circleId, cycle, r.member, Z, Z] })}
          >
            Force-settle
          </Button>
        )}
        <TxStatus tx={t} />
      </td>
    </tr>
  )
}

function MyPosition({ circleId, cycle, row, closed, canClaim, onDone }: { circleId: bigint; cycle: bigint; row: any; closed: boolean; canClaim: boolean; onDone: () => void }) {
  const { me } = useMe()
  const p = useProtocol()
  const net = row.net as bigint
  const owed = net < 0n ? -net : 0n
  const { data: allowance, refetch } = useReadContract({
    address: p?.musd,
    abi: erc20Abi,
    functionName: "allowance",
    args: [me ?? Z, CIRCUIT],
    query: { enabled: !!me && !!p && owed > 0n },
  })
  const { data: bal } = useReadContract({ address: p?.musd, abi: erc20Abi, functionName: "balanceOf", args: [me ?? Z], query: { enabled: !!me && !!p } })
  const tA = useTx(() => refetch())
  const t = useTx(onDone)
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <h3 className="font-semibold">Your position</h3>
      <div className={`num text-2xl ${net < 0n ? "text-bad" : net > 0n ? "text-ok" : ""}`}>
        {net > 0n ? "+" : ""}
        {fmtMusd(net)} MUSD
      </div>
      {net < 0n && !row.settled && (
        <>
          <p className="text-xs text-ink-400">
            {closed ? "Settle now to avoid a forced draw on your clearing line." : "You can settle once the cycle closes."} Your MUSD: {fmtMusd(bal)}. Need MUSD? Withdraw
            it from your vault&apos;s buffer on the Vault page.
          </p>
          <div className="flex gap-2">
            {(allowance ?? 0n) < owed && (
              <Button variant="ghost" busy={tA.busy} onClick={() => tA.send({ address: p!.musd, abi: erc20Abi, functionName: "approve", args: [CIRCUIT, owed] })}>
                Approve
              </Button>
            )}
            <Button
              busy={t.busy}
              disabled={!closed || (allowance ?? 0n) < owed}
              onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "settle", args: [circleId, cycle] })}
            >
              Settle {fmtMusd(owed, 0)}
            </Button>
          </div>
        </>
      )}
      {net > 0n && !row.settled && (
        <Button
          busy={t.busy}
          disabled={!closed || !canClaim}
          onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "claim", args: [circleId, cycle] })}
        >
          {canClaim ? `Claim ${fmtMusd(net, 0)} MUSD` : "Claim (waiting for debtors)"}
        </Button>
      )}
      {row.settled && <Badge tone="ok">Done for this cycle</Badge>}
      <TxStatus tx={tA} />
      <TxStatus tx={t} />
    </Card>
  )
}

function AddMember({ circleId, onDone }: { circleId: bigint; onDone: () => void }) {
  const [member, setMember] = useState("")
  const [vault, setVault] = useState("")
  const [line, setLine] = useState("0")
  const t = useTx(onDone)
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-semibold">Add a member (admin)</h2>
      <p className="text-sm text-ink-400">The member must own the vault, and the vault must hold an active clearing line pointed at Par Circuit.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Member address">
          <input className={inputCls} value={member} onChange={(e) => setMember(e.target.value)} placeholder="0x…" />
        </Field>
        <Field label="Vault">
          <input className={inputCls} value={vault} onChange={(e) => setVault(e.target.value)} placeholder="0x…" />
        </Field>
        <Field label="Line id">
          <input className={inputCls} value={line} onChange={(e) => setLine(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button
          busy={t.busy}
          disabled={!isAddress(member) || !isAddress(vault)}
          onClick={() =>
            t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "addMember", args: [circleId, member as Address, vault as Address, BigInt(line || "0")] })
          }
        >
          Add member
        </Button>
      </div>
      <TxStatus tx={t} />
    </Card>
  )
}

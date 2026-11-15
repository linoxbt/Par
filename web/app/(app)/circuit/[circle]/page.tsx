"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { isAddress, type Address } from "viem"
import { useReadContract } from "wagmi"
import { parCircuitAbi } from "@/lib/abi"
import { CIRCUIT } from "@/lib/config"
import { cancellationFrames, useCircle, useInvoices, type Edge } from "@/lib/circuit"
import { erc20Abi } from "@/lib/mezoAbi"
import { fmtBps, fmtDate, fmtDuration, fmtMusd, parseId, parseIntSafe, short, toNum } from "@/lib/format"
import { useChainNow, useMe, useProtocol, useTx } from "@/lib/hooks"
import { CircuitGraph, useTween } from "@/components/CircuitGraph"
import { Addr, Badge, Button, Card, CardTitle, Field, LinkButton, Meter, Problem, Stat, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address
/** Members are labelled by join order (names aren't stored onchain); the address is always shown too. */
const label = (i: number) => `Member ${String.fromCharCode(65 + (i % 26))}`
const n0 = (x: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(x)

export default function CircleBoardPage({ params }: { params: { circle: string } }) {
  const circleId = parseId(params.circle)
  if (circleId === undefined)
    return (
      <Problem title="This isn't a valid circle link" action={{ href: "/circuit", label: "All circles" }}>
        Circle links look like /circuit/&lt;number&gt;.
      </Problem>
    )
  return <CircleBoard circleId={circleId} />
}

function CircleBoard({ circleId }: { circleId: bigint }) {
  const { invoices, error: invError, refetch: refetchInv } = useInvoices(circleId)
  const [picked, setPicked] = useState<bigint>()
  const now = useChainNow()

  // Default to the latest cycle that has accepted invoices (so a closed cycle stays in view for settlement).
  const activeCycles = useMemo(() => [...new Set(invoices.filter((i) => i.status === 2).map((i) => i.cycle))].sort((a, b) => Number(a - b)), [invoices])
  const latestActive = activeCycles[activeCycles.length - 1]
  const { me } = useMe()
  const s = useCircle(circleId, picked ?? latestActive, me)

  const nodes = useMemo(
    () =>
      s.rows.map((r, i) => ({
        id: r.member.toLowerCase(),
        label: label(i),
        sub: `${toNum(r.net) >= 0 ? "+" : ""}${n0(toNum(r.net))}`,
        net: toNum(r.net),
      })),
    [s.rows],
  )
  const edges: Edge[] = useMemo(
    () => {
      // one edge per debtor -> creditor pair, summing every accepted invoice between them
      const m = new Map<string, Edge>()
      for (const i of invoices) {
        if (i.status !== 2 || i.cycle !== s.cycle) continue
        const from = i.debtor.toLowerCase()
        const to = i.creditor.toLowerCase()
        const e = m.get(`${from}->${to}`)
        if (e) e.amount += toNum(i.amount)
        else m.set(`${from}->${to}`, { from, to, amount: toNum(i.amount) })
      }
      // invoices can load before the member list: only draw edges between known nodes
      const known = new Set(nodes.map((n) => n.id))
      return [...m.values()].filter((e) => known.has(e.from) && known.has(e.to))
    },
    [invoices, s.cycle, nodes],
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

  if (s.error && !s.circle)
    return (
      <Problem title="Couldn't load this circle" action={{ href: "/circuit", label: "All circles" }}>
        The network didn&apos;t answer. Check your connection and reload.
      </Problem>
    )
  if (!s.circle) return <Card>Loading circle…</Card>
  if (!s.circle.exists)
    return (
      <Problem title={`Circle #${String(circleId)} doesn't exist`} action={{ href: "/circuit", label: "All circles" }}>
        No circle with this number has been created on this network.
      </Problem>
    )
  const final = now >= Number(s.finalAt)

  return (
    <div className="flex flex-col gap-6">
      {invError && <p className="rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">Invoices may be out of date: {invError}. Retrying…</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/circuit" className="text-xs text-muted hover:text-fg">
            ← All circles
          </Link>
          <h1 className="h-display mt-2 text-4xl">Circle #{String(circleId)}</h1>
          <p className="text-sm text-muted">
            {s.members.length} members · cycle {fmtDuration(Number(s.circle.cycleLength))} · settle window {fmtDuration(Number(s.circle.settleWindow))} · admin{" "}
            <Addr a={s.circle.admin} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-white p-1 shadow-card">
            <button className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-soft disabled:opacity-30" disabled={s.cycle === 0n} onClick={() => setPicked(s.cycle - 1n)}>
              ←
            </button>
            <span className="num px-2 text-sm">
              Cycle {String(s.cycle)}
              {s.current === s.cycle ? <span className="text-subtle"> · now</span> : ""}
            </span>
            <button
              className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-soft disabled:opacity-30"
              disabled={s.current === undefined || s.cycle >= s.current}
              onClick={() => setPicked(s.cycle + 1n)}
            >
              →
            </button>
          </div>
          <LinkButton href={`/circuit/${circleId}/invoice`}>Invoices</LinkButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CircuitGraph nodes={nodes} edges={frame.edges} highlight={"cycle" in frame ? frame.cycle : undefined} netted={phase === "netted"} fmt={n0} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div className="num text-base">
              {phase === "netted" ? (
                <span className="text-btc-ink">
                  {fmtMusd(s.gross, 0)} cleared · {fmtMusd(s.totalOwed, 0)} moved · {fmtBps(s.efficiencyBps)} netted
                </span>
              ) : (
                <>
                  <span className="text-muted">needs money: </span>
                  <span>{n0(counter)} MUSD</span>
                  {"removed" in frame && frame.removed ? <span className="ml-2 text-sm text-btc-ink">−{n0(frame.removed)} around a loop</span> : null}
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
              <Meter value={Number(s.efficiencyBps) / 100} tone="btc" />
            </div>
          </Card>
          <Card className="flex flex-col gap-2 text-sm">
            {!closed ? (
              <>
                <span className="text-muted">Cycle closes in</span>
                <span className="num text-4xl font-medium tracking-tight">{fmtDuration(Number(s.close) - now)}</span>
                <span className="text-xs text-muted">Invoices accepted now net into this cycle.</span>
              </>
            ) : !forceable ? (
              <>
                <span className="text-muted">Closed · net debtors settle within</span>
                <span className="num text-4xl font-medium tracking-tight text-warn">{fmtDuration(windowEnd - now)}</span>
                <span className="text-xs text-muted">After that, anyone can force-settle a debtor from their vault.</span>
              </>
            ) : s.collected < s.totalOwed && final ? (
              <>
                <span className="text-muted">Cycle finalised</span>
                <span className="text-lg text-warn">Some debt is still unpaid. Creditors can claim their share now and again if late payments arrive.</span>
              </>
            ) : s.collected >= s.totalOwed ? (
              <>
                <span className="text-muted">Cycle settled</span>
                <span className="text-lg text-ok">Every net debtor has paid. Net creditors can claim.</span>
              </>
            ) : (
              <>
                <span className="text-muted">Settle window over</span>
                <span className="text-lg text-bad">Unpaid debtors can be force-settled</span>
              </>
            )}
          </Card>
          {s.invite && <JoinCard circleId={circleId} invite={s.invite} onDone={refreshAll} />}
          {meRow && (
            <MyPosition
              circleId={circleId}
              cycle={s.cycle}
              row={meRow}
              closed={closed}
              full={s.collected >= s.totalOwed}
              final={final}
              finalAt={s.finalAt}
              collected={s.collected}
              totalOwed={s.totalOwed}
              onDone={refreshAll}
            />
          )}
        </div>
      </div>

      <Card>
        <CardTitle>Members</CardTitle>
        {/* phones: one card per member so Net / Status / Force-settle are never off-screen */}
        <div className="flex flex-col gap-3 sm:hidden">
          {s.rows.map((r, i) => (
            <MemberCard key={r.member} i={i} r={r} circleId={circleId} cycle={s.cycle} forceable={closed && forceable} isAdmin={!!isAdmin} onDone={refreshAll} />
          ))}
        </div>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="text-left text-xs font-medium text-muted">
              <tr>
                <th className="py-2">Member</th>
                <th>Vault · line</th>
                <th className="text-right">Line available</th>
                <th className="pr-6 text-right">Net this cycle</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.rows.map((r, i) => (
                <MemberRow key={r.member} i={i} r={r} circleId={circleId} cycle={s.cycle} forceable={closed && forceable} isAdmin={!!isAdmin} onDone={refreshAll} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {isAdmin && <AddMember circleId={circleId} onDone={refreshAll} />}
    </div>
  )
}

function status(r: any) {
  const net = r.net as bigint
  if (!r.active) return <Badge tone="muted">Removed</Badge>
  if (r.suspended && (r.net as bigint) === 0n) return <Badge tone="bad">Suspended</Badge>
  if (net < 0n) return r.settled ? <Badge tone="ok">Paid</Badge> : <Badge tone="warn">Owes</Badge>
  if (net > 0n) return r.settled ? <Badge tone="ok">Claimed</Badge> : r.claimed > 0n ? <Badge tone="btc">Partly claimed</Badge> : <Badge tone="btc">Receives</Badge>
  return <Badge tone="muted">Even</Badge>
}

function useMemberActions(circleId: bigint, cycle: bigint, r: any, onDone: () => void) {
  const t = useTx(onDone)
  const force = () => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "forceSettle", args: [circleId, cycle, r.member, Z, Z] })
  const remove = () => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "removeMember", args: [circleId, r.member] })
  const suspend = () => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "setSuspended", args: [circleId, r.member, !r.suspended] })
  return { t, force, remove, suspend }
}

function MemberRow({ i, r, circleId, cycle, forceable, isAdmin, onDone }: { i: number; r: any; circleId: bigint; cycle: bigint; forceable: boolean; isAdmin: boolean; onDone: () => void }) {
  const { t, force, remove, suspend } = useMemberActions(circleId, cycle, r, onDone)
  const net = r.net as bigint
  return (
    <tr className="border-t border-line">
      <td className="py-2.5">
        <div className="font-semibold">{label(i)}</div>
        <Addr a={r.member} />
      </td>
      <td>
        <Addr a={r.vault} /> <span className="num text-xs text-muted">#{String(r.lineId ?? "")}</span>
      </td>
      <td className="num text-right">{fmtMusd(r.limit, 0)}</td>
      <td className={`num pr-6 text-right ${net < 0n ? "text-bad" : net > 0n ? "text-ok" : ""}`}>
        {net > 0n ? "+" : ""}
        {fmtMusd(net, 0)}
      </td>
      <td>{status(r)}</td>
      <td className="text-right">
        <div className="flex justify-end gap-2">
          {net < 0n && !r.settled && forceable && (
            <Button variant="danger" size="sm" busy={t.busy} onClick={force}>
              Force-settle
            </Button>
          )}
          {isAdmin && r.active && (
            <Button variant="ghost" size="sm" busy={t.busy} onClick={suspend}>
              {r.suspended ? "Unsuspend" : "Suspend"}
            </Button>
          )}
          {isAdmin && r.active && net === 0n && (
            <Button variant="ghost" size="sm" busy={t.busy} onClick={remove}>
              Remove
            </Button>
          )}
        </div>
        <TxStatus tx={t} />
      </td>
    </tr>
  )
}

function MemberCard({ i, r, circleId, cycle, forceable, isAdmin, onDone }: { i: number; r: any; circleId: bigint; cycle: bigint; forceable: boolean; isAdmin: boolean; onDone: () => void }) {
  const { t, force, remove, suspend } = useMemberActions(circleId, cycle, r, onDone)
  const net = r.net as bigint
  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{label(i)}</div>
          <Addr a={r.member} />
        </div>
        {status(r)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-muted">Net this cycle</div>
          <div className={`num text-lg ${net < 0n ? "text-bad" : net > 0n ? "text-ok" : ""}`}>
            {net > 0n ? "+" : ""}
            {fmtMusd(net, 0)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted">Line available</div>
          <div className="num text-lg">{fmtMusd(r.limit, 0)}</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-muted">
        Vault <Addr a={r.vault} /> · line #{String(r.lineId ?? "")}
      </div>
      {(net < 0n && !r.settled && forceable) || (isAdmin && r.active) ? (
        <div className="mt-3 flex gap-2">
          {net < 0n && !r.settled && forceable && (
            <Button variant="danger" busy={t.busy} onClick={force} className="flex-1">
              Force-settle
            </Button>
          )}
          {isAdmin && r.active && (
            <Button variant="ghost" busy={t.busy} onClick={suspend} className="flex-1">
              {r.suspended ? "Unsuspend" : "Suspend"}
            </Button>
          )}
          {isAdmin && r.active && net === 0n && (
            <Button variant="ghost" busy={t.busy} onClick={remove} className="flex-1">
              Remove
            </Button>
          )}
        </div>
      ) : null}
      <TxStatus tx={t} />
    </div>
  )
}

/** The admin invited you: joining pledges the named clearing line to this circle. */
function JoinCard({ circleId, invite, onDone }: { circleId: bigint; invite: { vault: Address; lineId: bigint }; onDone: () => void }) {
  const t = useTx(onDone)
  return (
    <Card className="flex flex-col gap-3 border-btc-line bg-btc-wash text-sm">
      <div className="label">You&apos;re invited</div>
      <p className="text-fg/80">
        The admin invited you to join with clearing line #{String(invite.lineId)} of vault <Addr a={invite.vault} />. Joining lets members bill you; at each cycle end
        you settle your net, or it is drawn from that line.
      </p>
      <div>
        <Button busy={t.busy} onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "join", args: [circleId, invite.vault, invite.lineId] })}>
          Join circle
        </Button>
      </div>
      <TxStatus tx={t} />
    </Card>
  )
}

function MyPosition({
  circleId,
  cycle,
  row,
  closed,
  full,
  final,
  finalAt,
  collected,
  totalOwed,
  onDone,
}: {
  circleId: bigint
  cycle: bigint
  row: any
  closed: boolean
  full: boolean
  final: boolean
  finalAt: bigint
  collected: bigint
  totalOwed: bigint
  onDone: () => void
}) {
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
  const tLeave = useTx(onDone)
  return (
    <Card className="flex flex-col gap-3 text-sm">
      <div className="label">Your position</div>
      <div className={`num text-2xl ${net < 0n ? "text-bad" : net > 0n ? "text-ok" : ""}`}>
        {net > 0n ? "+" : ""}
        {fmtMusd(net)} MUSD
      </div>
      {net < 0n && !row.settled && (
        <>
          <p className="text-xs text-muted">
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
      {net > 0n && !row.settled && (() => {
        // Full claim once every debtor paid. If some never do, the cycle finalises at finalAt and
        // creditors claim pro rata (credit × collected / owed), topping up if late payments arrive.
        const entitled = full ? net : final && totalOwed > 0n ? (net * collected) / totalOwed : 0n
        const due = entitled > row.claimed ? entitled - row.claimed : 0n
        return (
          <>
            {row.claimed > 0n && <p className="text-xs text-muted">Claimed so far: {fmtMusd(row.claimed)} MUSD</p>}
            <Button busy={t.busy} disabled={!closed || due === 0n} onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "claim", args: [circleId, cycle] })}>
              {due > 0n ? `Claim ${fmtMusd(due, 0)} MUSD${full ? "" : " (pro rata)"}` : full ? "Claim" : `Claim (waiting for debtors${final ? "" : ` · pro rata from ${fmtDate(finalAt)}`})`}
            </Button>
          </>
        )
      })()}
      {row.settled && <Badge tone="ok">Done for this cycle</Badge>}
      {net === 0n && (
        <button
          className="self-start text-xs text-muted underline decoration-line-strong underline-offset-4 hover:text-bad disabled:opacity-40"
          disabled={tLeave.busy}
          onClick={() => tLeave.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "removeMember", args: [circleId, me] })}
        >
          {tLeave.busy ? "Leaving…" : "Leave this circle"}
        </button>
      )}
      <TxStatus tx={tLeave} />
      <TxStatus tx={tA} />
      <TxStatus tx={t} />
    </Card>
  )
}

function AddMember({ circleId, onDone }: { circleId: bigint; onDone: () => void }) {
  const [member, setMember] = useState("")
  const [vault, setVault] = useState("")
  const [line, setLine] = useState("0")
  const lineN = parseIntSafe(line, { min: 0, max: 1_000_000 })
  const t = useTx(() => {
    setMember("")
    setVault("")
    onDone()
  })
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle sub="Invites are consent-based: the member then joins from this page. Their vault must hold an active clearing line pointed at Par Circuit that outlasts this cycle's settle window, and a line can back only one circle.">
        Invite a member
      </CardTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Member address">
          <input className={inputCls} value={member} onChange={(e) => setMember(e.target.value)} placeholder="0x…" />
        </Field>
        <Field label="Their vault">
          <input className={inputCls} value={vault} onChange={(e) => setVault(e.target.value)} placeholder="0x…" />
        </Field>
        <Field label="Line number">
          <input className={inputCls} inputMode="numeric" value={line} onChange={(e) => setLine(e.target.value)} />
        </Field>
      </div>
      <div>
        <Button
          busy={t.busy}
          disabled={!isAddress(member) || !isAddress(vault) || lineN === undefined}
          onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "addMember", args: [circleId, member as Address, vault as Address, BigInt(lineN!)] })}
        >
          Send invite
        </Button>
      </div>
      <TxStatus tx={t} />
    </Card>
  )
}

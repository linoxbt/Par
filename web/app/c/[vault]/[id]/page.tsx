"use client"

import { useMemo, useState } from "react"
import { parseEther, keccak256, toHex, type Address } from "viem"
import { useReadContract, useReadContracts } from "wagmi"
import { parVaultAbi } from "@/lib/abi"
import { CIRCUIT, addrUrl } from "@/lib/config"
import { fmtBtc, fmtDate, fmtDuration, fmtMusd, fmtPct, fmtUsd, short, toNum } from "@/lib/format"
import { KIND_LABEL, useChainNow, useCommitment, useLogs, useMarket, useMe, useTx, useVault } from "@/lib/hooks"
import { maxDrop } from "@/lib/risk"
import { Addr, Badge, Button, Card, CardTitle, Field, Meter, TxLink, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address

export default function Certificate({ params }: { params: { vault: string; id: string } }) {
  const vault = params.vault as Address
  const id = BigInt(params.id)
  const { c, refetch } = useCommitment(vault, id)
  const { data: v } = useVault(vault)
  const m = useMarket()
  const now = useChainNow()
  const allLogs = useLogs(vault, parVaultAbi as any)
  const logs = useMemo(() => (allLogs ?? []).filter((l) => l.args?.id === id), [allLogs, id])

  if (!c || !v) return <div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl border border-line bg-white" />
  if (c.status === 0) return <div className="mx-auto max-w-lg py-20 text-center text-muted">No such guarantee.</div>

  const expired = now > Number(c.expiry)
  const remaining = c.cap - c.paidOut
  const drop = m.price ? maxDrop(v.coll, v.debt, v.reserved, m.price) : 0
  const payouts = logs.filter((l) => l.eventName === "Payout")
  const payments = logs.filter((l) => l.eventName === "InstallmentPaid")
  const moved = payouts.length > 0 || payments.length > 0

  let status: { label: string; tone: "ok" | "warn" | "bad" | "muted"; big: string }
  if (c.status === 1 && !expired) status = { label: "Active", tone: v.healthOk ? "ok" : "warn", big: "Guaranteed" }
  else if (c.status === 1) status = { label: "Expired", tone: "muted", big: "Expired" }
  else if (c.paidOut >= c.cap) status = { label: "Closed", tone: "muted", big: "Paid in full" }
  else status = { label: "Closed", tone: "muted", big: "Released" }

  const share = typeof window !== "undefined" ? window.location.href : ""
  const isCircuit = c.beneficiary.toLowerCase() === CIRCUIT.toLowerCase()
  const remPct = c.cap > 0n ? (toNum(remaining) / toNum(c.cap)) * 100 : 0

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-float">
        <div className="flex items-center justify-between border-b border-line px-6 py-3">
          <span className="flex items-center gap-2 text-xs font-medium">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-fg text-[10px] text-white">P</span>
            Par certificate
          </span>
          <span className="num text-xs text-subtle">
            {short(vault)} · #{String(id)}
          </span>
        </div>
        <div className="px-6 pb-6 pt-8">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg ${
                status.tone === "ok" ? "bg-ok-wash text-ok" : status.tone === "warn" ? "bg-warn-wash text-warn" : "bg-soft text-muted"
              }`}
            >
              {status.tone === "ok" ? "✓" : status.tone === "warn" ? "!" : "–"}
            </span>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-xs text-subtle">{KIND_LABEL[c.kind]}</span>
          </div>
          <h1 className="h-display mt-5 text-5xl">{status.big}</h1>
          <p className="mt-2 text-lg text-muted">
            {c.kind === 0 ? (
              <>
                <span className="num text-fg">{fmtMusd(c.installment, 0)} MUSD</span> × {c.count}, every {fmtDuration(c.period)}
              </>
            ) : c.kind === 1 ? (
              <>
                Up to <span className="num text-fg">{fmtMusd(c.cap, 0)} MUSD</span> on an uncontested claim
              </>
            ) : (
              <>
                A <span className="num text-fg">{fmtMusd(c.cap, 0)} MUSD</span> clearing line
              </>
            )}
          </p>

          <div className="mt-6 rounded-xl bg-soft p-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs text-muted">Cover remaining</div>
                <div className="num mt-0.5 text-3xl font-medium tracking-tight">{fmtMusd(remaining, 0)}</div>
              </div>
              <div className="num text-xs text-subtle">of {fmtMusd(c.cap, 0)} MUSD</div>
            </div>
            <div className="mt-3">
              <Meter value={remPct} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-line p-4">
              <div className="text-xs text-muted">Holds even if BTC falls</div>
              <div className="num mt-0.5 text-2xl font-medium text-btc-ink">{fmtPct(drop)}</div>
            </div>
            <div className="rounded-xl border border-line p-4">
              <div className="text-xs text-muted">Valid until</div>
              <div className="mt-1 text-sm font-medium">{fmtDate(c.expiry)}</div>
            </div>
          </div>

          {!moved && c.status === 1 && (
            <p className="mt-5 flex items-center gap-2 text-sm text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-btc" /> No money has moved. Nothing is borrowed until a payment is missed.
            </p>
          )}
          {!v.healthOk && c.status === 1 && (
            <p className="mt-3 rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">
              The vault is under-reserved at today&apos;s price. This promise is still honored; the owner has been asked to top up.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-line bg-canvas px-6 py-5 text-sm text-muted">
          {c.kind === 0 && (
            <p>
              If <Addr a={c.principal} /> misses a payment to <Addr a={c.beneficiary} />, this vault pays it automatically {fmtDuration(c.grace)} after the due date,
              up to {fmtMusd(c.cap, 0)} MUSD in total. No one has to approve it.
            </p>
          )}
          {c.kind === 1 && (
            <p>
              <Addr a={c.beneficiary} /> can claim up to {fmtMusd(remaining, 0)} MUSD with evidence. If nobody disputes within {fmtDuration(c.challengeWindow)}, it
              pays out. Disputes go to the arbiter <Addr a={c.arbiter} />.
            </p>
          )}
          {c.kind === 2 && (
            <p>
              Pledged to {isCircuit ? "Par Circuit" : <Addr a={c.beneficiary} />}. It can only be drawn to settle what the owner owes at the end of a trade cycle.
            </p>
          )}
          <p>
            Backed by <span className="num text-fg">{fmtBtc(v.coll)} BTC</span>
            {m.price ? <> ({fmtUsd(toNum(v.coll) * toNum(m.price))})</> : null} locked on Mezo in vault <Addr a={vault} />.
          </p>
          <p className="text-xs text-subtle">
            If BTC fell more than {fmtPct(drop)} and every promise this vault backs were called, it could be liquidated and this promise could fail.
          </p>
        </div>
      </article>

      {c.kind === 0 && <Timeline vault={vault} c={c} now={now} logs={logs} />}
      {c.kind === 1 && <ClaimPanel vault={vault} c={c} now={now} onDone={refetch} />}

      <Card>
        <CardTitle>Payout history</CardTitle>
        {payouts.length === 0 ? (
          <p className="text-sm text-muted">No payouts yet.</p>
        ) : (
          <div className="divide-y divide-line">
            {payouts
              .slice()
              .reverse()
              .map((l) => (
                <div key={l.transactionHash} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="num">
                      {fmtMusd(l.args.amount)} MUSD → {short(l.args.to)}
                    </div>
                    <div className="text-xs text-subtle">
                      {fmtMusd(l.args.fromBuffer)} from buffer · <span className="text-btc-ink">{fmtMusd(l.args.minted)} minted</span>
                    </div>
                  </div>
                  <TxLink hash={l.transactionHash} label="explorer" />
                </div>
              ))}
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <a
          className="flex-1 rounded-full bg-[#25D366] px-4 py-3 text-center text-sm font-medium text-white"
          href={`https://wa.me/?text=${encodeURIComponent("Your Par guarantee: " + share)}`}
          target="_blank"
          rel="noreferrer"
        >
          Share on WhatsApp
        </a>
        <a className="rounded-full border border-line-strong bg-white px-4 py-3 text-sm" href={addrUrl(vault)} target="_blank" rel="noreferrer">
          Explorer ↗
        </a>
      </div>
    </div>
  )
}

function Timeline({ vault, c, now, logs }: { vault: Address; c: any; now: number; logs: any[] }) {
  const { data: settled } = useReadContracts({
    contracts: Array.from({ length: c.count }, (_, i) => ({
      address: vault,
      abi: parVaultAbi,
      functionName: "installmentSettled" as const,
      args: [c.id, BigInt(i)] as const,
    })),
    allowFailure: false,
    query: { refetchInterval: 6_000 },
  })
  const paidBy = new Map<number, any>()
  const coveredBy = new Map<number, any>()
  for (const l of logs) {
    if (l.eventName === "InstallmentPaid") paidBy.set(Number(l.args.index), l)
    if (l.eventName === "InstallmentMissed") coveredBy.set(Number(l.args.index), l)
  }
  return (
    <Card>
      <CardTitle>Installments</CardTitle>
      {Array.from({ length: c.count }, (_, i) => {
        const due = Number(c.start) + i * c.period
        const trigger = due + c.grace
        const s = settled?.[i]
        const paid = paidBy.get(i)
        const cov = coveredBy.get(i)
        let label: React.ReactNode
        if (paid) label = <Badge tone="ok">Paid by tenant</Badge>
        else if (cov) label = <Badge tone="btc">Covered by vault</Badge>
        else if (s) label = <Badge tone="ok">Settled</Badge>
        else if (c.status !== 1) label = <Badge tone="muted">–</Badge>
        else if (now > trigger) label = <Badge tone="bad">Missed · paying</Badge>
        else if (now > due) label = <Badge tone="warn">Late · vault pays in {fmtDuration(trigger - now)}</Badge>
        else label = <span className="num text-xs text-subtle">due in {fmtDuration(due - now)}</span>
        const tx = paid ?? cov
        return (
          <div key={i} className="flex items-center justify-between border-t border-line py-2.5 text-sm first:border-t-0">
            <div className="flex items-center gap-3">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${paid || cov || s ? "bg-fg text-white" : "bg-soft text-subtle"}`}>{i + 1}</span>
              <span className="num">{fmtMusd(c.installment, 0)}</span>
              <span className="text-xs text-subtle">{fmtDate(due)}</span>
            </div>
            <div className="flex items-center gap-2">
              {label}
              {tx && <TxLink hash={tx.transactionHash} label="tx" />}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

function ClaimPanel({ vault, c, now, onDone }: { vault: Address; c: any; now: number; onDone: () => void }) {
  const { me } = useMe()
  const { data: pc, refetch } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "pendingClaims", args: [c.id], query: { refetchInterval: 6_000 } })
  const { data: owner } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "owner" })
  const [amount, setAmount] = useState("")
  const [evidence, setEvidence] = useState("")
  const done = () => {
    refetch()
    onDone()
  }
  const t = useTx(done)
  const lc = (a?: string) => a?.toLowerCase()
  const isBen = lc(me) === lc(c.beneficiary)
  const canDispute = lc(me) === lc(c.principal) || lc(me) === lc(owner)
  const isArb = lc(me) === lc(c.arbiter)
  const [pAmount, filedAt, disputed, open] = pc ?? [0n, 0n, false, false]
  const windowEnds = Number(filedAt) + c.challengeWindow

  return (
    <Card className="flex flex-col gap-3 text-sm">
      <CardTitle>Claim</CardTitle>
      {open ? (
        <>
          <p className="text-muted">
            Claim of <span className="num text-fg">{fmtMusd(pAmount)} MUSD</span> filed {fmtDate(filedAt)}.{" "}
            {disputed ? (
              <b className="text-warn">Disputed: waiting for the arbiter.</b>
            ) : now > windowEnds ? (
              <b className="text-ok">Undisputed: ready to pay.</b>
            ) : (
              <>Challenge window ends in {fmtDuration(windowEnds - now)}.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {!disputed && now > windowEnds && (
              <Button busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "executeClaim", args: [c.id, Z, Z] })}>
                Execute claim
              </Button>
            )}
            {!disputed && now <= windowEnds && canDispute && (
              <Button variant="danger" busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "disputeClaim", args: [c.id] })}>
                Dispute
              </Button>
            )}
            {disputed && isArb && (
              <>
                <Button busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "resolveClaim", args: [c.id, true, Z, Z] })}>
                  Approve
                </Button>
                <Button variant="danger" busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "resolveClaim", args: [c.id, false, Z, Z] })}>
                  Reject
                </Button>
              </>
            )}
          </div>
        </>
      ) : isBen && c.status === 1 ? (
        <div className="flex flex-col gap-3">
          <Field label="Amount (MUSD)">
            <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Evidence" hint="A link or IPFS/Walrus CID; its hash is stored onchain.">
            <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </Field>
          <Button
            busy={t.busy}
            disabled={!amount}
            onClick={() =>
              t.send({ address: vault, abi: parVaultAbi, functionName: "fileClaim", args: [c.id, parseEther(amount), keccak256(toHex(evidence || "none"))] })
            }
          >
            File claim
          </Button>
        </div>
      ) : (
        <p className="text-muted">No open claim.</p>
      )}
      <TxStatus tx={t} />
    </Card>
  )
}

"use client"

import { useMemo, useState } from "react"
import { isAddress, keccak256, toHex, type Address } from "viem"
import { useReadContract, useReadContracts } from "wagmi"
import { parVaultAbi } from "@/lib/abi"
import { CIRCUIT, addrUrl } from "@/lib/config"
import { fmtBtc, fmtDate, fmtDuration, fmtMusd, fmtPct, fmtUsd, parseAmount, parseId, short, toNum } from "@/lib/format"
import { KIND_LABEL, useChainNow, useCommitment, useLogs, useMarket, useMe, useTx, useVault } from "@/lib/hooks"
import { maxDrop } from "@/lib/risk"
import { Mark } from "@/components/Header"
import { Addr, Badge, Button, Card, CardTitle, Field, Meter, NgnHint, ParVaultGate, Problem, TxLink, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address

export default function CertificatePage({ params }: { params: { vault: string; id: string } }) {
  const id = parseId(params.id)
  if (!isAddress(params.vault) || id === undefined)
    return (
      <Problem title="This isn't a valid certificate link" action={{ href: "/vault", label: "Open the app" }}>
        Certificate links look like /c/&lt;vault address&gt;/&lt;number&gt;. Check the link you were sent.
      </Problem>
    )
  return (
    <ParVaultGate vault={params.vault}>
      <Certificate vault={params.vault as Address} id={id} />
    </ParVaultGate>
  )
}

function Certificate({ vault, id }: { vault: Address; id: bigint }) {
  const { c, refetch, error } = useCommitment(vault, id)
  const { data: v } = useVault(vault)
  const m = useMarket()
  const now = useChainNow()
  const { logs: allLogs, error: logError } = useLogs(vault, parVaultAbi as any)
  const logs = useMemo(() => (allLogs ?? []).filter((l) => l.args?.id === id), [allLogs, id])
  const { data: settled, refetch: refetchSettled } = useReadContracts({
    contracts: Array.from({ length: c?.kind === 0 ? c.count : 0 }, (_, i) => ({
      address: vault,
      abi: parVaultAbi,
      functionName: "installmentSettled" as const,
      args: [id, BigInt(i)] as const,
    })),
    allowFailure: false,
    query: { enabled: c?.kind === 0, refetchInterval: 6_000 },
  })

  if (error && !c)
    return (
      <Problem title="No guarantee found" action={{ href: "/vault", label: "Open the app" }}>
        There is no Par vault with commitment #{String(id)} at {short(vault)} on this network.
      </Problem>
    )
  if (!c || !v) return <div className="mx-auto h-96 max-w-lg animate-pulse rounded-2xl border border-line bg-white" />
  if (c.status === 0)
    return (
      <Problem title="No such guarantee" action={{ href: "/vault", label: "Open the app" }}>
        Vault {short(vault)} has no commitment #{String(id)}.
      </Problem>
    )

  const expired = now > Number(c.expiry)
  const remaining = c.cap - c.paidOut
  const drop = m.price ? maxDrop(v.coll, v.debt, v.reserved, m.price) : 0
  const payouts = logs.filter((l) => l.eventName === "Payout")
  const payments = logs.filter((l) => l.eventName === "InstallmentPaid")
  // Ground truth comes from contract state, not logs: paidOut, and installments marked settled.
  const moved = c.paidOut > 0n || (settled ?? []).some(Boolean) || payments.length > 0

  let status: { label: string; tone: "ok" | "warn" | "bad" | "muted"; big: string }
  if (c.status === 1 && !expired) status = { label: "Active", tone: v.healthOk ? "ok" : "warn", big: "Guaranteed" }
  else if (c.status === 1) status = { label: "Expired", tone: "muted", big: "Expired" }
  else if (c.paidOut >= c.cap) status = { label: "Closed · paid in full", tone: "muted", big: "Paid in full" }
  else status = { label: "Closed", tone: "muted", big: "Released" }
  const closed = c.status !== 1
  const live = c.status === 1 && !expired

  const share = typeof window !== "undefined" ? window.location.href : ""
  const isCircuit = c.beneficiary.toLowerCase() === CIRCUIT.toLowerCase()
  const remPct = c.cap > 0n ? (toNum(remaining) / toNum(c.cap)) * 100 : 0

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <article className="overflow-hidden rounded-2xl border border-line bg-white shadow-float">
        <div className="flex items-center justify-between border-b border-line px-6 py-3">
          <span className="flex items-center gap-2 text-xs font-medium">
            <Mark size={18} />
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

          {closed ? (
            <div className="mt-6 rounded-xl bg-soft p-4">
              <div className="text-xs text-muted">{c.paidOut >= c.cap ? "Paid out · no cover remains" : "Released · no cover remains"}</div>
              <div className="num mt-0.5 text-3xl font-medium tracking-tight">
                {fmtMusd(c.paidOut, 0)} <span className="text-sm text-subtle">MUSD paid out of {fmtMusd(c.cap, 0)}</span>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-xl bg-soft p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-muted">Cover remaining</div>
                    <div className="num mt-0.5 text-3xl font-medium tracking-tight">{fmtMusd(remaining, 0)}</div>
                <NgnHint wei={remaining} />
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
            </>
          )}

          {!moved && c.status === 1 && (
            <p className="mt-5 flex items-center gap-2 text-sm text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-btc" /> No money has moved under this guarantee yet.
            </p>
          )}
          {!v.healthOk && c.status === 1 && (
            <p className="mt-3 rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">
              The vault is under-reserved at today&apos;s price. This promise is still honored; the owner has been asked to top up.
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-line bg-canvas px-6 py-5 text-sm text-muted">
          {closed && (
            <p>
              This {KIND_LABEL[c.kind].toLowerCase()} is closed: {c.paidOut >= c.cap ? "the vault paid the full cover" : "it was released"} and no longer backs
              any payment to <Addr a={c.beneficiary} />. The vault paid {fmtMusd(c.paidOut, 0)} MUSD under it.
            </p>
          )}
          {!closed && expired && c.kind !== 2 && (
            <p>
              This guarantee expired on {fmtDate(c.expiry)}. Nothing new can be triggered under it; closing it frees the vault&apos;s reserved capacity.
            </p>
          )}
          {live && c.kind === 0 && (
            <p>
              If <Addr a={c.principal} /> misses a payment to <Addr a={c.beneficiary} />, this vault pays it automatically {fmtDuration(c.grace)} after the due date,
              up to {fmtMusd(c.cap, 0)} MUSD in total. No one has to approve it.
            </p>
          )}
          {live && c.kind === 1 && (
            <p>
              <Addr a={c.beneficiary} /> can claim up to {fmtMusd(remaining, 0)} MUSD with evidence. If nobody disputes within {fmtDuration(c.challengeWindow)}, it
              pays out. Disputes go to the arbiter <Addr a={c.arbiter} />.
            </p>
          )}
          {!closed && c.kind === 2 && (
            <p>
              Pledged to {isCircuit ? "Par Circuit" : <Addr a={c.beneficiary} />}. It can only be drawn to settle what the owner owes at the end of a trade cycle.
              {expired &&
                " It has expired: no new debt can be booked on it, but the circuit can still draw it for debt booked while it was live, and it can't be closed while that debt is owed."}
            </p>
          )}
          {!closed && (
            <>
              <p>
                Backed by <span className="num text-fg">{fmtBtc(v.coll)} BTC</span>
                {m.price ? <> ({fmtUsd(toNum(v.coll) * toNum(m.price))})</> : null} locked on Mezo in vault <Addr a={vault} />.
              </p>
              <p className="text-xs text-subtle">
                If BTC fell more than {fmtPct(drop)} and every promise this vault backs were called, it could be liquidated and this promise could fail.
              </p>
            </>
          )}
        </div>
      </article>

      {c.kind === 0 && (
        <Timeline
          vault={vault}
          c={c}
          now={now}
          logs={logs}
          settled={settled as boolean[] | undefined}
          onDone={() => {
            refetch()
            refetchSettled()
          }}
        />
      )}
      {c.kind === 1 && <ClaimPanel vault={vault} c={c} now={now} onDone={refetch} />}
      <ManagePanel vault={vault} c={c} now={now} onDone={refetch} />

      <Card>
        <CardTitle>Payout history</CardTitle>
        {logError && <p className="mb-2 rounded-lg bg-warn-wash px-3 py-2 text-xs text-warn">History is incomplete: {logError}. Contract state above is current.</p>}
        {allLogs === undefined && !logError ? (
          <p className="text-sm text-muted">Loading history…</p>
        ) : payouts.length === 0 ? (
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
          className="flex-1 rounded-full bg-[#0E7A6E] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#0B6359]"
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

function Timeline({
  vault,
  c,
  now,
  logs,
  settled,
  onDone,
}: {
  vault: Address
  c: any
  now: number
  logs: any[]
  settled?: boolean[]
  onDone: () => void
}) {
  const paidBy = new Map<number, any>()
  const coveredBy = new Map<number, any>()
  for (const l of logs) {
    if (l.eventName === "InstallmentPaid") paidBy.set(Number(l.args.index), l)
    if (l.eventName === "InstallmentMissed") coveredBy.set(Number(l.args.index), l)
  }
  return (
    <Card>
      <CardTitle>Installments</CardTitle>
      {Array.from({ length: c.count }, (_, i) => (
        <InstallmentRow key={i} vault={vault} c={c} i={i} now={now} settled={settled?.[i]} paid={paidBy.get(i)} cov={coveredBy.get(i)} onDone={onDone} />
      ))}
    </Card>
  )
}

/** One installment. Each row owns its tx state, so triggering one payout doesn't spin every button. */
function InstallmentRow({
  vault,
  c,
  i,
  now,
  settled: s,
  paid,
  cov,
  onDone,
}: {
  vault: Address
  c: any
  i: number
  now: number
  settled?: boolean
  paid?: any
  cov?: any
  onDone: () => void
}) {
  const t = useTx(onDone)
  const due = Number(c.start) + i * c.period
  const trigger = due + c.grace
  const pastExpiry = trigger >= Number(c.expiry)
  let label: React.ReactNode
  let action: React.ReactNode = null
  if (paid) label = <Badge tone="ok">Paid by tenant</Badge>
  else if (cov) label = <Badge tone="btc">Covered by vault</Badge>
  else if (s) label = <Badge tone="ok">Settled</Badge>
  else if (c.status !== 1) label = <Badge tone="muted">–</Badge>
  else if (now > trigger && (pastExpiry || now > Number(c.expiry))) label = <Badge tone="muted">Not covered (after expiry)</Badge>
  else if (now > trigger) {
    label = <Badge tone="bad">Missed · payout due</Badge>
    // Permissionless: anyone can trigger the payout if the keeper hasn't yet.
    action = (
      <Button size="sm" busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "triggerMissed", args: [c.id, BigInt(i), Z, Z] })}>
        Trigger payout
      </Button>
    )
  } else if (now > due) label = <Badge tone="warn">Late · vault pays in {fmtDuration(trigger - now)}</Badge>
  else label = <span className="num text-xs text-subtle">due in {fmtDuration(due - now)}</span>
  const tx = paid ?? cov
  return (
    <div className="border-t border-line py-2.5 text-sm first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-[10px] ${paid || cov || s ? "bg-fg text-white" : "bg-soft text-subtle"}`}>{i + 1}</span>
          <span className="num">{fmtMusd(c.installment, 0)}</span>
          <span className="text-xs text-subtle">{fmtDate(due)}</span>
        </div>
        <div className="flex items-center gap-2">
          {label}
          {action}
          {tx && <TxLink hash={tx.transactionHash} label="tx" />}
        </div>
      </div>
      {(t.hash || t.error) && (
        <div className="mt-2">
          <TxStatus tx={t} />
        </div>
      )}
    </div>
  )
}

/** Release (beneficiary, any time without an open claim) or close (anyone, after expiry). Frees reserved capacity. */
function ManagePanel({ vault, c, now, onDone }: { vault: Address; c: any; now: number; onDone: () => void }) {
  const { me } = useMe()
  const t = useTx(onDone)
  const { data: pending } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "pendingClaims", args: [c.id], query: { refetchInterval: 8_000 } })
  if (c.status !== 1) return null
  const claimOpen = Boolean((pending as any)?.[3] ?? (pending as any)?.open)
  const isBen = me?.toLowerCase() === c.beneficiary.toLowerCase()
  const expired = now > Number(c.expiry)
  if (claimOpen || (!isBen && !expired)) return null
  return (
    <Card className="flex flex-col gap-2 text-sm">
      <CardTitle>{expired ? "Close this commitment" : "Release this guarantee"}</CardTitle>
      <p className="text-muted">
        {expired
          ? "It has expired. Closing it frees the vault's reserved capacity. Anyone can do this."
          : "As the beneficiary you can release the vault from this promise early. This can't be undone."}
      </p>
      <div>
        <Button variant={expired ? "primary" : "danger"} busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "closeCommitment", args: [c.id] })}>
          {expired ? "Close commitment" : "Release guarantee"}
        </Button>
      </div>
      <TxStatus tx={t} />
    </Card>
  )
}

function ClaimPanel({ vault, c, now, onDone }: { vault: Address; c: any; now: number; onDone: () => void }) {
  const { me } = useMe()
  const { data: pc, refetch } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "pendingClaims", args: [c.id], query: { refetchInterval: 6_000 } })
  const { data: owner } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "owner" })
  const { data: resolveWindow } = useReadContract({ address: vault, abi: parVaultAbi, functionName: "RESOLVE_WINDOW", query: { staleTime: Infinity } })
  const [amount, setAmount] = useState("")
  const amountWei = parseAmount(amount)
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
  // pendingClaims(id) getter = (amount, filedAt, disputed, open, evidence, disputedAt, rejectedAt)
  const [pAmount, filedAt, disputed, open, , disputedAt] = pc ?? [0n, 0n, false, false, "0x", 0n, 0n]
  const windowEnds = Number(filedAt) + c.challengeWindow
  // After disputedAt + RESOLVE_WINDOW the arbiter can no longer decide; anyone may execute (default: approve).
  const arbiterEnds = resolveWindow !== undefined ? Number(disputedAt) + Number(resolveWindow) : undefined
  const arbiterLapsed = disputed && arbiterEnds !== undefined && now > arbiterEnds

  return (
    <Card className="flex flex-col gap-3 text-sm">
      <CardTitle>Claim</CardTitle>
      {open ? (
        <>
          <p className="text-muted">
            Claim of <span className="num text-fg">{fmtMusd(pAmount)} MUSD</span> filed {fmtDate(filedAt)}.{" "}
            {disputed && arbiterLapsed ? (
              <b className="text-ok">Arbiter deadline passed: the claim pays by default. Anyone can execute it.</b>
            ) : disputed ? (
              <b className="text-warn">
                Disputed: waiting for the arbiter{arbiterEnds !== undefined ? <> (deadline in {fmtDuration(arbiterEnds - now)})</> : null}.
              </b>
            ) : now > windowEnds ? (
              <b className="text-ok">Undisputed: ready to pay.</b>
            ) : (
              <>Challenge window ends in {fmtDuration(windowEnds - now)}.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {((!disputed && now > windowEnds) || arbiterLapsed) && (
              <Button busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "executeClaim", args: [c.id, Z, Z] })}>
                Execute claim
              </Button>
            )}
            {!disputed && now <= windowEnds && canDispute && (
              <Button variant="danger" busy={t.busy} onClick={() => t.send({ address: vault, abi: parVaultAbi, functionName: "disputeClaim", args: [c.id] })}>
                Dispute
              </Button>
            )}
            {disputed && isArb && arbiterEnds !== undefined && !arbiterLapsed && (
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
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Evidence" hint="A link or IPFS/Walrus CID; its hash is stored onchain.">
            <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </Field>
          <Button
            busy={t.busy}
            disabled={amountWei === undefined || amountWei === 0n || amountWei > c.cap - c.paidOut}
            onClick={() =>
              amountWei !== undefined &&
              t.send({ address: vault, abi: parVaultAbi, functionName: "fileClaim", args: [c.id, amountWei, keccak256(toHex(evidence || "none"))] })
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

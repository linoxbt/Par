"use client"

import Link from "next/link"
import { useState } from "react"
import { keccak256, parseEther, toHex, type Address } from "viem"
import { useReadContract } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { parCircuitAbi } from "@/lib/abi"
import { CIRCUIT } from "@/lib/config"
import { useCircle, useInvoices, type Invoice } from "@/lib/circuit"
import { fmtMusd, short } from "@/lib/format"
import { useMe, useTx } from "@/lib/hooks"
import { Addr, Badge, Button, Card, Empty, Field, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address

export default function InvoicesPage({ params }: { params: { circle: string } }) {
  const circleId = BigInt(params.circle)
  const { me, isConnected } = useMe()
  const s = useCircle(circleId, undefined)
  const { invoices, refetch } = useInvoices(circleId)
  const [debtor, setDebtor] = useState("")
  const [amount, setAmount] = useState("")
  const [ref, setRef] = useState("")
  const { data: limit } = useReadContract({
    address: CIRCUIT,
    abi: parCircuitAbi,
    functionName: "creditLimit",
    args: [circleId, me ?? Z],
    query: { enabled: !!me },
  })
  const t = useTx(() => {
    refetch()
    setAmount("")
    setRef("")
  })

  if (!isConnected)
    return (
      <Empty>
        <p className="mb-4">Connect as a circle member.</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </Empty>
    )

  const lc = (a?: string) => a?.toLowerCase()
  const isMember = s.members.some((m) => lc(m) === lc(me))
  const others = s.members.filter((m) => lc(m) !== lc(me))
  const toMe = invoices.filter((i) => lc(i.debtor) === lc(me)).reverse()
  const fromMe = invoices.filter((i) => lc(i.creditor) === lc(me)).reverse()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/circuit/${circleId}`} className="text-xs text-ink-400 hover:text-white">
          ← circle #{String(circleId)}
        </Link>
        <h1 className="text-2xl font-bold">Invoices</h1>
        {!isMember && <p className="text-sm text-warn">You are not a member of this circle.</p>}
        {isMember && <p className="text-sm text-ink-400">Your clearing line available: {fmtMusd(limit, 0)} MUSD · current cycle {String(s.current ?? "")}</p>}
      </div>

      {isMember && (
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Bill a member</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Debtor">
              <select className={inputCls} value={debtor} onChange={(e) => setDebtor(e.target.value)}>
                <option value="">Select…</option>
                {others.map((m) => (
                  <option key={m} value={m}>
                    {short(m)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Amount (MUSD)">
              <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Reference" hint="Invoice number or link; only its hash goes onchain.">
              <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
          </div>
          <div>
            <Button
              busy={t.busy}
              disabled={!debtor || !amount}
              onClick={() =>
                t.send({
                  address: CIRCUIT,
                  abi: parCircuitAbi,
                  functionName: "createInvoice",
                  args: [circleId, debtor as Address, parseEther(amount), keccak256(toHex(ref || `${Date.now()}`))],
                })
              }
            >
              Create invoice
            </Button>
          </div>
          <TxStatus tx={t} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <InvoiceList title="Billed to you" list={toMe} me={me} current={s.current} onDone={refetch} />
        <InvoiceList title="You billed" list={fromMe} me={me} current={s.current} onDone={refetch} />
      </div>
    </div>
  )
}

function InvoiceList({ title, list, me, current, onDone }: { title: string; list: Invoice[]; me?: Address; current?: bigint; onDone: () => void }) {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="mb-1 font-semibold">{title}</h2>
      {list.length === 0 && <p className="text-sm text-ink-400">None.</p>}
      {list.map((i) => (
        <InvoiceRow key={String(i.id)} i={i} me={me} current={current} onDone={onDone} />
      ))}
    </Card>
  )
}

function InvoiceRow({ i, me, current, onDone }: { i: Invoice; me?: Address; current?: bigint; onDone: () => void }) {
  const t = useTx(onDone)
  const lc = (a?: string) => a?.toLowerCase()
  const isDebtor = lc(i.debtor) === lc(me)
  const stale = current !== undefined && i.cycle !== current
  return (
    <div className="flex flex-col gap-2 border-t border-ink-800 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <span className="num text-white">{fmtMusd(i.amount)} MUSD</span>{" "}
          <span className="text-ink-400">
            #{String(i.id)} · {isDebtor ? "from" : "to"} <Addr a={isDebtor ? i.creditor : i.debtor} /> · cycle {String(i.cycle)}
          </span>
        </div>
        {i.status === 1 ? stale ? <Badge tone="muted">Stale</Badge> : <Badge tone="warn">Pending</Badge> : i.status === 2 ? <Badge tone="ok">Accepted</Badge> : <Badge tone="muted">Rejected</Badge>}
      </div>
      {i.status === 1 && !stale && (
        <div className="flex gap-2">
          {isDebtor && (
            <Button busy={t.busy} onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "acceptInvoice", args: [i.id] })}>
              Accept
            </Button>
          )}
          <Button variant="ghost" busy={t.busy} onClick={() => t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "rejectInvoice", args: [i.id] })}>
            {isDebtor ? "Reject" : "Cancel"}
          </Button>
        </div>
      )}
      <TxStatus tx={t} />
    </div>
  )
}

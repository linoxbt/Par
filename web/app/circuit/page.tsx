"use client"

import Link from "next/link"
import { useState } from "react"
import { decodeEventLog } from "viem"
import { useRouter } from "next/navigation"
import { parCircuitAbi } from "@/lib/abi"
import { CIRCUIT } from "@/lib/config"
import { useCircles } from "@/lib/circuit"
import { fmtDuration } from "@/lib/format"
import { useMe, useTx } from "@/lib/hooks"
import { Addr, Button, Card, Empty, Field, TxStatus, inputCls } from "@/components/ui"

const PRESETS = [
  { label: "Weekly (2-day settle)", cycle: 7 * 86400, window: 2 * 86400 },
  { label: "Monthly (5-day settle)", cycle: 30 * 86400, window: 5 * 86400 },
  { label: "Demo (3 min, 1-min settle)", cycle: 180, window: 60 },
]

export default function CircuitHome() {
  const { circles, refetch } = useCircles()
  const { isConnected } = useMe()
  const router = useRouter()
  const [preset, setPreset] = useState(0)
  const t = useTx((rc) => {
    refetch()
    for (const l of rc.logs) {
      try {
        const d = decodeEventLog({ abi: parCircuitAbi, data: l.data, topics: l.topics })
        if (d.eventName === "CircleCreated") router.push(`/circuit/${d.args.circleId}`)
      } catch {}
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Par Circuit</h1>
        <p className="mt-1 max-w-2xl text-ink-300">
          Trade-credit clearing for businesses that sell to each other. Members log invoices; the contract nets them as they are
          accepted. At cycle end only net debtors pay, and a defaulter is force-settled from the clearing line in their Par vault.
        </p>
      </div>

      {circles.length === 0 ? (
        <Empty>No circles yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c) => (
            <Link key={String(c.id)} href={`/circuit/${c.id}`} className="rounded-2xl border border-ink-700 bg-ink-900 p-5 transition hover:border-btc">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">Circle #{String(c.id)}</span>
                <span className="text-xs text-ink-400">{c.members.length} members</span>
              </div>
              <p className="mt-2 text-sm text-ink-400">
                cycle {fmtDuration(Number(c.cycleLength))} · settle {fmtDuration(Number(c.settleWindow))}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                admin <Addr a={c.admin} />
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <h2 className="font-semibold">Start a circle</h2>
          <p className="text-sm text-ink-400">You become its admin and decide who joins (a circle is a closed trade group).</p>
          <Field label="Cycle">
            <select className={inputCls} value={preset} onChange={(e) => setPreset(Number(e.target.value))}>
              {PRESETS.map((p, i) => (
                <option key={p.label} value={i}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <Button
              busy={t.busy}
              disabled={!isConnected}
              onClick={() =>
                t.send({ address: CIRCUIT, abi: parCircuitAbi, functionName: "createCircle", args: [BigInt(PRESETS[preset].cycle), BigInt(PRESETS[preset].window)] })
              }
            >
              Create circle
            </Button>
          </div>
          <TxStatus tx={t} />
        </Card>
        <Card className="flex flex-col gap-3 text-sm text-ink-300">
          <h2 className="font-semibold text-white">How to join</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open a vault on the{" "}
              <Link href="/vault" className="text-btc hover:underline">
                Vault page
              </Link>
              .
            </li>
            <li>Pledge a clearing line to Par Circuit there. It must pass the same stress test as any guarantee.</li>
            <li>Send the circle admin your address, vault and line id. They add you.</li>
            <li>Create and accept invoices. Your net payable can never exceed your line.</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { decodeEventLog, isAddress, type Address } from "viem"
import { usePublicClient, useReadContract } from "wagmi"
import { WalletButton } from "@/components/Wallet"
import { parVaultAbi } from "@/lib/abi"
import { fmtDuration, fmtMusd, fmtRatio, parseAmount, parseIntSafe, short } from "@/lib/format"
import { useMe, useProtocol, useTx, useVault, useVaultsOf } from "@/lib/hooks"
import { Badge, Button, Card, CardTitle, Field, LinkButton, NotDeployed, PageHead, Segmented, TxStatus, inputCls } from "@/components/ui"
import { CONFIGURED, chain } from "@/lib/config"

const PERIODS = [
  { label: "Monthly", sec: 30 * 86400, grace: 3 * 86400 },
  { label: "Weekly", sec: 7 * 86400, grace: 86400 },
  { label: "Demo · 2 min", sec: 120, grace: 10 },
]

export default function NewGuaranteePage() {
  return (
    <Suspense>
      <Builder />
    </Suspense>
  )
}

function Builder() {
  const { me, isConnected } = useMe()
  const { vaults } = useVaultsOf(me)
  const sp = useSearchParams()
  const qv = sp.get("v")
  const vault = (qv && isAddress(qv) ? (qv as Address) : undefined) ?? vaults[vaults.length - 1]
  const pc = usePublicClient({ chainId: chain.id })
  const { data: v } = useVault(vault)
  const p = useProtocol()

  const [type, setType] = useState<"rent" | "bond">("rent")
  const [beneficiary, setBeneficiary] = useState("")
  const [principal, setPrincipal] = useState("")
  const [installment, setInstallment] = useState("500")
  const [count, setCount] = useState("12")
  const [periodIdx, setPeriodIdx] = useState(0)
  const [cover, setCover] = useState("1500")
  const [startIn, setStartIn] = useState("") // seconds from now; default one period
  const [arbiter, setArbiter] = useState("")
  const [bondCap, setBondCap] = useState("2000")
  const [bondDays, setBondDays] = useState("90")
  const [windowH, setWindowH] = useState("48")

  const period = PERIODS[periodIdx]
  const capWei = (type === "rent" ? parseAmount(cover) : parseAmount(bondCap)) ?? 0n
  const instWei = parseAmount(installment)
  const countN = parseIntSafe(count, { min: 1, max: 1000 })
  const startInN = startIn.trim() ? parseIntSafe(startIn, { min: 0, max: 10 * 365 * 86400 }) : undefined
  const bondDaysN = parseIntSafe(bondDays, { min: 1, max: 3650 })
  const windowSec = /^\d+(\.\d+)?$/.test(windowH.trim()) ? Math.round(Number(windowH) * 3600) : undefined
  const { data: fit } = useReadContract({
    address: vault,
    abi: parVaultAbi,
    functionName: "health",
    args: [capWei],
    query: { enabled: !!vault && capWei > 0n, refetchInterval: 10_000 },
  })

  /**
   * Schedule times are computed from CHAIN time at the moment of signing, not when the form was
   * filled: a slow signature can no longer create installment #0 already past due + grace.
   */
  const firstDueIn = startInN ?? (periodIdx === 2 ? 60 : period.sec)
  const planAt = (now: number) => {
    const start = now + firstDueIn
    const n = countN ?? 0
    const expiry = start + Math.max(0, n - 1) * period.sec + period.grace + (periodIdx === 2 ? 600 : 7 * 86400)
    return { start, expiry }
  }
  const chainNow = async () => {
    try {
      const b = await pc!.getBlock()
      return Math.max(Number(b.timestamp), Math.floor(Date.now() / 1000))
    } catch {
      return Math.floor(Date.now() / 1000)
    }
  }

  const [created, setCreated] = useState<bigint>()
  const tx = useTx((rc) => {
    for (const l of rc.logs) {
      try {
        const d = decodeEventLog({ abi: parVaultAbi, data: l.data, topics: l.topics })
        if (d.eventName === "CommitmentCreated") setCreated(d.args.id)
      } catch {}
    }
  })

  const Head = <PageHead eyebrow="Guarantee" title="Make a promise." muted="Stress-tested before it exists." sub="BTC −40%, everything called at once, vault still above 160%." />
  if (!CONFIGURED)
    return (
      <div className="flex flex-col gap-8">
        {Head}
        <NotDeployed />
      </div>
    )
  if (!isConnected)
    return (
      <div className="flex flex-col gap-8">
        {Head}
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-lg font-medium">Connect to make a guarantee from your vault</div>
          <WalletButton align="left" />
        </Card>
      </div>
    )
  if (!vault || (v && !v.troveActive))
    return (
      <div className="flex flex-col gap-8">
        {Head}
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-lg font-medium">You need a vault with an open trove first</div>
          <LinkButton href="/vault">Go to vault</LinkButton>
        </Card>
      </div>
    )

  const lc = (a?: string) => a?.toLowerCase()
  const benOk = isAddress(beneficiary)
  const prinOk = !principal.trim() || isAddress(principal)
  const prinAddr = (principal.trim() ? principal : me) as Address
  const isOwner = !v?.owner || lc(v.owner) === lc(me)
  const capTooBig = type === "rent" && instWei !== undefined && countN !== undefined && capWei > instWei * BigInt(countN)
  const arbOk = isAddress(arbiter) && lc(arbiter) !== lc(v?.owner ?? me) && lc(arbiter) !== lc(beneficiary) && lc(arbiter) !== lc(prinAddr)
  const problem = !isOwner
    ? "Only the vault owner can make promises from this vault."
    : beneficiary && !benOk
      ? "The beneficiary isn't a valid address."
      : !prinOk
        ? "The payer/principal isn't a valid address (leave it empty to use yours)."
        : capWei === 0n
          ? "Enter the cover as a plain number, e.g. 1500."
          : type === "rent"
            ? instWei === undefined || instWei === 0n
              ? "Enter the installment as a plain number, e.g. 500."
              : countN === undefined
                ? "Number of installments must be a whole number from 1 to 1000."
                : startIn.trim() && startInN === undefined
                  ? "First due must be a whole number of seconds."
                  : capTooBig
                    ? "Cover cap can't exceed installment × count."
                    : undefined
            : arbiter && !arbOk
              ? "The arbiter must be a valid address that isn't you, the beneficiary or the principal."
              : bondDaysN === undefined
                ? "Validity must be a whole number of days."
                : windowSec === undefined || windowSec < 60
                  ? "The challenge window must be at least one minute (e.g. 0.02 h)."
                  : undefined
  const valid = !problem && benOk && (type === "rent" || arbOk)

  const submit = async () => {
    const now = await chainNow()
    if (type === "rent") {
      const plan = planAt(now)
      tx.send({
        address: vault,
        abi: parVaultAbi,
        functionName: "createScheduled",
        args: [beneficiary as Address, prinAddr, instWei!, BigInt(plan.start), period.sec, period.grace, countN!, capWei, BigInt(plan.expiry)],
      })
    } else {
      tx.send({
        address: vault,
        abi: parVaultAbi,
        functionName: "createClaim",
        args: [beneficiary as Address, prinAddr, arbiter as Address, capWei, BigInt(now + bondDaysN! * 86400), windowSec!],
      })
    }
  }

  if (created !== undefined)
    return (
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-wash text-xl text-ok">✓</span>
        <h1 className="h-display text-3xl">Promise made</h1>
        <p className="text-muted">No MUSD was drawn for it. Send the certificate link to the beneficiary.</p>
        <div className="flex gap-3">
          <LinkButton href={`/c/${vault}/${created}`}>Open certificate</LinkButton>
          {type === "rent" && (
            <LinkButton href={`/pay/${vault}/${created}`} variant="ghost">
              Payer page
            </LinkButton>
          )}
        </div>
      </Card>
    )

  const stressPct = p ? Number(p.stressBps) / 100 : 40
  return (
    <div className="flex flex-col gap-8">
      {Head}
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <div className="mb-6">
            <Segmented
              value={type}
              onChange={setType}
              options={[
                { value: "rent", label: "Rent / installments" },
                { value: "bond", label: "Bond / claim" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-5">
            <Field label="Who gets paid" hint="Landlord, supplier or client. Any Mezo address.">
              <input className={inputCls} placeholder="0x…" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
            </Field>
            <Field label={type === "rent" ? "Who pays (tenant)" : "Principal (can dispute claims)"} hint="Defaults to you.">
              <input className={inputCls} placeholder={me} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </Field>

            {type === "rent" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Installment (MUSD)">
                    <input className={inputCls} inputMode="decimal" value={installment} onChange={(e) => setInstallment(e.target.value)} />
                  </Field>
                  <Field label="Number of installments">
                    <input className={inputCls} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
                  </Field>
                </div>
                <div className="flex flex-col gap-1.5" role="group" aria-label="Schedule">
                  <span className="text-sm font-medium">Schedule</span>
                  <div className="flex flex-wrap gap-2">
                    {PERIODS.map((pp, i) => (
                      <button
                        type="button"
                        key={pp.label}
                        onClick={() => setPeriodIdx(i)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${periodIdx === i ? "border-fg bg-fg text-white" : "border-line-strong bg-white hover:border-fg"}`}
                      >
                        {pp.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Cover cap (MUSD)" hint="The most the vault will ever pay.">
                    <input className={inputCls} inputMode="decimal" value={cover} onChange={(e) => setCover(e.target.value)} />
                  </Field>
                  <Field label="First due in (seconds)" hint={`Grace after each due date: ${fmtDuration(period.grace)}`}>
                    <input className={inputCls} inputMode="numeric" placeholder={String(periodIdx === 2 ? 60 : period.sec)} value={startIn} onChange={(e) => setStartIn(e.target.value)} />
                  </Field>
                </div>
              </>
            ) : (
              <>
                <Field label="Arbiter" hint="Decides disputed claims. Can't be you, the beneficiary or the principal. If they don't decide within 7 days, the claim pays.">
                  <input className={inputCls} placeholder="0x…" value={arbiter} onChange={(e) => setArbiter(e.target.value)} />
                </Field>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Cover (MUSD)">
                    <input className={inputCls} inputMode="decimal" value={bondCap} onChange={(e) => setBondCap(e.target.value)} />
                  </Field>
                  <Field label="Valid (days)">
                    <input className={inputCls} inputMode="numeric" value={bondDays} onChange={(e) => setBondDays(e.target.value)} />
                  </Field>
                  <Field label="Challenge (h)">
                    <input className={inputCls} inputMode="decimal" value={windowH} onChange={(e) => setWindowH(e.target.value)} />
                  </Field>
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardTitle right={fit ? <Badge tone={fit[0] ? "ok" : "bad"}>{fit[0] ? "Fits" : "Doesn't fit"}</Badge> : undefined}>Stress test</CardTitle>
            {fit ? (
              <>
                <div className="num text-4xl font-medium tracking-tight">{fmtRatio(fit[1])}</div>
                <p className="mt-1 text-sm text-muted">
                  Vault ratio if BTC fell {stressPct}% and every promise were called. Needs {p ? fmtRatio(p.targetIcr) : "160%"}.
                </p>
                <p className="mt-3 text-xs text-subtle">Room left under capacity: {fmtMusd(fit[2], 0)} MUSD</p>
              </>
            ) : (
              <p className="text-sm text-muted">Enter an amount to check it.</p>
            )}
          </Card>

          <div className="rounded-2xl border border-line bg-canvas p-2">
            <div className="rounded-xl border border-line bg-white p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="tag">Certificate preview</span>
                <Badge tone="ok">Active</Badge>
              </div>
              <div className="h-display mt-4 text-3xl">Guaranteed</div>
              <div className="mt-1 text-sm text-muted">
                {type === "rent" ? `${installment || 0} MUSD × ${count || 0}, ${period.label.toLowerCase()}` : `Up to ${bondCap || 0} MUSD on an uncontested claim`}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <div className="text-xs text-subtle">Cover</div>
                  <div className="num">{type === "rent" ? cover || 0 : bondCap || 0} MUSD</div>
                </div>
                <div>
                  <div className="text-xs text-subtle">Beneficiary</div>
                  <div className="num">{benOk ? short(beneficiary) : "–"}</div>
                </div>
              </div>
            </div>
          </div>

          <Button busy={tx.busy} disabled={!valid || !fit?.[0]} onClick={submit} className="w-full py-3">
            Make the promise
          </Button>
          {problem && <p className="text-sm text-warn">{problem}</p>}
          <TxStatus tx={tx} />
          <Link href="/vault" className="text-center text-xs text-muted hover:text-fg">
            ← Back to vault
          </Link>
        </div>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { decodeEventLog, isAddress, keccak256, toHex, type Address } from "viem"
import { usePublicClient, useReadContract } from "wagmi"
import { WalletButton } from "@/components/Wallet"
import { parMarketAbi } from "@/lib/abi"
import { MARKET, chain } from "@/lib/config"
import { erc20Abi } from "@/lib/mezoAbi"
import { fmtDuration, fmtMusd, parseAmount, parseIntSafe } from "@/lib/format"
import { useMe, useProtocol, useTx } from "@/lib/hooks"
import { Button, Card, CardTitle, Field, LinkButton, NgnHint, PageHead, Problem, Segmented, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address
const PERIODS = [
  { label: "Monthly", sec: 30 * 86400, grace: 3 * 86400, firstDue: 30 * 86400 },
  { label: "Weekly", sec: 7 * 86400, grace: 86400, firstDue: 7 * 86400 },
  { label: "Demo · 2 min", sec: 120, grace: 10, firstDue: 600 },
]

export default function NewRequestPage() {
  return (
    <Suspense>
      <RequestForm />
    </Suspense>
  )
}

function RequestForm() {
  const sp = useSearchParams()
  const template = sp.get("template")
  const { me, isConnected } = useMe()
  const p = useProtocol()
  const pc = usePublicClient({ chainId: chain.id })
  const [kind, setKind] = useState<"rent" | "bond">(template === "bond" ? "bond" : "rent")
  const [beneficiary, setBeneficiary] = useState("")
  const [installment, setInstallment] = useState("260")
  const [count, setCount] = useState("12")
  const [periodIdx, setPeriodIdx] = useState(0)
  const [cover, setCover] = useState("780")
  const [arbiter, setArbiter] = useState("")
  const [bondCap, setBondCap] = useState("1000")
  const [bondDays, setBondDays] = useState("90")
  const [windowH, setWindowH] = useState("48")
  const [premium, setPremium] = useState("25")
  const [openDays, setOpenDays] = useState("7")
  const [note, setNote] = useState(template === "bond" ? "Lagos pilot · merchant bond" : template === "rent" ? "Lagos pilot · rent" : "")
  const [created, setCreated] = useState<bigint>()

  useEffect(() => {
    if (kind === "bond" && premium === "25") setPremium("20")
  }, [kind, premium])

  const period = PERIODS[periodIdx]
  const instWei = parseAmount(installment)
  const countN = parseIntSafe(count, { min: 1, max: 120 })
  const capWei = (kind === "rent" ? parseAmount(cover) : parseAmount(bondCap)) ?? 0n
  const premWei = parseAmount(premium)
  const openN = parseIntSafe(openDays, { min: 1, max: 60 })
  const bondDaysN = parseIntSafe(bondDays, { min: 1, max: 3650 })
  const windowSec = /^\d+(\.\d+)?$/.test(windowH.trim()) ? Math.round(Number(windowH) * 3600) : undefined
  const lc = (a?: string) => a?.toLowerCase()

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: p?.musd,
    abi: erc20Abi,
    functionName: "allowance",
    args: [me ?? Z, MARKET],
    query: { enabled: !!p && !!me },
  })
  const { data: bal } = useReadContract({ address: p?.musd, abi: erc20Abi, functionName: "balanceOf", args: [me ?? Z], query: { enabled: !!p && !!me } })
  const tApprove = useTx(() => refetchAllowance())
  const tx = useTx((rc) => {
    for (const l of rc.logs) {
      try {
        const d = decodeEventLog({ abi: parMarketAbi, data: l.data, topics: l.topics }) as any
        if (d.eventName === "RequestCreated") setCreated(d.args.id)
      } catch {}
    }
  })

  if (MARKET === Z) return <Problem title="The market isn't deployed on this network yet" />
  const Head = (
    <PageHead
      eyebrow="Request cover"
      title="Ask for a guarantee."
      muted="No Bitcoin needed."
      sub="Describe the cover you need and offer a premium in MUSD. A Bitcoin holder backs it from their vault; the premium goes to them, and your landlord or supplier gets a live certificate."
    />
  )
  if (!isConnected)
    return (
      <div className="flex flex-col gap-8">
        {Head}
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-lg font-medium">Connect the wallet that will pay</div>
          <WalletButton align="left" />
        </Card>
      </div>
    )
  if (created !== undefined)
    return (
      <Card className="mx-auto flex max-w-lg flex-col items-center gap-4 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-wash text-xl text-ok">✓</span>
        <h1 className="h-display text-3xl">Request #{String(created)} posted</h1>
        <p className="text-muted">Your premium is held by the market until someone backs it. You can cancel any time before then for a full refund.</p>
        <div className="flex gap-3">
          <LinkButton href="/market/mine">My requests</LinkButton>
          <LinkButton href="/market" variant="ghost">
            The market
          </LinkButton>
        </div>
      </Card>
    )

  const problem =
    beneficiary && !isAddress(beneficiary)
      ? "The beneficiary isn't a valid address."
      : lc(beneficiary) === lc(me)
        ? "The beneficiary can't be you."
        : capWei === 0n
          ? "Enter the cover as a plain number."
          : premWei === undefined
            ? "Enter the premium as a plain number (0 is allowed)."
            : openN === undefined
              ? "Open-for must be 1 to 60 days."
              : kind === "rent"
                ? !instWei
                  ? "Enter the installment as a plain number."
                  : countN === undefined
                    ? "Installments must be 1 to 120."
                    : capWei > instWei * BigInt(countN)
                      ? "Cover can't exceed installment × count."
                      : undefined
                : !isAddress(arbiter)
                  ? "Enter the arbiter's address."
                  : lc(arbiter) === lc(me) || lc(arbiter) === lc(beneficiary)
                    ? "The arbiter can't be you or the beneficiary."
                    : bondDaysN === undefined
                      ? "Validity must be a whole number of days."
                      : windowSec === undefined || windowSec < 60
                        ? "The challenge window must be at least a minute."
                        : undefined
  const needApprove = (premWei ?? 0n) > 0n && (allowance ?? 0n) < (premWei ?? 0n)
  const short = (premWei ?? 0n) > (bal ?? 0n)

  const submit = async () => {
    const b = await pc!.getBlock()
    const now = Math.max(Number(b.timestamp), Math.floor(Date.now() / 1000))
    const ref = keccak256(toHex(note || "par-request"))
    if (kind === "rent") {
      // the market requires the deadline to be no later than the first due date
      const demo = period.sec < 3600
      const start = demo ? now + period.firstDue : now + Math.max(period.firstDue, (openN ?? 1) * 86400 + 60)
      const deadline = demo ? start - 60 : Math.min(now + (openN ?? 1) * 86400, start - 60)
      const expiry = start + (countN! - 1) * period.sec + period.grace + Math.max(7 * 86400, 600)
      tx.send({
        address: MARKET,
        abi: parMarketAbi,
        functionName: "requestScheduled",
        args: [beneficiary as Address, instWei!, BigInt(start), period.sec, period.grace, countN!, capWei, BigInt(expiry), premWei!, BigInt(deadline), ref],
      })
    } else {
      const deadline = now + (openN ?? 1) * 86400
      const expiry = deadline + bondDaysN! * 86400
      tx.send({
        address: MARKET,
        abi: parMarketAbi,
        functionName: "requestClaim",
        args: [beneficiary as Address, arbiter as Address, capWei, BigInt(expiry), windowSec!, premWei!, BigInt(deadline), ref],
      })
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {Head}
      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <div className="mb-6">
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: "rent", label: "Rent / installments" },
                { value: "bond", label: "Merchant bond / claim" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-5">
            <Field label={kind === "rent" ? "Landlord (who gets paid)" : "Supplier / client (who can claim)"} hint="Their Mezo address.">
              <input className={inputCls} placeholder="0x…" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
            </Field>
            {kind === "rent" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Installment (MUSD)" hint={<NgnHint wei={instWei} />}>
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
                        aria-pressed={periodIdx === i}
                        onClick={() => setPeriodIdx(i)}
                        className={`rounded-full border px-4 py-2 text-sm transition ${periodIdx === i ? "border-fg bg-fg text-white" : "border-line-strong bg-white hover:border-fg"}`}
                      >
                        {pp.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-subtle">
                    {period.sec < 3600
                      ? "Demo: open for 9 minutes, first payment due in 10, then every 2 minutes."
                      : `First payment due after the request closes; grace ${fmtDuration(period.grace)} after each due date.`}
                  </span>
                </div>
                <Field label="Cover cap (MUSD)" hint={<>The most the backer&apos;s vault will ever pay. <NgnHint wei={capWei} /></>}>
                  <input className={inputCls} inputMode="decimal" value={cover} onChange={(e) => setCover(e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Arbiter" hint="Decides disputed claims within 7 days. Can't be you or the beneficiary.">
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
            <div className="grid grid-cols-2 gap-4">
              <Field label="Premium you offer (MUSD)" hint={<>Paid once to whoever backs it. <NgnHint wei={premWei} /></>}>
                <input className={inputCls} inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} />
              </Field>
              {kind === "rent" && period.sec < 3600 ? (
                <Field label="Open for" hint="Fixed by the demo schedule.">
                  <input className={inputCls} value="9 minutes" disabled />
                </Field>
              ) : (
                <Field label="Open for (days)" hint="After this, it can't be backed; cancel for a refund.">
                  <input className={inputCls} inputMode="numeric" value={openDays} onChange={(e) => setOpenDays(e.target.value)} />
                </Field>
              )}
            </div>
            <Field label="Note (optional)" hint="Only its hash is stored onchain.">
              <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
        </Card>
        <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="text-sm">
            <CardTitle>Summary</CardTitle>
            <div className="num text-3xl font-medium tracking-tight">{fmtMusd(capWei, 0)} MUSD cover</div>
            <NgnHint wei={capWei} />
            <p className="mt-3 text-muted">
              You escrow <b className="text-fg">{fmtMusd(premWei ?? 0n, 2)} MUSD</b> now. Your MUSD: {fmtMusd(bal)}.
            </p>
            {short && <p className="mt-2 text-warn">You don&apos;t have enough MUSD for this premium.</p>}
          </Card>
          {needApprove && (
            <Button
              variant="ghost"
              busy={tApprove.busy}
              disabled={!p || !premWei}
              onClick={() => tApprove.send({ address: p!.musd, abi: erc20Abi, functionName: "approve", args: [MARKET, premWei!] })}
            >
              1. Approve {fmtMusd(premWei ?? 0n, 2)} MUSD premium
            </Button>
          )}
          <Button busy={tx.busy} disabled={!!problem || !beneficiary || needApprove || short} onClick={submit} className="w-full py-3">
            {needApprove ? "2. " : ""}Post request
          </Button>
          {problem && beneficiary && <p className="text-sm text-warn">{problem}</p>}
          <TxStatus tx={tApprove} />
          <TxStatus tx={tx} />
          <Link href="/pilot" className="text-center text-xs text-muted hover:text-fg">
            How the Lagos pilot works →
          </Link>
        </div>
      </div>
    </div>
  )
}

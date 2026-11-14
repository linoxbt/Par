"use client"

import Link from "next/link"
import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { decodeEventLog, isAddress, parseEther, type Address } from "viem"
import { useReadContract } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { parVaultAbi } from "@/lib/abi"
import { fmtMusd, fmtRatio } from "@/lib/format"
import { useMe, useProtocol, useTx, useVault, useVaultsOf } from "@/lib/hooks"
import { Button, Card, Empty, Field, LinkButton, NotDeployed, PageHead, TxStatus, inputCls } from "@/components/ui"
import { CONFIGURED } from "@/lib/config"

const PERIODS = [
  { label: "Monthly", sec: 30 * 86400, grace: 3 * 86400 },
  { label: "Weekly", sec: 7 * 86400, grace: 86400 },
  { label: "Demo (2 min)", sec: 120, grace: 10 },
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
  const vault = (sp.get("v") as Address | null) ?? vaults[vaults.length - 1]
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
  const capWei = type === "rent" ? (cover ? parseEther(cover) : 0n) : bondCap ? parseEther(bondCap) : 0n
  const { data: fit } = useReadContract({
    address: vault,
    abi: parVaultAbi,
    functionName: "health",
    args: [capWei],
    query: { enabled: !!vault && capWei > 0n, refetchInterval: 10_000 },
  })

  const plan = useMemo(() => {
    const now = Math.floor(Date.now() / 1000)
    const start = now + (startIn ? Number(startIn) : periodIdx === 2 ? 30 : period.sec)
    const n = Number(count || 0)
    const expiry = start + Math.max(0, n - 1) * period.sec + period.grace + (periodIdx === 2 ? 600 : 7 * 86400)
    return { start, expiry }
  }, [startIn, count, period, periodIdx])

  const [created, setCreated] = useState<bigint>()
  const tx = useTx((rc) => {
    for (const l of rc.logs) {
      try {
        const d = decodeEventLog({ abi: parVaultAbi, data: l.data, topics: l.topics })
        if (d.eventName === "CommitmentCreated") setCreated(d.args.id)
      } catch {}
    }
  })

  if (!CONFIGURED)
    return (
      <div className="flex flex-col gap-6">
        <PageHead index="02" eyebrow="Guarantee builder" title={<>Make a <em className="text-btc">promise.</em></>} />
        <NotDeployed />
      </div>
    )
  if (!isConnected)
    return (
      <Empty>
        <p className="mb-4">Connect to make a guarantee from your vault.</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </Empty>
    )
  if (!vault || (v && !v.troveActive))
    return (
      <Empty>
        <p className="mb-4">You need a vault with an open trove first.</p>
        <LinkButton href="/vault">Go to vault</LinkButton>
      </Empty>
    )

  const benOk = isAddress(beneficiary)
  const prinAddr = (principal && isAddress(principal) ? principal : me) as Address
  const capTooBig = type === "rent" && capWei > parseEther(installment || "0") * BigInt(count || 0)
  const valid =
    benOk &&
    capWei > 0n &&
    (type === "rent" ? Number(installment) > 0 && Number(count) > 0 && !capTooBig : isAddress(arbiter))

  const submit = () => {
    if (type === "rent") {
      tx.send({
        address: vault,
        abi: parVaultAbi,
        functionName: "createScheduled",
        args: [
          beneficiary as Address,
          prinAddr,
          parseEther(installment),
          BigInt(plan.start),
          period.sec,
          period.grace,
          Number(count),
          capWei,
          BigInt(plan.expiry),
        ],
      })
    } else {
      tx.send({
        address: vault,
        abi: parVaultAbi,
        functionName: "createClaim",
        args: [
          beneficiary as Address,
          prinAddr,
          arbiter as Address,
          capWei,
          BigInt(Math.floor(Date.now() / 1000) + Number(bondDays) * 86400),
          Math.round(Number(windowH) * 3600),
        ],
      })
    }
  }

  if (created !== undefined)
    return (
      <Card className="flex flex-col items-start gap-4">
        <h1 className="display text-5xl">Promise <em className="text-btc">made.</em></h1>
        <p className="text-ink-300">Nothing has been borrowed. Send the certificate link to the beneficiary.</p>
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

  return (
    <div className="flex flex-col gap-6">
      <PageHead index="02" eyebrow="Guarantee builder" title={<>Make a <em className="text-btc">promise.</em></>} sub="Every promise is stress-tested before it exists: BTC −40%, everything called at once, vault still above 160%." />
      <div className="flex gap-2">
        {(["rent", "bond"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-[3px] border px-4 py-2 font-mono text-xs uppercase tracking-wider ${type === t ? "border-btc bg-btc/10 text-btc" : "border-ink-600 text-ink-300"}`}
          >
            {t === "rent" ? "Rent / installments" : "Bond / claim"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col gap-4 lg:col-span-2">
          <Field label="Beneficiary (who gets paid)" hint="Landlord, supplier, client. Any Mezo address.">
            <input className={inputCls} placeholder="0x…" value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} />
          </Field>
          <Field label={type === "rent" ? "Payer (tenant)" : "Principal (may dispute claims)"} hint="Defaults to you.">
            <input className={inputCls} placeholder={me} value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </Field>

          {type === "rent" ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Installment (MUSD)">
                  <input className={inputCls} value={installment} onChange={(e) => setInstallment(e.target.value)} />
                </Field>
                <Field label="Installments">
                  <input className={inputCls} value={count} onChange={(e) => setCount(e.target.value)} />
                </Field>
                <Field label="Schedule">
                  <select className={inputCls} value={periodIdx} onChange={(e) => setPeriodIdx(Number(e.target.value))}>
                    {PERIODS.map((p, i) => (
                      <option key={p.label} value={i}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cover cap (MUSD)" hint="The most the vault will ever pay. ≤ installment × count.">
                  <input className={inputCls} value={cover} onChange={(e) => setCover(e.target.value)} />
                </Field>
                <Field label="First due in (seconds)" hint={`Grace after each due date: ${period.grace}s`}>
                  <input className={inputCls} placeholder={String(periodIdx === 2 ? 30 : period.sec)} value={startIn} onChange={(e) => setStartIn(e.target.value)} />
                </Field>
              </div>
              {capTooBig && <p className="text-sm text-bad">Cover cap can&apos;t exceed installment × count.</p>}
            </>
          ) : (
            <>
              <Field label="Arbiter (decides disputed claims)" hint="Chosen per bond and agreed by both sides.">
                <input className={inputCls} placeholder="0x…" value={arbiter} onChange={(e) => setArbiter(e.target.value)} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Cover (MUSD)">
                  <input className={inputCls} value={bondCap} onChange={(e) => setBondCap(e.target.value)} />
                </Field>
                <Field label="Valid for (days)">
                  <input className={inputCls} value={bondDays} onChange={(e) => setBondDays(e.target.value)} />
                </Field>
                <Field label="Challenge window (h)">
                  <input className={inputCls} value={windowH} onChange={(e) => setWindowH(e.target.value)} />
                </Field>
              </div>
            </>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="label">Stress test</div>
          {fit ? (
            <>
              <div className={`display text-5xl ${fit[0] ? "text-btc" : "text-bad"}`}>{fit[0] ? "Fits" : "Doesn't fit"}</div>
              <p className="text-sm text-ink-300">
                After this promise, if BTC fell {p ? Number(p.stressBps) / 100 : 40}% and every promise were called at once, the vault would sit at{" "}
                <b className="num">{fmtRatio(fit[1])}</b> (needs ≥ {p ? fmtRatio(p.targetIcr) : "160%"}).
              </p>
              <p className="text-sm text-ink-400">Headroom under capacity after: {fmtMusd(fit[2], 0)} MUSD</p>
            </>
          ) : (
            <p className="text-sm text-ink-400">Enter an amount.</p>
          )}
          {type === "rent" && (
            <div className="rounded-[3px] bg-ink-950 p-3 text-xs text-ink-300">
              {count || 0} × {installment || 0} MUSD, {period.label.toLowerCase()}. If a payment is more than {period.grace}s late, anyone
              (the keeper) can trigger the vault to pay it. Total cover {cover || 0} MUSD.
            </div>
          )}
          <Button busy={tx.busy} disabled={!valid || !fit?.[0]} onClick={submit}>
            Make the promise
          </Button>
          <TxStatus tx={tx} />
          <Link href="/vault" className="text-xs text-ink-400 hover:text-white">
            ← back to vault
          </Link>
        </Card>
      </div>
    </div>
  )
}

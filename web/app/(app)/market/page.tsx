"use client"

import Link from "next/link"
import { useState } from "react"
import { type Address } from "viem"
import { useReadContract } from "wagmi"
import { WalletButton } from "@/components/Wallet"
import { RequestTerms } from "@/components/RequestTerms"
import { parVaultAbi } from "@/lib/abi"
import { MARKET } from "@/lib/config"
import { fmtDuration, fmtMusd, fmtPct, fmtRatio, short } from "@/lib/format"
import { useChainNow, useMe, useTx, useVaultsOf } from "@/lib/hooks"
import { RKIND, R_FILLED, R_OPEN, premiumYield, useRequests, type CoverRequest } from "@/lib/requests"
import { Addr, Badge, Button, Card, Empty, LinkButton, NgnHint, PageHead, Problem, Segmented, TxStatus, inputCls } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000"

export default function MarketPage() {
  const { requests, error, loaded, refetch } = useRequests()
  const [view, setView] = useState<"open" | "filled">("open")
  const now = useChainNow()
  if (MARKET === Z)
    return (
      <Problem title="The market isn't deployed on this network yet">
        Set NEXT_PUBLIC_MARKET to the ParMarket address.
      </Problem>
    )
  const open = requests.filter((r) => r.status === R_OPEN && Number(r.deadline) >= now)
  const filled = requests.filter((r) => r.status === R_FILLED)
  const list = view === "open" ? open : filled
  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Underwriting market"
        title="Back a promise."
        muted="Earn the premium."
        sub="Tenants and merchants post the cover they need and escrow a premium in MUSD. Back a request from your vault: the guarantee is created and stress-tested in the same transaction, and the premium is paid to you."
        right={
          <div className="flex gap-2">
            <LinkButton href="/market/mine" variant="ghost">
              My requests
            </LinkButton>
            <LinkButton href="/market/new">Request cover</LinkButton>
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "open", label: `Open (${open.length})` },
            { value: "filled", label: `Backed (${filled.length})` },
          ]}
        />
        <Link href="/pilot" className="text-sm text-btc-ink hover:underline">
          Lagos pilot →
        </Link>
      </div>
      {error && <p className="rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">Couldn&apos;t refresh requests: {error}</p>}
      {!loaded ? (
        <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
      ) : list.length === 0 ? (
        <Empty>
          {view === "open" ? (
            <>
              No open requests right now. <Link className="text-fg underline" href="/market/new">Post one</Link>.
            </>
          ) : (
            "Nothing backed yet."
          )}
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <RequestCard key={String(r.id)} r={r} now={now} onDone={refetch} />
          ))}
        </div>
      )}
    </div>
  )
}

function RequestCard({ r, now, onDone }: { r: CoverRequest; now: number; onDone: () => void }) {
  const y = premiumYield(r)
  const [backing, setBacking] = useState(false)
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={r.kind === 0 ? "btc" : "muted"}>{RKIND[r.kind]}</Badge>
            <span className="num text-xs text-subtle">#{String(r.id)}</span>
          </div>
          <div className="num mt-3 text-3xl font-medium tracking-tight">{fmtMusd(r.cap, 0)} MUSD</div>
          <div className="text-xs text-muted">
            cover <NgnHint wei={r.cap} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Premium</div>
          <div className="num text-xl font-medium text-ok">{fmtMusd(r.premium, 2)}</div>
          <div className="text-xs text-subtle">{y !== undefined ? `≈ ${fmtPct(y, 1)} a year` : "MUSD"}</div>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted">
        <RequestTerms r={r} />
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        <span>
          Pays <Addr a={r.beneficiary} />
        </span>
        <span>
          Requested by <Addr a={r.requester} />
        </span>
        {r.status === R_OPEN ? <span>Open for {fmtDuration(Math.max(0, Number(r.deadline) - now))}</span> : null}
      </div>
      {r.status === R_FILLED ? (
        <div className="flex items-center gap-3 text-sm">
          <Badge tone="ok">Backed</Badge>
          <Link className="font-medium underline decoration-line-strong underline-offset-4 hover:decoration-btc" href={`/c/${r.vault}/${r.commitmentId}`}>
            View certificate →
          </Link>
        </div>
      ) : backing ? (
        <BackPanel r={r} onDone={onDone} onClose={() => setBacking(false)} />
      ) : (
        <div>
          <Button onClick={() => setBacking(true)}>Back this request</Button>
        </div>
      )}
    </Card>
  )
}

function BackPanel({ r, onDone, onClose }: { r: CoverRequest; onDone: () => void; onClose: () => void }) {
  const { me, isConnected } = useMe()
  const { vaults } = useVaultsOf(me)
  const [vault, setVault] = useState<string>("")
  const v = (vault || vaults[vaults.length - 1]) as Address | undefined
  const { data: fit } = useReadContract({ address: v, abi: parVaultAbi, functionName: "health", args: [r.cap], query: { enabled: !!v, refetchInterval: 10_000 } })
  const t = useTx(() => onDone())
  if (!isConnected)
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl bg-soft p-4 text-sm">
        Connect the wallet that owns your vault.
        <WalletButton align="left" />
      </div>
    )
  if (me && me.toLowerCase() === r.requester.toLowerCase()) return <p className="text-sm text-muted">This is your own request; someone else has to back it.</p>
  if (me && r.kind === 1 && me.toLowerCase() === r.arbiter.toLowerCase()) return <p className="text-sm text-muted">You&apos;re the arbiter on this bond, so you can&apos;t back it.</p>
  if (vaults.length === 0)
    return (
      <p className="text-sm text-muted">
        You need a vault with an open trove to back requests. <Link className="text-fg underline" href="/vault">Open one</Link>.
      </p>
    )
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-4 text-sm">
      {vaults.length > 1 && (
        <select className={inputCls} value={v} onChange={(e) => setVault(e.target.value)}>
          {vaults.map((x, i) => (
            <option key={x} value={x}>
              Vault {i + 1} · {short(x)}
            </option>
          ))}
        </select>
      )}
      {fit ? (
        <div className="flex items-center gap-2">
          <Badge tone={fit[0] ? "ok" : "bad"}>{fit[0] ? "Fits" : "Doesn't fit"}</Badge>
          <span className="text-muted">your vault&apos;s stressed ratio would be {fmtRatio(fit[1])}</span>
        </div>
      ) : (
        <span className="text-muted">Checking your vault…</span>
      )}
      <p className="text-xs text-muted">
        Backing creates this guarantee in your vault (it reserves {fmtMusd(r.cap, 0)} MUSD of capacity) and pays you {fmtMusd(r.premium, 2)} MUSD now. If the
        payer misses a payment, your vault pays the beneficiary.
      </p>
      <div className="flex gap-2">
        <Button busy={t.busy} disabled={!fit?.[0]} onClick={() => t.send({ address: v!, abi: parVaultAbi, functionName: "fillRequest", args: [MARKET, r.id] })}>
          Back with this vault
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <TxStatus tx={t} />
    </div>
  )
}

"use client"

import Link from "next/link"
import { WalletButton } from "@/components/Wallet"
import { RequestTerms } from "@/components/RequestTerms"
import { parMarketAbi } from "@/lib/abi"
import { MARKET } from "@/lib/config"
import { fmtDuration, fmtMusd } from "@/lib/format"
import { useChainNow, useMe, useTx } from "@/lib/hooks"
import { RKIND, R_CANCELLED, R_FILLED, R_OPEN, useRequests, type CoverRequest } from "@/lib/requests"
import { Addr, Badge, Button, Card, Empty, LinkButton, NgnHint, PageHead, Problem, TxStatus } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000"

export default function MyRequestsPage() {
  const { me, isConnected } = useMe()
  const { requests, loaded, error, refetch } = useRequests()
  const now = useChainNow()
  if (MARKET === Z) return <Problem title="The market isn't deployed on this network yet" />
  const lc = me?.toLowerCase()
  const mine = requests.filter((r) => r.requester.toLowerCase() === lc)
  const forMe = requests.filter((r) => r.beneficiary.toLowerCase() === lc && r.status === R_FILLED)
  return (
    <div className="flex flex-col gap-8">
      <PageHead
        eyebrow="Underwriting market"
        title="Your requests."
        sub="Requests you posted, and guarantees backed for you. Cancel an open request any time for a full premium refund."
        right={<LinkButton href="/market/new">Request cover</LinkButton>}
      />
      {!isConnected ? (
        <Card className="flex flex-col items-center gap-4 py-14 text-center">
          <div className="text-lg font-medium">Connect your wallet to see your requests</div>
          <WalletButton align="left" />
        </Card>
      ) : (
        <>
          {error && <p className="rounded-lg bg-warn-wash px-3 py-2 text-sm text-warn">Couldn&apos;t refresh requests: {error}</p>}
          {!loaded ? (
            <div className="h-40 animate-pulse rounded-2xl border border-line bg-white" />
          ) : mine.length === 0 ? (
            <Empty>
              You haven&apos;t posted a request. <Link className="text-fg underline" href="/market/new">Request cover</Link> or see the{" "}
              <Link className="text-fg underline" href="/pilot">Lagos pilot</Link>.
            </Empty>
          ) : (
            <div className="flex flex-col gap-3">
              {mine.map((r) => (
                <Row key={String(r.id)} r={r} now={now} onDone={refetch} />
              ))}
            </div>
          )}
          {forMe.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">Guarantees in your favour</h2>
              {forMe.map((r) => (
                <Card key={String(r.id)} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="num font-medium">{fmtMusd(r.cap, 0)} MUSD</span> · {RKIND[r.kind]} from <Addr a={r.requester} />
                  </div>
                  <Link className="text-sm font-medium underline decoration-line-strong underline-offset-4 hover:decoration-btc" href={`/c/${r.vault}/${r.commitmentId}`}>
                    Certificate →
                  </Link>
                </Card>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Row({ r, now, onDone }: { r: CoverRequest; now: number; onDone: () => void }) {
  const t = useTx(() => onDone())
  const expired = r.status === R_OPEN && Number(r.deadline) < now
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="num text-xs text-subtle">#{String(r.id)}</span>
            <Badge tone={r.status === R_FILLED ? "ok" : r.status === R_CANCELLED ? "muted" : expired ? "warn" : "btc"}>
              {r.status === R_FILLED ? "Backed" : r.status === R_CANCELLED ? "Cancelled" : expired ? "Expired, not backed" : "Open"}
            </Badge>
            <span className="text-xs text-muted">{RKIND[r.kind]}</span>
          </div>
          <div className="num mt-2 text-2xl font-medium tracking-tight">{fmtMusd(r.cap, 0)} MUSD</div>
          <NgnHint wei={r.cap} />
        </div>
        <div className="text-right text-sm">
          <div className="text-xs text-muted">Premium</div>
          <div className="num font-medium">{fmtMusd(r.premium, 2)} MUSD</div>
          {r.status === R_OPEN && !expired && <div className="text-xs text-subtle">open {fmtDuration(Math.max(0, Number(r.deadline) - now))} more</div>}
        </div>
      </div>
      <p className="text-sm text-muted">
        <RequestTerms r={r} /> · pays <Addr a={r.beneficiary} />
      </p>
      {r.status === R_FILLED ? (
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/c/${r.vault}/${r.commitmentId}`}>Certificate</LinkButton>
          {r.kind === 0 && (
            <LinkButton href={`/pay/${r.vault}/${r.commitmentId}`} variant="ghost">
              Pay installments
            </LinkButton>
          )}
        </div>
      ) : r.status === R_OPEN ? (
        <div className="flex flex-col items-start gap-2">
          <Button variant="ghost" busy={t.busy} onClick={() => t.send({ address: MARKET, abi: parMarketAbi, functionName: "cancel", args: [r.id] })}>
            Cancel and refund {fmtMusd(r.premium, 2)} MUSD
          </Button>
          <TxStatus tx={t} />
        </div>
      ) : null}
    </Card>
  )
}

import { fmtDate, fmtDuration, fmtMusd } from "@/lib/format"
import type { CoverRequest } from "@/lib/requests"
import { Addr } from "@/components/ui"

export function RequestTerms({ r }: { r: CoverRequest }) {
  return r.kind === 0 ? (
    <>
      <span className="num text-fg">{fmtMusd(r.installment, 0)} MUSD</span> × {r.count}, every {fmtDuration(r.period)}, first due {fmtDate(r.start)} · grace{" "}
      {fmtDuration(r.grace)}
    </>
  ) : (
    <>
      Claim bond until {fmtDate(r.expiry)} · challenge window {fmtDuration(r.challengeWindow)} · arbiter <Addr a={r.arbiter} />
    </>
  )
}

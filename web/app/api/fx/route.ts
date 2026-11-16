import { NextResponse } from "next/server"
import { getFx } from "@/lib/fx-server"

/**
 * USD→NGN reference rate for "≈ ₦" hints (MUSD is treated as $1). Fetched server-side and cached for an
 * hour, so visitors' browsers never contact the rate provider. Rates by ExchangeRate-API (open access).
 */
export const revalidate = 3600

export async function GET() {
  const fx = await getFx()
  return NextResponse.json(fx ?? { error: "unavailable" }, { status: fx ? 200 : 503, headers: { "cache-control": "public, max-age=600, s-maxage=3600" } })
}

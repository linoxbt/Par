import type { Metadata } from "next"
import { createPublicClient, formatUnits, http, isAddress, type Address } from "viem"
import { parFactoryAbi, parVaultAbi } from "@/lib/abi"
import { chain, FACTORY, RPC_URL } from "@/lib/config"

const fmt = (v: bigint) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(formatUnits(v, 18)))
const KIND = ["Installment guarantee", "Claim bond", "Circuit clearing line"]

const ZERO = "0x0000000000000000000000000000000000000000"

/** Child metadata replaces the root's openGraph/twitter objects wholesale, so restate image, url and card. */
function meta(title: string, description: string, url: string): Metadata {
  return {
    title,
    description,
    openGraph: { type: "website", siteName: "Par", title, description, images: ["/opengraph-image"], url },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
  }
}

/**
 * Server-side share preview for certificate links (WhatsApp, Telegram, X): reads the commitment
 * from chain so the preview says what is guaranteed. Only for vaults the Par factory created:
 * any other contract could report made-up cover, so those get the generic preview. Falls back to
 * the generic preview on any error.
 */
export async function generateMetadata({ params }: { params: { vault: string; id: string } }): Promise<Metadata> {
  const valid = isAddress(params.vault) && /^\d{1,30}$/.test(params.id)
  const url = valid ? `/c/${params.vault}/${params.id}` : "/"
  const generic = meta("Guarantee certificate", "A Bitcoin-backed guarantee on Mezo, verifiable onchain.", url)
  if (!valid || FACTORY === ZERO) return generic
  try {
    const pc = createPublicClient({ chain, transport: http(RPC_URL, { timeout: 4000 }) })
    const isVault = await pc.readContract({ address: FACTORY, abi: parFactoryAbi, functionName: "isVault", args: [params.vault as Address] })
    if (isVault !== true) return generic
    const c = (await pc.readContract({
      address: params.vault as Address,
      abi: parVaultAbi,
      functionName: "getCommitment",
      args: [BigInt(params.id)],
    })) as unknown as { kind: number; status: number; cap: bigint; paidOut: bigint; installment: bigint; count: number }
    if (!c || Number(c.status) === 0) return generic
    const kind = KIND[Number(c.kind)] ?? "Guarantee"
    const active = Number(c.status) === 1
    const title = active ? `${kind} · ${fmt(c.cap - c.paidOut)} MUSD cover` : `${kind} · closed`
    const description = !active
      ? "This Par guarantee is closed. See its history onchain."
      : Number(c.kind) === 0
        ? `${fmt(c.installment)} MUSD × ${c.count} installments, backed by BTC locked on Mezo. Pays automatically if a payment is missed.`
        : `Up to ${fmt(c.cap - c.paidOut)} MUSD, backed by BTC locked on Mezo. Verify it live onchain.`
    return meta(title, description, url)
  } catch {
    return generic
  }
}

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return children
}

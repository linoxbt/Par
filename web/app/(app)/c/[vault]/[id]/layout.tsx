import type { Metadata } from "next"
import { createPublicClient, formatUnits, http, isAddress, type Address } from "viem"
import { parVaultAbi } from "@/lib/abi"
import { chain, RPC_URL } from "@/lib/config"

const fmt = (v: bigint) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(formatUnits(v, 18)))
const KIND = ["Installment guarantee", "Claim bond", "Circuit clearing line"]

/**
 * Server-side share preview for certificate links (WhatsApp, Telegram, X): reads the commitment
 * from chain so the preview says what is guaranteed. Falls back to a generic title on any error.
 */
export async function generateMetadata({ params }: { params: { vault: string; id: string } }): Promise<Metadata> {
  const generic: Metadata = { title: "Guarantee certificate", description: "A Bitcoin-backed guarantee on Mezo, verifiable onchain." }
  if (!isAddress(params.vault) || !/^\d{1,30}$/.test(params.id)) return generic
  try {
    const pc = createPublicClient({ chain, transport: http(RPC_URL, { timeout: 4000 }) })
    const c = (await pc.readContract({
      address: params.vault as Address,
      abi: parVaultAbi,
      functionName: "getCommitment",
      args: [BigInt(params.id)],
    })) as unknown as { kind: number; status: number; cap: bigint; paidOut: bigint; installment: bigint; count: number }
    if (!c || Number(c.status) === 0) return generic
    const kind = KIND[Number(c.kind)] ?? "Guarantee"
    const active = Number(c.status) === 1
    const title = `${kind} · ${fmt(c.cap - c.paidOut)} MUSD cover${active ? "" : " (closed)"}`
    const description =
      Number(c.kind) === 0
        ? `${fmt(c.installment)} MUSD × ${c.count} installments, backed by BTC locked on Mezo. Pays automatically if a payment is missed.`
        : `Up to ${fmt(c.cap)} MUSD, backed by BTC locked on Mezo. Verify it live onchain.`
    return { title, description, openGraph: { title, description }, twitter: { title, description } }
  } catch {
    return generic
  }
}

export default function CertificateLayout({ children }: { children: React.ReactNode }) {
  return children
}

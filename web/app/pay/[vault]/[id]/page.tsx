"use client"

import Link from "next/link"
import { type Address } from "viem"
import { useReadContract, useReadContracts } from "wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { parVaultAbi } from "@/lib/abi"
import { erc20Abi } from "@/lib/mezoAbi"
import { fmtDate, fmtDuration, fmtMusd } from "@/lib/format"
import { useChainNow, useCommitment, useMe, useProtocol, useTx } from "@/lib/hooks"
import { Addr, Button, Card, Empty, TxStatus } from "@/components/ui"

const Z = "0x0000000000000000000000000000000000000000" as Address

export default function PayPage({ params }: { params: { vault: string; id: string } }) {
  const vault = params.vault as Address
  const id = BigInt(params.id)
  const { me, isConnected } = useMe()
  const p = useProtocol()
  const now = useChainNow()
  const { c } = useCommitment(vault, id)
  const { data: settled, refetch: refetchSettled } = useReadContracts({
    contracts: Array.from({ length: c?.count ?? 0 }, (_, i) => ({
      address: vault,
      abi: parVaultAbi,
      functionName: "installmentSettled" as const,
      args: [id, BigInt(i)] as const,
    })),
    allowFailure: false,
    query: { enabled: !!c, refetchInterval: 6000 },
  })
  const { data: bal, refetch: refetchBal } = useReadContract({
    address: p?.musd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [me ?? Z],
    query: { enabled: !!me && !!p },
  })
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: p?.musd,
    abi: erc20Abi,
    functionName: "allowance",
    args: [me ?? Z, vault],
    query: { enabled: !!me && !!p },
  })
  const tApprove = useTx(() => refetchAllowance())
  const tPay = useTx(() => {
    refetchSettled()
    refetchBal()
    refetchAllowance()
  })

  if (!isConnected)
    return (
      <Empty>
        <p className="mb-4">Connect the wallet that pays the installments.</p>
        <div className="flex justify-center">
          <ConnectButton />
        </div>
      </Empty>
    )
  if (!c || !p) return <Card>Loading…</Card>
  if (c.kind !== 0) return <Empty>This commitment has no installments.</Empty>

  const next = settled ? settled.findIndex((s) => !s) : -1
  const due = next >= 0 ? Number(c.start) + next * c.period : 0
  const needApprove = (allowance ?? 0n) < c.installment

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold">Pay an installment</h1>
      <Card className="flex flex-col gap-3 text-sm">
        <p className="text-ink-300">
          Pays <span className="num text-white">{fmtMusd(c.installment)} MUSD</span> straight to <Addr a={c.beneficiary} /> through the
          vault, and marks the installment as paid so the guarantee doesn&apos;t fire.
        </p>
        {c.status !== 1 ? (
          <p className="text-ink-400">This guarantee is closed.</p>
        ) : next < 0 ? (
          <p className="text-ok">All installments are settled.</p>
        ) : (
          <>
            <div className="rounded-xl bg-ink-950 p-4">
              <div className="text-xs uppercase text-ink-400">Next: installment {next + 1} of {c.count}</div>
              <div className="num mt-1 text-2xl">{fmtMusd(c.installment)} MUSD</div>
              <div className="mt-1 text-xs text-ink-400">
                due {fmtDate(due)} · {now < due ? `in ${fmtDuration(due - now)}` : now < due + c.grace ? `late, vault pays in ${fmtDuration(due + c.grace - now)}` : "missed: the vault will cover it"}
              </div>
            </div>
            <p className="text-xs text-ink-400">Your MUSD: {fmtMusd(bal)}</p>
            <div className="flex gap-2">
              {needApprove && (
                <Button busy={tApprove.busy} onClick={() => tApprove.send({ address: p.musd, abi: erc20Abi, functionName: "approve", args: [vault, c.installment * BigInt(c.count - next)] })}>
                  1. Approve MUSD
                </Button>
              )}
              <Button
                busy={tPay.busy}
                disabled={needApprove || (bal ?? 0n) < c.installment}
                onClick={() => tPay.send({ address: vault, abi: parVaultAbi, functionName: "payInstallment", args: [id, BigInt(next)] })}
              >
                {needApprove ? "2. " : ""}Pay {fmtMusd(c.installment, 0)} MUSD
              </Button>
            </div>
            <TxStatus tx={tApprove} />
            <TxStatus tx={tPay} />
          </>
        )}
      </Card>
      <Link href={`/c/${vault}/${id}`} className="text-sm text-btc hover:underline">
        View certificate →
      </Link>
    </div>
  )
}

// The demo invoice graph (2,900 MUSD gross, 100 MUSD net): wholesaler owes importer 1000,
// repairer owes wholesaler 1000, importer owes repairer 900. Posted round-robin in small
// chunks so no shop's running net payable exceeds one chunk. That keeps the clearing lines
// (and the BTC behind them) small without changing the totals.
import { ethers } from "hardhat"
import type { Signer } from "ethers"

export const GRAPH: [number, number, number][] = [
  [0, 1, 1000],
  [1, 2, 1000],
  [2, 0, 900],
]

export async function postGraph(
  circuit: any,
  circleId: bigint,
  shops: { name: string; s: Signer }[],
  chunk: number,
) {
  const left = GRAPH.map((g) => g[2])
  while (left.some((x) => x > 0)) {
    for (let i = 0; i < GRAPH.length; i++) {
      if (left[i] <= 0) continue
      const [cr, db] = GRAPH[i]
      const amt = Math.min(chunk, left[i])
      left[i] -= amt
      const id = await circuit.nextInvoiceId()
      const debtor = await shops[db].s.getAddress()
      await (await circuit.connect(shops[cr].s).createInvoice(circleId, debtor, ethers.parseEther(String(amt)), ethers.id(`demo-${id}`))).wait()
      await (await circuit.connect(shops[db].s).acceptInvoice(id)).wait()
      console.log(`invoice #${id}: ${shops[db].name} owes ${shops[cr].name} ${amt} MUSD`)
    }
  }
}

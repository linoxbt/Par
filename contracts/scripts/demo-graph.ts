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

// The public RPC is load-balanced: a follow-up call can hit a node a block behind. Retry.
async function retry<T>(f: () => Promise<T>, n = 6): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await f()
    } catch (e) {
      if (i >= n) throw e
      await new Promise((r) => setTimeout(r, 2500))
    }
  }
}

export async function postGraph(
  circuit: any,
  circleId: bigint,
  shops: { name: string; s: Signer }[],
  chunk: number,
) {
  const left = GRAPH.map((g) => g[2])
  let start = 0
  // Resumable within a cycle: count invoices already accepted this cycle and continue in order.
  const addrs = await Promise.all(shops.map((x) => x.s.getAddress()))
  const cyc = await circuit.currentCycle(circleId)
  const n = Number(await circuit.nextInvoiceId())
  for (let id = 0; id < n; id++) {
    const inv = await circuit.invoices(id)
    if (inv.circleId !== circleId || inv.cycle !== cyc) continue
    const i = GRAPH.findIndex(([cr, db]) => addrs[cr] === inv.creditor && addrs[db] === inv.debtor)
    if (i < 0) continue
    if (Number(inv.status) === 1) {
      // a pending one may be out of round-robin order: reject it and re-post in order
      await (await circuit.connect(shops[GRAPH[i][0]].s).rejectInvoice(id)).wait()
      console.log(`rejected stale pending invoice #${id}`)
    } else if (Number(inv.status) === 2) {
      left[i] -= Number(ethers.formatEther(inv.amount))
      start = (i + 1) % GRAPH.length
    }
  }
  while (left.some((x) => x > 0)) {
    for (let k = 0; k < GRAPH.length; k++) {
      const i = (start + k) % GRAPH.length
      if (left[i] <= 0) continue
      const [cr, db] = GRAPH[i]
      const amt = Math.min(chunk, left[i])
      left[i] -= amt
      const id = await circuit.nextInvoiceId()
      const debtor = await shops[db].s.getAddress()
      await (await circuit.connect(shops[cr].s).createInvoice(circleId, debtor, ethers.parseEther(String(amt)), ethers.id(`demo-${id}`))).wait()
      await retry(async () => (await circuit.connect(shops[db].s).acceptInvoice(id)).wait())
      console.log(`invoice #${id}: ${shops[db].name} owes ${shops[cr].name} ${amt} MUSD`)
    }
    start = 0
  }
}

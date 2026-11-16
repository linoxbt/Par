# Par: 2-minute pitch video script

Record your screen (phone or desktop) with your voice over it. Keep it at 2:00. Upload to YouTube (unlisted) or
Loom and paste the link into the Akindo form.

**Before recording:** open https://par-rosy.vercel.app in one tab, `/docs` in another, and the explorer page for
ParCircuit `0x198099cF3C11A6A7E0f107a63B013E20A96f9CB1`. If the demo circle has been re-seeded, open
`/circuit/0` too.

| Time | Screen | Say |
| ---- | ------ | --- |
| 0:00 | Landing hero | "In Lagos you pay one to two years of rent upfront. Merchants lock cash as deposits. Small businesses run on IOUs that break when one person defaults. That's idle money, everywhere." |
| 0:15 | Scroll to "How it works" | "Par turns the undrawn capacity of a MUSD trove into promises. You lock Bitcoin once in your own vault on Mezo. The vault opens a MUSD trove, and you reserve part of its unused capacity against commitments. Nothing is drawn until a promise is called." |
| 0:35 | `/vault/new-guarantee` (rent, 500 × 12, cover 1,500) | "Here I guarantee my landlord's rent. Before the promise can exist, the contract checks it survives a 40% Bitcoin crash with every promise called at once and the vault still above 160%." |
| 0:55 | A certificate `/c/<vault>/<id>` on a phone | "This is what the landlord gets: a live certificate. Cover left, expiry, and how far Bitcoin can fall before cover is at risk. If a payment is missed, after the grace period the vault pays the landlord in MUSD: from its buffer first, then by minting MUSD from the trove. No one has to approve it." |
| 1:15 | `/circuit/0`, press **Clear cycle** | "Par Circuit does the same for trade credit. Shops invoice each other; the contract nets every invoice. In our testnet demo, 2,900 MUSD of invoices cleared with just 100 MUSD moving. When a shop didn't pay, our keeper force-settled it from the credit line in its vault." |
| 1:35 | Explorer: verified contracts; GitHub tests | "It's built on MUSD's internals: BorrowerOperations, TroveManager, the price feed, Recovery Mode rules. Three verified contracts on Mezo testnet, 44 tests including a randomized invariant test, and a keeper running on Railway." |
| 1:50 | Landing closing section | "Par extends MUSD from borrowing against Bitcoin to guaranteeing and clearing with it. Next: pilots with Lagos merchants, an underwriting market, then mainnet. Your Bitcoin, as a promise." |

Tips: speak slowly; zoom the browser to 110% for legibility; trim dead time between screens.

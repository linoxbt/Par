| Term | Meaning |
| --- | --- |
| **MUSD** | Mezo's Bitcoin-backed stablecoin, minted against BTC in troves. |
| **Trove** | A BTC-collateralised MUSD loan position. Each Par vault owns exactly one. |
| **Vault** | Your own `ParVault` contract (an EIP-1167 clone). It is the trove's borrower and holds your commitments. |
| **Capacity** | The most a trove can ever owe, fixed at open: collateral × price ÷ 1.1. Only `refinance` changes it. |
| **Buffer** | Liquid MUSD held by the vault, used before any new debt. Starts as the 1,800 MUSD minimum loan. |
| **Idle reserve** | BTC held by the vault itself (not trove collateral), used to top up the trove in Recovery Mode. |
| **Commitment** | A promise backed by the vault: Scheduled (installments), Claim (bond) or ClearingLine (Circuit). |
| **Cap** | The most the vault will ever pay on one commitment. |
| **Reserved** | Sum of `cap − paidOut` over all active commitments. |
| **Expiry** | After it, a commitment cannot be triggered and anyone can close it. |
| **Grace** | Time after an installment's due date before a miss can be triggered. |
| **Challenge window** | Time after a claim is filed during which it can be disputed. |
| **Arbiter** | The address that decides disputed claims on a bond. |
| **Certificate** | The public page for a commitment at `/c/<vault>/<id>`. |
| **Circle** | A closed group of businesses in Par Circuit, with a cycle length and settle window. |
| **Cycle** | A numbered period in a circle. Invoices net within a cycle. |
| **Net** | A member's position in a cycle: positive receives, negative owes. |
| **Settle window** | Time after a cycle closes for net debtors to pay voluntarily. |
| **Force-settle** | Drawing a late debtor's clearing line to pay what they owe. |
| **Netting efficiency** | Share of gross invoice volume that never needed money to move. |
| **ICR** | Individual collateral ratio of a trove: collateral value ÷ debt. |
| **TCR** | Total collateral ratio of the whole MUSD system. |
| **MCR** | 110%. Below it a trove can be liquidated. |
| **CCR** | 150%. When TCR is below it, Mezo is in Recovery Mode. |
| **Recovery Mode** | When TCR is below 150%, MUSD only allows new debt together with a collateral top-up. |
| **Stress test** | Par's check that the vault stays at or above 160% if BTC fell 40% and every commitment were called. |
| **Keeper** | A bot that triggers missed payments, undisputed claims and force-settlements. Anyone can do the same. |
| **Hints** | `up` / `lo` addresses that help MUSD insert a trove into its sorted list. Zero addresses work, at higher gas. |

# Demo (2 minutes 30)

Demo parameters: installment period 120 s, grace 10 s, Circuit cycle 180 s, settle window 60 s.
Pre-create the Circuit vaults and lines before recording (`contracts/scripts/seed-demo.ts`), then do the
guarantee live. Keep the keeper running with `INTERVAL_MS=15000`.

| Time | Screen | Say |
| ---- | ------ | --- |
| 0:00 | Landing | "In Lagos you pay one to two years of rent upfront. Merchants lock cash as deposits. Businesses run on IOUs that break when one person defaults. All of that is idle money." |
| 0:15 | `/vault`: connect Xverse through Passport, open vault with 0.1 BTC | "I lock Bitcoin in a Par vault on Mezo. I haven't borrowed anything beyond the minimum. This is undrawn MUSD capacity, at a locked rate." |
| 0:35 | `/vault/new-guarantee`: 12 × 500 MUSD, cover 1,500, schedule "Demo (2 min)" | "I promise my landlord three months of rent. The vault checks that the promise survives a 40% Bitcoin crash before it lets me make it." |
| 0:55 | Phone: `/c/[vault]/[id]` | "This is what the landlord sees: guaranteed, covered even if BTC falls 45%, and no money has moved." |
| 1:10 | `/pay/[vault]/[id]`: pay month 1, then let month 2 lapse (countdown on the certificate) | "Month two, I don't pay." |
| 1:25 | Keeper fires; certificate payout row; explorer tab shows the mint | "The block after the promise broke, MUSD that didn't exist a second ago lands in the landlord's wallet. My Bitcoin never moved." |
| 1:45 | `/circuit/[circle]`: three shops (importer, wholesaler, repairer), tangled invoice graph | "Now three businesses that sell to each other on credit use Par." |
| 1:55 | Click **Clear cycle** | "2,900 MUSD of invoices. 100 MUSD actually moves. 96.55% netted." |
| 2:10 | Defaulter skips; keeper force-settles; creditor claims | "One shop doesn't pay. Their vault pays for them. Nobody chases anyone." |
| 2:20 | Closing card | "Par: your Bitcoin, as a promise. Built on MUSD's locked-rate capacity, and it even handles Recovery Mode." |

**Backup plan:** record the guarantee flow and the Circuit flow as two separate clips the night before. If the
testnet or keeper hiccups live, play the clips. Always show the explorer tab for the mint. That's the proof.

Tip: with 0.1 BTC the 1,800 MUSD seed buffer pays the first 1,500 of rent without new debt. To show a mint on
camera, withdraw most of the buffer first (Vault → Withdraw buffer) so the missed payment has to be minted.

# Judge Q&A

**Isn't this just Aave credit delegation?**
No. On Aave the rate floats and the pool can be fully borrowed by other people right when a claim arrives, so a
promise can fail for reasons that have nothing to do with you. MUSD is minted, not borrowed from a pool, and a
Mezo trove locks its rate across its whole capacity at open. So a Par promise only depends on your own Bitcoin
and your own trove, and we check that it survives a forty percent Bitcoin drop before you can make it.

**What happens if Bitcoin crashes?**
Every commitment has to pass a stress test when it's created: if Bitcoin falls forty percent and every promise
gets called at once, the vault must still be above one hundred and sixty percent. If the price falls past that,
the vault can't make new promises and the owner gets warned to add collateral. If it falls far enough to hit
liquidation, the guarantee can fail, and the certificate shows exactly how far Bitcoin can fall before that
happens. We don't hide that number.

**What about Recovery Mode?**
In Recovery Mode, MUSD only lets you add debt if you add collateral at the same time and your ratio improves.
So a vault can't just mint. Par handles this: the claim stays valid, the vault calculates exactly how much
Bitcoin it needs to add, and it pays as soon as that reserve is there. It's tested end to end.

**Why would a landlord accept MUSD?**
Honestly, today most landlords want naira, and that's a real gap. The first users will be crypto-native
counterparties: P2P merchants, OTC desks and freelance clients. For everyone else, MUSD already bridges to Base
and Ethereum through Wormhole, so the next step is an automatic off-ramp to USDC and local currency.

**Who decides disputed claims?**
For scheduled payments, nobody has to decide, because the contract can see whether the payment arrived. For
discretionary claims there's a challenge window, and only disputed claims go to an arbiter that both sides agree
on when the guarantee is created. Later that can become a decentralized court.

**How does this grow Mezo?**
Every promise is Bitcoin locked in a trove on Mezo, even when no MUSD is borrowed. Every claim mints MUSD, and
Circuit makes MUSD the unit a whole trade network settles in. Phase two lets Bitcoin holders earn premiums by
backing other people's guarantees, which is a new kind of yield that isn't lending and isn't emissions.

**Why does a vault borrow 1,800 MUSD at the start?**
That's MUSD's minimum loan. We turn it into a feature: it sits in the vault as a buffer and pays the first
claims without adding new debt. Later it can sit in the MUSD savings vault so the yield covers the interest.

# Akindo submission: copy-paste fields

Wave: **2nd Wave** · Buildathon: *Build with MUSD and MEZO* · Track: **Track 1 (DeFi)**

Files to upload: `par-icon-512.png` (team/product icon), `Par-deck.pdf` (deck). Video: see `video-script.md`.

---

## 1. Create Team

**Icon:** `docs/submission/par-icon-512.png`

**Team name:** `Par`

**About this team** (Markdown):

```markdown
**Par** builds Bitcoin-backed guarantees and trade-credit clearing on Mezo.

We turn the *undrawn* borrowing capacity of a MUSD trove into promises people can rely on: rent guarantees,
supplier terms, performance bonds, and credit lines pledged to a trade network. Nothing is drawn until a
promise is called; when one breaks, the vault pays in MUSD automatically.

- 🔗 Live app: https://par-rosy.vercel.app
- 📚 Docs: https://par-rosy.vercel.app/docs
- 🐙 GitHub: https://github.com/linoxbt/par

Built by **lino** (contracts, keeper, frontend). We plan to keep building after the hackathon: pilots with
Lagos P2P merchants and a trade cluster for Par Circuit, then an underwriting market and mainnet.
```

**Buildathon Grant Recipient:** `lino`

---

## 2. Product registration / submission form

**Project name:** `Par`

**Project category (3–5 words):** `Bitcoin-backed guarantees, credit clearing`

**TL;DR (one sentence):**
Par turns the undrawn capacity of a MUSD trove into Bitcoin-backed guarantees and self-clearing trade credit that pay out in MUSD automatically when a promise breaks.

**How it works** (problem, function, MUSD positioning):

```markdown
**Problem.** Guarantees lock up cash: tenants in Lagos pay one to two years of rent upfront, merchants post
deposits that earn nothing, and trade credit between small businesses breaks when one link in an IOU chain
defaults, even when the whole loop nets to almost zero.

**How Par works.** A user locks BTC in a Par vault (an EIP-1167 clone they own). The vault opens its own MUSD
trove through BorrowerOperations, so capacity and rate are fixed at open. The owner reserves part of that
*undrawn* capacity against commitments. Every commitment must survive a 40% BTC drop with everything called
at once and the vault still at 160% before it can exist.

- **Par Guarantees:** installment guarantees (rent, supplier terms) pay the beneficiary automatically after a
  missed payment plus grace; claim bonds pay after an uncontested challenge window or an independent arbiter's
  decision (7-day deadline). Each guarantee has a live, shareable certificate page.
- **Par Circuit:** members invoice each other; ParCircuit nets every accepted invoice in O(1). At cycle end only
  net debtors pay. A defaulter is force-settled from the clearing line pledged in their vault. In our testnet
  demo, 2,900 MUSD of invoices cleared with 100 MUSD moving (96.55% netted), and the keeper force-settled the
  defaulter on its own.

**Payout waterfall:** the vault's MUSD buffer first, then minting new MUSD from the trove; in Recovery Mode the
vault tops up with its idle BTC so the draw stays within MUSD's rules (MCR 110%, CCR 150%).

**MUSD positioning.** Par integrates MUSD at the protocol level (BorrowerOperations, TroveManager, PriceFeed,
HintHelpers/SortedTroves), not just the token. Every Par promise is a new MUSD trove holding BTC; every called
promise mints MUSD; every guarantee, invoice and settlement is denominated in MUSD. It extends MUSD from
"borrow against Bitcoin" to "guarantee and clear with Bitcoin".
```

**Target group:**
BTC holders who want their Bitcoin to work without selling it, and the people they make promises to: tenants
and landlords, merchants and suppliers, and small-business trade networks, starting in Nigeria/Lagos where
upfront rent and cash deposits are the norm. Mid-level users; mobile-first (certificates are shared over
WhatsApp) with a desktop app for vault owners. Fits Track 1: it makes MUSD productive capital for credit
(guarantees, credit lines, netting) on top of Mezo's borrowing.

**Tech stack:**
Solidity 0.8.24 + OpenZeppelin 5 (EIP-1167 clones, ReentrancyGuard, SafeERC20), Hardhat (44 tests incl. a
400-step randomized invariant test), MUSD contracts (BorrowerOperations, TroveManager, PriceFeed, HintHelpers,
SortedTroves). Keeper: Node 20 + viem on Railway. Frontend: Next.js 14, wagmi/viem, Reown AppKit (EVM wallets),
Mezo Passport (Bitcoin wallets: Xverse, Unisat, OKX), Tailwind, deployed on Vercel. Docs: static, Arc-style.

**Track:** `Track 1: DeFi (Borrowing, Lending, Looping, and Yield)`

**Chain deployed on:** `Mezo` (testnet, chain 31611)

**Project status:** `Entirely new (built during the hackathon)`

**Project readiness:** `Testnet deployment`

**Links:**
- Live: https://par-rosy.vercel.app
- GitHub: https://github.com/linoxbt/par
- Docs: https://par-rosy.vercel.app/docs
- Contracts (verified): ParFactory `0x2907A39A64c3f304E7eEdF2F7107Bc825756E4f0`,
  ParVault implementation `0xd8A59feef812EDb58442d4fEe6B1285a205f7E05`,
  ParCircuit `0x198099cF3C11A6A7E0f107a63B013E20A96f9CB1`,
  ParMarket `0xb6e0aaBb4d44944b225cc697205D398DE13114e9` on https://explorer.test.mezo.org
- Deck: `Par-deck.pdf`
- Video: *(your YouTube/Loom link)*

**Future milestones:**
1. **Dec 2026: Pilot.** External audit prep and a parameter review with the Mezo team; first rent-guarantee and
   merchant-bond pilots with Lagos P2P merchants.
2. **Q1 2027: Underwriting market.** BTC holders back other people's commitments for a premium; count a
   committed buffer in health; park the buffer in sMUSD.
3. **Q2 2027: Mainnet.** Audit, mainnet with conservative parameters, one live Circuit trade cluster, WhatsApp
   certificates and claim off-ramps.

**Team info:** lino: founder and builder (smart contracts, keeper, frontend). *(Add your X / LinkedIn.)*

**What changed since Wave 1** *(only if you submitted in Wave 1; delete otherwise)*:
Post-audit contracts (closed a critical reserve-accounting bug and two cycle-locking issues, added consent-based
circle membership, an arbiter deadline, and collateral recovery after liquidation); 44 tests with a randomized
invariant; a rebuilt keeper (alerts, no stalls, no skipped cycles); server-rendered site; Arc-style docs; all
three contracts verified.

# Akindo "Create Product": field by field

**Product icon:** `par-icon-512.png`

**Product name:** `Par`

**Tagline** (≤100 words):
Par turns the undrawn capacity of a MUSD trove into Bitcoin-backed promises. Lock BTC once in your own vault on Mezo, then back rent guarantees, supplier terms, performance bonds, or a credit line in a trade circle. Commitments draw nothing until called; when a payment is missed, the vault pays in MUSD automatically. Par Circuit nets trade invoices onchain: in our demo, 2,900 MUSD of invoices cleared with 100 MUSD moving.

**Product type:** `Functional`

**Image gallery** (upload all 5, in order, from `gallery/`):
1. `1-landing.png`: landing page
2. `2-circuit-board.png`: a Circuit trade circle: 2,900 MUSD of invoices, 100 MUSD owed, 96.55% netted
3. `3-certificate-phone.png`: a guarantee certificate on a phone
4. `4-docs.png`: documentation
5. `5-stress-test.png`: the stress-test section of the landing page

**About** (paste into the Markdown editor, replacing the template headings):

```markdown
## What it does
Par turns the **undrawn borrowing capacity of a MUSD trove** into Bitcoin-backed promises.
You lock BTC once in your own Par vault on Mezo. The vault opens its own MUSD trove, and you reserve part of
its unused capacity against **commitments**:

- **Par Guarantees:** installment guarantees (rent, supplier terms) and claim bonds. If a payment is missed,
  after the grace period the vault pays the beneficiary in MUSD automatically; anyone (or our keeper) can trigger
  it. Claims pay after an uncontested challenge window or an independent arbiter's decision.
- **Par Circuit:** businesses that sell to each other log invoices; the contract nets them as they're accepted.
  At cycle end only net debtors pay; a defaulter is force-settled from the credit line pledged in their vault.

Every promise must survive a **40% BTC crash with everything called at once** and the vault still at 160% before
it can exist. Each guarantee gets a live, shareable certificate page.

## The problem it solves
Guarantees lock up cash. In Lagos, tenants pay one to two years of rent upfront; merchants post deposits that earn
nothing; and trade credit between small businesses breaks when one link in an IOU chain defaults, even when the
loop nets to almost zero. Borrowing just to post collateral costs interest. Par lets a BTC holder make the same
promise without moving money until it's needed, and lets a trade network settle only the net.

## Challenges I ran into
- **MUSD's rules are strict, by design.** Capacity is snapshotted at open, every debt increase must keep the trove
  above 110% and the system above 150%, and Recovery Mode only allows draws combined with a collateral top-up. We
  built a payout waterfall (buffer → mint → BTC top-up from the vault's idle reserve) that stays within all of them.
- **Making cycles always terminate.** An internal audit found ways a debtor's credit line could expire or be
  over-pledged across circles so a cycle could never be collected. We now track every line's obligations across all
  circles and cycles, keep booked debt drawable after expiry, and let creditors claim pro rata once a cycle finalises.
- **Mezo testnet specifics:** getLogs is capped at 10,000 blocks, gas estimation returns no revert data, and the
  explorer doesn't index contracts created inside another transaction. We chunk log scans, simulate before every
  write, and deploy the vault implementation on its own so it can be verified.

## Technologies I used
Solidity 0.8.24, OpenZeppelin 5 (EIP-1167 clones, ReentrancyGuard, SafeERC20), Hardhat, MUSD contracts
(BorrowerOperations, TroveManager, PriceFeed, HintHelpers, SortedTroves), Node 20 + viem keeper on Railway,
Next.js 14, wagmi/viem, Reown AppKit, Mezo Passport (Xverse, Unisat, OKX), Tailwind, Vercel.

## How we built it
Three contracts: **ParFactory** clones one **ParVault** per user; each vault is the borrower of record of its own
MUSD trove and holds the user's commitments; **ParCircuit** nets invoices in O(1) and draws a defaulter's clearing
line. A keeper automates every permissionless job (missed installments, undisputed claims, Circuit force-settles,
expired-commitment cleanup) and alerts on health and Recovery Mode. The app is server-rendered for the marketing
and docs pages and loads the wallet stack only on app pages.

44 tests, including a 400-step randomized invariant test that the vault's reserved capacity always equals the
open cover, and a regression test for every internal-audit finding. All three contracts are verified on the Mezo
testnet explorer.

## What we learned
Undrawn credit is a better collateral primitive than drawn credit: a promise that costs nothing until it's called
is something people will actually make. And Mezo's MUSD rules (fixed capacity, Recovery Mode) make those promises
honest. Building directly on BorrowerOperations and TroveManager, rather than on the token, is what lets Par
enforce that onchain.

## What's next for Par
1. **Dec 2026: Pilot.** Audit prep and a parameter review with the Mezo team; first rent-guarantee and merchant-bond
   pilots with Lagos P2P merchants.
2. **Q1 2027: Underwriting market.** BTC holders back other people's commitments for a premium; park the buffer in
   sMUSD.
3. **Q2 2027: Mainnet.** Audit, conservative parameters, one live Circuit trade cluster, WhatsApp certificates.

**Links:** [Live app](https://par-rosy.vercel.app) · [Docs](https://par-rosy.vercel.app/docs) ·
[GitHub](https://github.com/linoxbt/par)

**Contracts (Mezo testnet, verified):**
ParFactory `0x2907A39A64c3f304E7eEdF2F7107Bc825756E4f0` ·
ParVault implementation `0xd8A59feef812EDb58442d4fEe6B1285a205f7E05` ·
ParCircuit `0x198099cF3C11A6A7E0f107a63B013E20A96f9CB1` ·
ParMarket `0xb6e0aaBb4d44944b225cc697205D398DE13114e9`
```

**Deliverable URL:** `https://github.com/linoxbt/par`

**Video:** your public YouTube URL (script in `video-script.md`)

**Live demo:** `https://par-rosy.vercel.app`

**Build with** (press Enter after each): `Mezo` · `MUSD`

**Product Category** (max 3): `DeFi` · `Lending & Credit` · `Payments`

**Tags** (max 10): `Solidity` · `Hardhat` · `OpenZeppelin` · `MUSD` · `Mezo Passport` · `Reown AppKit` · `Next.js` · `viem` · `wagmi` · `Railway`

**Product detail visibility:** `Show` (judges and other builders can read it)

**Connect:** fill in your own X / Discord / Telegram / email. These aren't stored anywhere in the repo.

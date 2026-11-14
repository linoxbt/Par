# Par: your Bitcoin, as a promise

**Bitcoin-backed guarantees and trade-credit clearing on Mezo, backed by undrawn MUSD capacity.**

A Par vault owns a MUSD trove. The owner reserves part of the trove's *undrawn* borrowing capacity against
**commitments**: rent guarantees, supplier terms, performance bonds, or a credit line pledged to a trade
network. Nothing is borrowed and no interest is paid on a commitment until it's called. When a promise
breaks, the vault mints MUSD straight to whoever is owed.

> "Your Bitcoin becomes a promise you can hand to anyone, from one landlord to a whole trade network.
> It costs nothing until someone needs it."

Live URL · Video · Testnet addresses: *see [Deployments](#contracts) (fill in after `deploy-par.ts`)*

---

## The problem

In Lagos you pay one to two years of rent upfront. Merchants lock cash as deposits. Small businesses run on
IOUs that break when one person defaults. All of that is idle money, and none of it is portable trust.

## How Par works

```
BTC ──► Par vault ──► MUSD trove (capacity snapshotted at open, rate locked)
                         │
                         ├─ undrawn capacity ──► commitments (reserved, not borrowed)
                         │                          • Scheduled: rent / installments
                         │                          • Claim: bonds with a challenge window + arbiter
                         │                          • ClearingLine: credit line pledged to Par Circuit
                         │
                         └─ promise breaks ──► buffer pays first ──► then MUSD is minted to the beneficiary
```

|                | **Par Guarantees**                                                          | **Par Circuit**                                                                        |
| -------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Who            | Tenants, freelancers, P2P merchants, importers, and the people who sponsor them | Clusters of businesses that trade on credit with each other                          |
| What           | Irrevocable onchain guarantee with a live certificate page. Pays automatically on a missed installment or after an uncontested claim. | Members log invoices; the contract nets them continuously. Only net debtors pay at cycle end. A defaulter is force-settled from their vault. |
| MUSD moment    | MUSD that didn't exist a second ago lands in the landlord's wallet the moment rent is missed | 2,900 MUSD of invoices cleared with 100 MUSD actually moving (96.55% netted, proven in tests) |

## Built on MUSD internals

Par is built directly on three MUSD mechanics (read from
[`mezo-org/musd`](https://github.com/mezo-org/musd/tree/main/solidity/contracts)):

1. **Capacity snapshot.** `maxBorrowingCapacity = coll × price / 1.1` is fixed at `openTrove`, along with the
   interest rate for the *whole* capacity. Adding collateral never raises it; only `refinance` re-snapshots.
   Undrawn capacity is therefore a free, rate-locked promise. Par opens with all intended collateral.
2. **Interest only on drawn principal.** A commitment costs nothing until it's called.
3. **Recovery Mode.** When system TCR < 150%, MUSD only allows a debt increase together with a collateral
   top-up that leaves ICR ≥ 150% *and* not lower than before. Par's payout waterfall handles this: the claim
   stays valid, `recoveryTopUp(draw, price)` computes exactly how much BTC is needed, the vault pays from an
   idle BTC reserve, and if the reserve is short the call reverts with `RecoveryModeNeedsReserve(btcNeeded)` so
   the keeper can alert the owner and retry. This path is tested.

**Risk math (every commitment must pass it):**

```
need       = reserved + newCap + borrowingFee(reserved + newCap)
(a) capOk  : debt + need <= maxBorrowingCapacity
(b) stress : coll × price × (1 − 40%) / (debt + need) >= 160%
```

The certificate shows "still covered if BTC falls X%": `1 − 1.5 × (debt + need) / (coll × price)`.

## Repo layout

```
contracts/   Solidity 0.8.24 (london), Hardhat
  contracts/ParVault.sol      vault + commitments + payout waterfall (13.1 KB)
  contracts/ParFactory.sol    EIP-1167 clones, one trove per vault
  contracts/ParCircuit.sol    trade-credit clearing hub (8.5 KB)
  contracts/interfaces/IMezo.sol  minimal MUSD interfaces
  contracts/mocks/MockMUSDSystem.sol  model of the MUSD rules Par depends on (tests / local dev only)
  test/Par.test.ts            15 tests (the spec's 6 + section 8.2 additions + access control)
  integration/                shim to run the same suite inside mezo-org/musd against the REAL contracts
  scripts/                    deploy-par.ts, deploy-local.ts, seed-demo.ts, seed-guarantee.ts, export-abis.js
keeper/      Node 20 + viem: missed installments, claims, Circuit force-settle, health / Recovery Mode alerts
web/         Next.js 14 + React 18 + Mezo Passport (BTC wallets + EVM wallets)
scripts/dev-local.sh   one-command local demo
docs/demo.md           2:30 demo script and judge Q&A
```

## Contracts

| Contract                | Testnet (matsnet, 31611) |
| ----------------------- | ------------------------ |
| ParFactory              | _not deployed yet_       |
| ParVault implementation | _not deployed yet_       |
| ParCircuit              | _not deployed yet_       |

Par integrates with the official MUSD deployment (`@mezo-org/musd-contracts@1.1.0`):
BorrowerOperations `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`, TroveManager
`0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`, PriceFeed `0x86bCF0841622a5dAC14A313a15f96A95421b9366`,
MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (see `contracts/scripts/addresses.ts` for mainnet).

Demo risk parameters: `stressBps = 4000` (survive a 40% BTC drop), `targetIcr = 1.6e18` (stay ≥ 160%).

### Deploy to matsnet

```bash
cd contracts
cp .env.example .env            # MATSNET_PRIVATE_KEY=0x… funded from https://faucet.test.mezo.org
npm install
npm run deploy:matsnet          # prints ParFactory, ParVault implementation, ParCircuit + env lines
                                # and writes deployments/matsnet.json
# optional: pre-create the Circuit demo (needs MATSNET_DEMO_KEYS with three funded keys)
npx hardhat run scripts/seed-demo.ts --network matsnet
```

Verify on Blockscout (`explorer.test.mezo.org`) with "Solidity (Standard JSON input)" from
`artifacts/build-info/*.json`, compiler 0.8.24, EVM london — for ParFactory, ParCircuit and the ParVault
implementation. Or `npx hardhat verify --network matsnet <address> <args…>`.

## Tests

```bash
cd contracts && npm install && npm test        # 15 passing (mock MUSD system)
./scripts/run-musd-integration.sh              # same suite against the REAL MUSD contracts
```

**Two layers, stated plainly:**

- `npm test` runs against `MockMUSDSystem`, a compact model of the MUSD rules Par depends on (capacity
  snapshot and min-on-withdraw, capacity check on every draw, Normal Mode ICR ≥ 110% / TCR ≥ 150%, Recovery
  Mode top-up rule with no borrowing fee, 200 MUSD gas comp, 0.1% fee, 1,800 min net debt, simple interest on
  principal). It does not model liquidation, redemption or sorted-list hints. **15/15 passing.**
- `run-musd-integration.sh` clones `mezo-org/musd`, copies Par into `solidity/contracts/par`, and runs the
  *same* `test/Par.test.ts` (through `integration/helpers.ts`, which re-exports the MUSD repo's own fixtures:
  real BorrowerOperations, TroveManager, PriceFeed with MockAggregator at $50,000). Output goes to
  `contracts/integration/last-run.txt` — commit that file as evidence when you submit.

| Test | Proves |
| ---- | ------ |
| rent guarantee: missed installment is paid from buffer, then minted from the trove | Waterfall order, debt only rises when the buffer runs out, double/early triggers revert, reserved accounting |
| rejects a commitment that would not survive the stress test | `health(cap)` gate |
| owner cannot pull collateral out from under live commitments | Irrevocability (I3, I5) |
| discretionary claim: undisputed claim executes after the challenge window | Claim lifecycle |
| recovery mode: draw needs a BTC top-up from the vault's idle reserve | Reverts with the BTC needed, pays after funding |
| Circuit: 2,900 MUSD of invoices settle with 100 MUSD, defaulter is force-settled | Netting math (9,655 bps), OverLimit, forceSettle draws the line, creditor claim |
| dispute path | `resolveClaim(false)` leaves the cap intact; `resolveClaim(true)` pays; late dispute reverts |
| closeCommitment | Beneficiary early release, anyone after expiry, then `closeTrove` returns all BTC |
| open claim blocks closing after expiry | Until resolved |
| interest accrual over 30 days | Spec worked example (0.1 BTC @ $100k) stays healthy; extra cover beyond ~1,746 MUSD is rejected |
| Circuit: previous-cycle unsettled amounts count toward the line limit | And free up after `settle` |
| stale invoices / reject | `WrongCycle`, either party can reject |
| access control | Only the circuit draws a line; `addMember` checks owner and line target; clones init once; implementation locked |
| payInstallment | Settles an index once; cover cap ≤ installment × count |

## Run locally

```bash
./scripts/dev-local.sh
```

Starts a Hardhat node, deploys the mock MUSD system + Par, seeds the Circuit demo (3 shops, 2,900 gross / 100
net) and a rent guarantee, starts the keeper (every 5 s) and the web app on http://localhost:3000. Connect
MetaMask to `http://127.0.0.1:8545` (chain 31337) with a Hardhat test key.

Against testnet:

```bash
cd web && cp .env.example .env.local   # NEXT_PUBLIC_FACTORY, NEXT_PUBLIC_CIRCUIT, NEXT_PUBLIC_FACTORY_BLOCK,
npm install --legacy-peer-deps         # NEXT_PUBLIC_WC_PROJECT_ID (Reown)
npm run dev

cd keeper && cp .env.example .env      # KEEPER_KEY, FACTORY, CIRCUIT
npm install && npm start
```

### Frontend

| Route | Purpose |
| ----- | ------- |
| `/` | Landing, live oracle price / TCR / mode / rate |
| `/vault` | Create vault, open trove (BTC slider with capacity, locked rate and cover preview), health gauge, buffer, reserve, commitments, top-up / reserve / buffer / repay, pledge a Circuit line |
| `/vault/new-guarantee` | Rent (Scheduled) or Bond (Claim); live "fits / doesn't fit" from `health(cap)` |
| `/c/[vault]/[id]` | **Public certificate**, phone-first: status, cover remaining, "covered even if BTC falls X%", installment timeline with countdowns, payout history with explorer links, claim actions, WhatsApp share |
| `/pay/[vault]/[id]` | Approve + `payInstallment` |
| `/circuit` | Circles, create a circle, how to join |
| `/circuit/[circle]` | Circuit board: member graph, invoice edges, gross / owed / efficiency meter, cycle countdown, **Clear cycle** animation (browser-side cycle cancellation ending on "2,900 cleared · 100 moved · 96.55% netted"), settle / force-settle / claim, admin add-member |
| `/circuit/[circle]/invoice` | Create, accept, reject |

Design: dark navy with one metal accent (Bitcoin orange), warm paper sections, Instrument Serif headlines,
Urbanist body and JetBrains Mono numbers, a live oracle/TCR ticker, and a paper "assay-style" certificate.
The direction is adapted from the [Aurelo Saving](https://www.framer.com/marketplace/templates/aurelo-saving/)
Framer template's design language; no template assets, images or copy are used.

Wallets: Mezo Passport (`getConfig`, Xverse / Unisat / OKX + EVM wallets). With a BTC wallet Passport routes
transactions through a smart account on Mezo, which becomes the vault owner. `NEXT_PUBLIC_CHAIN=local` uses
plain RainbowKit for the Hardhat node.

Indexing: no hosted indexer. Vaults come from `ParFactory.vaultsOf/allVaults`, commitments from
`getCommitment`, invoices from `ParCircuit.invoices`, and history from `getLogs` since the factory block.

### Keeper

| Job | Condition | Call |
| --- | --------- | ---- |
| Missed installments | Active Scheduled, index unsettled, now > due + grace, now ≤ expiry | `vault.triggerMissed(id, i, up, lo)` |
| Claims | Open, undisputed, now > filedAt + window | `vault.executeClaim(id, up, lo)` |
| Circuit | now ≥ close + settleWindow, net < 0, not settled | `circuit.forceSettle(c, cyc, debtor, up, lo)` |
| Health watch | `health(0).ok == false` | Alert (log + optional `ALERT_WEBHOOK_URL`) |
| Recovery Mode | revert `RecoveryModeNeedsReserve(b)` | Alert with `b`, retry next tick |

Every call is simulated first; hints come from HintHelpers/SortedTroves (zero hints as a fallback). Uses chain
time. Deploy on Railway as a worker (`keeper/Dockerfile`, `keeper/railway.json`).

## Security notes and known limits

- `ReentrancyGuard` on every function that moves BTC or MUSD; MUSD via SafeERC20; BTC via checked `call`.
- Clones: `initialize` is callable once (factory check); the implementation is locked in its constructor.
- **Price can drop after a commitment is created.** Health then fails: no new commitments and no weakening
  actions, but claims are still honored. The UI shows "under-reserved" and the keeper alerts the owner.
- **Liquidation:** if BTC falls past the stress level and the trove drops below 110%, it can be liquidated and
  commitments fail. The certificate discloses "covered down to X%".
- **Redemption:** lowered by high ICR (vaults run ≥ 160% at stressed price). A redemption cuts collateral and
  debt at par, so health is re-evaluated on the next action.
- **Arbiter trust** (Claim kind) is explicit and chosen per commitment.
- **Not audited.** Testnet only. No upgradeability by design (clones are immutable).

## Roadmap

| Phase | What |
| ----- | ---- |
| v1.1 | Count a committed buffer in health; park the buffer in sMUSD; dispute UI polish; WhatsApp certificate share |
| v1.2 | Automatic off-ramp: claim → Wormhole NTT → Base → USDC |
| v2 | **Underwriting market:** BTC holders back other people's commitments for a premium |
| v2 | Arbiter network (Kleros / UMA-style) for Claim disputes |
| Pilot | Lagos P2P merchants (merchant bonds) + one trade cluster for Circuit |
| Mainnet | Audit, then mainnet with conservative parameters |

Business model: 0.5–1% a year on cover issued, plus 5–10 bps on Circuit gross volume cleared. Both off for the
hackathon.

## License

MIT

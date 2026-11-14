# Par: your Bitcoin, as a promise

**Bitcoin-backed guarantees and trade-credit clearing on Mezo, backed by undrawn MUSD capacity.**

A Par vault owns a MUSD trove. The owner reserves part of the trove's *undrawn* borrowing capacity against
**commitments**: rent guarantees, supplier terms, performance bonds, or a credit line pledged to a trade
network. Commitments draw nothing until they are called (the vault does draw MUSD's 1,800 MUSD minimum once,
at open, and keeps it as a liquid buffer). When a promise breaks, the vault pays whoever is owed: from that
buffer first, then by minting MUSD from the trove.

> "Your Bitcoin becomes a promise you can hand to anyone, from one landlord to a whole trade network.
> It costs nothing until someone needs it."

**Live:** https://par-rosy.vercel.app · **Docs:** https://par-rosy.vercel.app/docs · **Testnet addresses:** [below](#contracts) · **Keeper:** Railway (`par-keeper`)

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
| ParFactory              | [`0xd550c5ed5eB5Bef621D07D2Ec75f9C0780a0b270`](https://explorer.test.mezo.org/address/0xd550c5ed5eB5Bef621D07D2Ec75f9C0780a0b270#code) (verified) |
| ParVault implementation | [`0x9cEE4c639B4466dFB72117BBdb335b05359597f7`](https://explorer.test.mezo.org/address/0x9cEE4c639B4466dFB72117BBdb335b05359597f7#code) (verified) |
| ParCircuit              | [`0xE0035DeD7dE078840BF63D3820A7ae9315654c79`](https://explorer.test.mezo.org/address/0xE0035DeD7dE078840BF63D3820A7ae9315654c79#code) (verified) |

Deployed at block 16,782,612 (see `contracts/deployments/matsnet.json`). This is the post-audit deployment; earlier
deployments (`0x3837…0297`, `0xF524…3040`) are superseded and should not be used.

Par integrates with the official MUSD deployment (`@mezo-org/musd-contracts@1.1.0`):
BorrowerOperations `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`, TroveManager
`0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`, PriceFeed `0x86bCF0841622a5dAC14A313a15f96A95421b9366`,
MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (see `contracts/scripts/addresses.ts` for mainnet).

Demo risk parameters: `stressBps = 4000` (survive a 40% BTC drop), `targetIcr = 1.6e18` (stay ≥ 160%).

### Deploy to matsnet

```bash
cd contracts
cp .env.example .env            # MATSNET_PRIVATE_KEY=0x… (a key funded with testnet BTC)
npm install
npm run deploy:matsnet          # deploys the ParVault implementation, ParFactory(impl, …) and ParCircuit(factory),
                                # refuses to run if the RPC chainId doesn't match, writes deployments/matsnet.json
node scripts/export-abis.js     # refreshes web/lib/abi.ts, keeper/src/abi.ts and web/lib/deployments.ts
# optional: pre-create the Circuit demo (needs MATSNET_DEMO_KEYS with three funded keys)
npx hardhat run scripts/seed-demo.ts --network matsnet
```

Verify with `npx hardhat verify --network matsnet <address> <args…>`: the implementation takes no args, the
factory takes `(implementation, BorrowerOperations, TroveManager, PriceFeed, MUSD, 4000, 1600000000000000000)`,
the circuit takes `(factory)`. The implementation is deployed in its own transaction precisely so the explorer
indexes and verifies it (Mezo's explorer doesn't index contracts created inside another transaction).

## Tests

```bash
cd contracts && npm install && npm test        # 44 passing (mock MUSD system)
./scripts/run-musd-integration.sh              # Par.test.ts against the REAL MUSD contracts (see below)
```

- `test/Par.test.ts` (15): the core flows — waterfall, stress-test gate, irrevocability, claims and disputes,
  Recovery Mode top-up, Circuit netting (2,900 → 100 MUSD, 9,655 bps) and force-settle, close/release,
  interest accrual, stale invoices, access control, clone locking.
- `test/Audit.test.ts` (29): one regression per audit finding, each written as the original proof of concept
  inverted, plus a **400-step seeded random sequence** asserting the reserve invariant
  `reserved == Σ(cap − paidOut)` over active commitments after every step; multi-circle and keeper-lag cases;
  cycle finalisation and pro-rata claims; Normal-Mode CCR top-up; liquidation + `claimCollateral`; arbiter
  deadline; ownership transfer; consent-based membership; factory-only vaults and a locked implementation.
- `MockMUSDSystem` models the MUSD rules Par depends on (capacity snapshot, Normal Mode ICR ≥ 110% / TCR ≥ 150%,
  Recovery Mode top-up rule, 200 MUSD gas comp, 0.1% fee, 1,800 min debt, interest, liquidation with a
  collateral surplus). It does not model redemption or sorted-list hint validation.
- **Real MUSD.** `run-musd-integration.sh` runs `Par.test.ts` inside a clone of `mezo-org/musd` against the
  real BorrowerOperations/TroveManager/PriceFeed; it writes `contracts/integration/last-run.txt`. Live
  evidence on testnet: circle 0 of the first deployment (real MUSD) netted 2,900 MUSD of invoices to 100 and
  the keeper force-settled the defaulter on its own
  ([tx](https://explorer.test.mezo.org/tx/0xb0c93cd4d09bc43ee391aa2fe7cd73d65b78781ed956f86b65f0419aa511a159)).

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

Design: the site follows the structure of the [Weir](https://www.framer.com/marketplace/templates/weir/) Framer
template (floating pill nav; hero with a live data visualisation; a sticky "four moves" scroll story with an
interactive card; numbered product cards; proof stats with an interactive chart; a developer code card; security
cards; two-column FAQ; glyph-rain CTA; footer with a giant wordmark; separate Developers and Security pages). All
artwork, copy and data are Par's own: a dotted Bitcoin globe routing payouts, the Lock → Promise → Miss → Pay
story with a typed BTC amount, a stress curve from the real health math, real contract calls. Light canvas,
Geist + Geist Mono, Bitcoin orange as the single accent. No template assets, images or copy are used, and the
testimonial slot is a clearly labelled scenario rather than an invented quote.

Wallets: **Reown AppKit** for EVM wallets (MetaMask, Rabby, OKX, any mobile wallet by WalletConnect QR) and
**Mezo Passport** for Bitcoin wallets (Xverse, Unisat, OKX), which sign through a Mezo smart account that becomes the
vault owner. Both share one wagmi config: Passport's Bitcoin connectors are added to Reown's `WagmiAdapter`, and the
"Connect" menu offers either modal. Set `NEXT_PUBLIC_REOWN_PROJECT_ID` (from cloud.reown.com); without it, or on the
local chain, the app falls back to RainbowKit + Passport.

Indexing: no hosted indexer. Vaults come from `ParFactory.vaultsOf/allVaults`, commitments from
`getCommitment`, invoices from `ParCircuit.invoices`, and history from `getLogs` since the factory block.

### Keeper

| Job | Condition | Call |
| --- | --------- | ---- |
| Missed installments | Active Scheduled, index unsettled, now > due + grace, before expiry | `vault.triggerMissed(id, i, up, lo)` |
| Claims | Open and undisputed past the challenge window, or disputed past the 7-day arbiter deadline | `vault.executeClaim(id, up, lo)` |
| Circuit | Member line has `outstanding > 0`; walk back to each unsettled negative net past its settle window | `circuit.forceSettle(c, cyc, debtor, up, lo)` |
| Expired commitments | Past expiry, no open claim (frees capacity) | `vault.closeCommitment(id)` |
| Health watch | `health(0).ok == false`, or trove inactive | Alert on change, then every `ALERT_COOLDOWN_MS` |
| Recovery Mode | revert `RecoveryModeNeedsReserve(b)` (decoded across all Par ABIs) | Alert with `b`, the vault and its owner; retry |
| Keeper itself | balance < `LOW_BALANCE_BTC`; a job failing `MAX_RETRIES` times | Alert |

Every call is simulated first; pending transactions are tracked so a slow receipt never causes a resend; one
failing debtor never blocks others; nothing is persisted and nothing is skipped after downtime. Alerts go to the
log and, when configured, Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) and/or a JSON webhook
(`ALERT_WEBHOOK_URL`). Heartbeat log every 5 min; a tick stuck for 10 min exits the process so the platform
restarts it.

**Running on Railway** (project `par-keeper`, service `keeper`): built from `keeper/Dockerfile` (pinned Node 20
Alpine, tini, non-root) on the `main` branch, restart policy ALWAYS, every 15 s, with a **dedicated keeper key**
that only holds gas money (not the deployer or circle-admin key). Variables: `CHAIN`, `RPC_URL`, `FACTORY`,
`CIRCUIT`, `INTERVAL_MS`, `LOW_BALANCE_BTC`, `KEEPER_KEY` (secret, Railway only), plus the optional alert
variables in `keeper/.env.example`.

## Security notes and known limits

An internal audit (contracts, keeper, frontend, deployment) found and fixed, among others: a beneficiary release
during an open claim that double-counted `reserved` (critical; `closeCommitment` now reverts `ClaimOpen`), clearing
lines that could expire before force-settlement or be pledged beyond their cap across circles, Normal-Mode draws
that could fail the system CCR check, no arbiter deadline, and no collateral recovery after liquidation. All have
regression tests.

- `ReentrancyGuard` on every function that moves BTC or MUSD; MUSD via SafeERC20; BTC via checked `call`.
- Clones: `initialize` runs in the same transaction as `clone`; the implementation is locked in its constructor
  and the factory refuses an unlocked one. ParCircuit only accepts factory-cloned vaults.
- **Circuit cycles always terminate:** a debtor's line must outlive the cycle's settle window; each line backs
  one membership and its obligations are tracked across all cycles; a cycle that is never fully collected
  finalises one cycle after its settle window and creditors claim pro rata (late payments top them up).
- **Membership is consent-based:** the admin invites, the member joins with their own vault and line; removal
  needs zero exposure.
- **Price can drop after a commitment is created.** Health then fails: no new commitments and no weakening
  actions, but claims are still honored. The UI shows "under-reserved" and the keeper alerts.
- **Recovery Mode:** payouts need idle BTC in the vault as a top-up reserve; it can't be withdrawn while Recovery
  Mode is on and commitments are reserved. The MUSD buffer can be withdrawn at any time (health never counts it).
- **Liquidation:** if BTC falls past the stress level and the trove drops below 110%, it can be liquidated and
  commitments fail; cover then reads 0 and the owner can `claimCollateral` any surplus. Certificates disclose how
  far BTC can fall before the vault drops to the 150% line.
- **Arbiter trust** (Claim kind) is explicit; the arbiter can't be the owner or beneficiary and has 7 days to
  decide a dispute, after which the claim pays.
- **Not audited by a third party.** Testnet only. No upgradeability by design (clones are immutable).

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

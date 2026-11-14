Every payout in Par is permissionless: anyone can trigger a missed installment, execute a claim or force-settle a defaulter. The keeper is a small Node.js bot that does it automatically, so promises execute themselves.

Source: [`keeper/src/index.ts`](https://github.com/linoxbt/par/blob/main/keeper/src/index.ts)

## What it automates

| Job | Condition | Call |
| --- | --- | --- |
| Missed installments | Scheduled commitment, index unsettled, `now > due + grace`, before expiry | `vault.triggerMissed(id, index, up, lo)` |
| Claims | Open and undisputed after the challenge window, or disputed and unresolved past `disputedAt + 7 days` | `vault.executeClaim(id, up, lo)` |
| Circuit defaulters | `now ≥ cycleClose + settleWindow`, net < 0, unsettled | `circuit.forceSettle(circle, cycle, debtor, up, lo)` |
| Expired commitments | Past expiry, no open claim; an expired clearing line the circuit is still owed on is skipped (`LineOwed`) (on by default) | `vault.closeCommitment(id)` |
| Health watch | `health(0).ok == false` | Alert the owner (`under-reserved`) |
| Inactive trove | Trove closed or liquidated with active commitments | Alert (`trove-inactive`) |
| Recovery Mode | A call reverts `RecoveryModeNeedsReserve(btc)` | Alert with the BTC needed, retry next tick |

It runs every **15 seconds**. Every call is simulated first, so a job that is not due, or that someone else already did, costs nothing. It uses chain time (the latest block timestamp), not wall-clock time. Hints come from HintHelpers and SortedTroves, with zero hints as a fallback.

## Run it

```bash
cd keeper
npm install
FACTORY={{ParFactory}} CIRCUIT={{ParCircuit}} KEEPER_KEY=<private key> npm start
# one pass and exit:
npm run once
```

The keeper key pays gas in BTC. Use a dedicated key with a small balance; the keeper alerts when its balance runs low.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `FACTORY` | required | ParFactory address. |
| `CIRCUIT` | unset | ParCircuit address. Circuit jobs are skipped without it. |
| `KEEPER_KEY` | required | Private key that sends transactions. Keep it secret. |
| `CHAIN` | `testnet` | `testnet`, `mainnet` or `local`. |
| `RPC_URL` | chain default | Custom RPC endpoint. |
| `INTERVAL_MS` | `15000` | Time between ticks. |
| `AUTO_CLOSE_EXPIRED` | `true` | Close expired commitments to free capacity. |
| `ALERT_WEBHOOK_URL` | unset | JSON webhook for alerts. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | unset | Send alerts to Telegram. |
| `ALERT_COOLDOWN_MS` | 30 minutes | Minimum time between repeats of the same alert. |
| `LOW_BALANCE_BTC` | `0.005` | Alert when the keeper's balance falls below this. |
| `CIRCUIT_LOOKBACK_CYCLES` | `3` | How many past cycles to check for unsettled debtors. |
| `MAX_RETRIES` | `40` | Attempts before a failing job raises `job-keeps-failing`. |
| `TROVE_MANAGER`, `HINT_HELPERS`, `SORTED_TROVES` | official addresses | Override the contracts used for hints. |

Without a webhook or Telegram, alerts go to the log only.

## Run your own

Nothing in Par depends on the official keeper. Anyone can run one, and beneficiaries can trigger their own payouts from the app or a block explorer. A deployment template for Railway (`keeper/railway.json`) and a `Dockerfile` are included.

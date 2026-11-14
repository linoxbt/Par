Every number Par depends on, where it is set, and where to read it onchain.

## Par risk parameters

| Parameter | Value | Where | Read with |
| --- | --- | --- | --- |
| Stress drop | 40% | ParFactory constructor (`STRESS_BPS = 4000`) | `stressBps()` |
| Target ratio under stress | 160% | ParFactory constructor (`TARGET_ICR = 1.6e18`) | `targetIcr()` |
| Minimum challenge window | 60 s | ParVault constant | `MIN_CHALLENGE_WINDOW()` |
| Arbiter resolve window | 7 days | ParVault constant | `RESOLVE_WINDOW()` |
| Recovery top-up margin | +0.1% over the target ratio | ParVault constant (`RM_EPSILON`, private) | — |

A vault refuses to initialise with `stressBps ≥ 10000` or `targetIcr` below 150%.

## MUSD parameters

| Parameter | Value | Notes |
| --- | --- | --- |
| Minimum net debt | 1,800 MUSD | Drawn at open; Par keeps it as the buffer. |
| Gas compensation | 200 MUSD | Added to debt at open; refunded on close. |
| Borrowing fee | 0.1% | Charged on every draw, added to debt. Read `getBorrowingFee(amount)` on BorrowerOperations. |
| Interest rate | Global rate at open (1% at the time of writing) | Fixed per trove; `refinance` moves it to the current rate. Read `interestRate()` on InterestRateManager. |
| MCR | 110% | Liquidation threshold. `ParVault.MCR()`. |
| CCR | 150% | Recovery Mode threshold. `ParVault.CCR()`. |
| Capacity | collateral × price ÷ 1.1 | Fixed at open. `getTroveMaxBorrowingCapacity(vault)` on TroveManager. |

## App defaults

| Setting | Value |
| --- | --- |
| Monthly schedule | 30-day period, 3-day grace |
| Weekly schedule | 7-day period, 1-day grace |
| Demo schedule | 120 s period, 10 s grace, first due in 30 s |
| Expiry margin | 7 days after the last due time plus grace (600 s for the demo schedule) |
| Bond inputs | Validity in days, challenge window in hours |

## Circuit

| Setting | Demo circle | Rule |
| --- | --- | --- |
| Cycle length | 600 s (10 minutes) | Must be more than zero. |
| Settle window | 60 s | Must not exceed the cycle length. |
| Final after | cycle close + settle window + cycle length | Pro-rata claims allowed after this. |

## Keeper

| Setting | Default |
| --- | --- |
| Interval | 15 s (`INTERVAL_MS=15000`) |
| Auto-close expired commitments | On (`AUTO_CLOSE_EXPIRED`) |

See [Keeper](/docs/reference/keeper) for every option.

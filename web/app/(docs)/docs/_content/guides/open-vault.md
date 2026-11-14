Opening a vault takes two transactions: one to create your vault contract, one to open its trove with your BTC.

:::steps
@step Create the vault
On [Vault](/vault), press **Create your vault**. This calls `ParFactory.createVault()`, which deploys your own vault contract (a small clone) and emits `VaultCreated(owner, vault)`. Only you control it.
@step Choose your collateral
Enter **all** the BTC you intend to pledge. MUSD fixes the trove's borrowing capacity (collateral × price ÷ 1.1) and its interest rate at this moment. Adding BTC later adds safety, not capacity.
@step Review the preview
The preview shows the collateral value, the capacity, the locked rate, the opening debt and how much cover you can promise.
@step Open the trove
Press **Open the trove**. This calls `openTrove(seedDraw, up, lo)` with your BTC. The vault draws the minimum loan and keeps it as a buffer.
:::

## What the opening debt is made of

| Item | Amount | Notes |
| --- | --- | --- |
| Buffer (minimum loan) | 1,800 MUSD | Drawn at open and kept in the vault. Pays the first claims without new debt. |
| Borrowing fee | 0.1% of the draw | 1.8 MUSD on 1,800. Added to debt. |
| Gas compensation | 200 MUSD | Reserved by MUSD. Refunded when the trove closes. |
| **Opening debt** | **≈ 2,001.8 MUSD** | Interest accrues at the rate fixed at open (1% at the time of writing). |

The buffer is not counted in health checks, so it never lets you promise more than the trove can back. You can withdraw it later (see [Manage your vault](/docs/guides/manage-vault#buffer)), at the cost of the next payout being minted instead.

## How much cover you get

Cover is limited by two checks: capacity, and the [stress test](/docs/learn/risk#the-stress-test) (stay at or above 160% if BTC fell 40%). With typical numbers the stress test is the binding one. As a rough guide, at a BTC price of $100,000, 0.1 BTC backs about 1,750 MUSD of promises, plus the 1,800 MUSD buffer. See the [worked example](/docs/learn/how-it-works#a-worked-example).

:::tip Open with everything you plan to pledge
Because capacity is snapshotted at open, a vault opened with 0.05 BTC and topped up to 0.1 BTC has less capacity than one opened with 0.1 BTC. If you need more capacity later, `refinance` re-snapshots it at the current price and rate.
:::

## Next

- [Make a guarantee](/docs/guides/make-guarantee)
- [Pledge a clearing line and join a circle](/docs/guides/join-circle)

The underwriting market connects people who need a guarantee with people who have Bitcoin to stand behind one. A tenant or merchant posts a **cover request** and escrows a premium in MUSD. A Bitcoin holder **backs** it from their vault: the guarantee is created, stress-tested and the premium paid to them in a single transaction.

Nobody needs to trust anybody with funds. The premium sits in [ParMarket](/docs/reference/par-market) until the request is backed or cancelled, and the guarantee lives in the backer's vault like any other.

:::info Who is who
- **Requester**: posts the request and pays the premium. Becomes the guarantee's principal: they make the installment payments, and can dispute claims on a bond.
- **Beneficiary**: the landlord, supplier or client who is protected. Can't be the requester.
- **Underwriter**: the vault owner who backs the request and receives the premium.
:::

## Request cover

You don't need Bitcoin or a vault to request cover; you need MUSD for the premium.

:::steps
@step Open the request form
Go to **Market → Request cover**. From the [Lagos pilot](/pilot) page, **Request rent cover** and **Request a merchant bond** open the same form with the template preselected.
@step Choose the kind
**Rent / installments** creates an [installment guarantee](/docs/learn/guarantees): a schedule of payments; if one is missed, the vault pays it after the grace period. **Merchant bond / claim** creates a claim bond: the beneficiary files claims, you can dispute them, and an arbiter decides.
@step Fill in the terms
The beneficiary's address, the amounts, the schedule or validity, and the **cover cap**: the most the backer's vault will ever pay. For installments the cap can't exceed installment × count; three months of rent on a twelve-month lease is a common choice. Naira hints under each amount use a live exchange rate, with MUSD at about one US dollar.
@step Set the premium and how long it stays open
The premium is yours to set and is paid once. Underwriters choose which requests to back, so a premium that is too low may not be picked up. The request can be backed until it closes; for installments, it always closes before the first payment is due.
@step Approve and post
Approve the premium amount for ParMarket, then **Post request**. The premium moves into escrow and the request appears on the market.
:::

:::tip Try it in minutes
The **Demo · 2 min** schedule opens a request for nine minutes, with the first installment due ten minutes after posting and then every two minutes, so you can see the full cycle (backing, paying, a missed payment triggering) in one sitting on testnet.
:::

### Cancel

Under **Market → My requests**, an open request has **Cancel and refund**. It returns the whole premium. A request that closed without being backed stays open in the contract until you cancel it, so cancel it to get your premium back.

### After it is backed

**My requests** shows the certificate link. Share it with the beneficiary: it shows the cover remaining, the expiry and how far Bitcoin can fall before the cover is at risk. For installments, use **Pay installments** to pay each one on time; see [Pay installments](/docs/guides/pay-installments). For bonds, see [File, dispute and resolve a claim](/docs/guides/claims).

## Back a request

You need a Par vault with an open trove and enough unused capacity. See [Open a vault](/docs/guides/open-vault).

:::steps
@step Browse open requests
**Market** lists open requests with the cover, the premium, an annualised view of the premium against the cover, and the full terms.
@step Check the fit
Press **Back this request** and pick a vault. The app runs the [stress test](/docs/learn/risk#the-stress-test) with the request's cover added and shows whether it fits and what your vault's stressed ratio would be.
@step Back it
**Back with this vault** calls `fillRequest(market, id)` on your vault. In one transaction the vault creates the guarantee with exactly the requested terms, runs the stress test, and ParMarket checks the terms match and pays the premium to you.
:::

From then on it is your guarantee: it reserves the cover against your capacity until it expires or is closed, and if the payer misses an installment or a claim is upheld, your vault pays through the usual [payout waterfall](/docs/learn/how-it-works). The keeper triggers missed installments automatically.

:::warning Price the risk, not the premium
Backing a request means your vault pays if the requester doesn't. The premium is the only thing you are paid, and the requester's payments go to the beneficiary, not to you. Back requests from people and businesses you have reason to trust, or whose premium compensates for the risk.
:::

## What is checked

| Check | Error |
| --- | --- |
| The request is still open and before its deadline. | `NotActive()`, `Expired()` |
| You are not the requester (and, for bonds, not the arbiter). | `SelfFill()`, `BadParams()` |
| Your vault was created by ParFactory. | `NotParVault()` |
| The new guarantee passes the stress test. | `Unhealthy(stressedIcr)` |
| The commitment matches the request exactly. | `Mismatch()` |

## The Lagos pilot

The [pilot page](/pilot) is aimed at Lagos tenants, merchants and landlords: monthly rent instead of a year or two upfront, and bonds for supplier terms. It runs on Mezo testnet while terms and premiums are tested with real users. Amounts settle in MUSD; naira figures are indicative.

:::details Where does the exchange rate come from?
The app fetches US-dollar rates from ExchangeRate-API (open.er-api.com) on the server, at most once an hour, and shows naira hints with MUSD treated as one US dollar. No user data is sent. If the feed is unavailable the hints are hidden.
:::

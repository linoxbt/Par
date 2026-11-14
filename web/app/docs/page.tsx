import Link from "next/link"
import { Callout, DocH2, DocLayout, Steps } from "@/components/DocLayout"

const TOC = [
  { id: "overview", title: "What Par is" },
  { id: "start", title: "Getting started" },
  { id: "wallets", title: "Connecting a wallet" },
  { id: "vault", title: "Opening a vault" },
  { id: "guarantee", title: "Making a guarantee" },
  { id: "certificate", title: "The certificate" },
  { id: "paying", title: "Paying installments" },
  { id: "missed", title: "When a payment is missed" },
  { id: "claims", title: "Bonds, claims and disputes" },
  { id: "circuit", title: "Par Circuit" },
  { id: "manage", title: "Managing your vault" },
  { id: "risks", title: "Risks" },
  { id: "glossary", title: "Glossary" },
  { id: "addresses", title: "Networks and addresses" },
]

export default function Docs() {
  return (
    <DocLayout
      kicker="Documentation"
      title="Using Par"
      intro={
        <>
          Everything you need to lock Bitcoin in a vault, back a guarantee, and clear trade credit with Par on Mezo. For contract details see{" "}
          <Link href="/developers" className="font-medium text-fg underline decoration-line-strong underline-offset-4">
            Developers
          </Link>
          .
        </>
      }
      toc={TOC}
    >
      <DocH2 id="overview">What Par is</DocH2>
      <p>
        Par turns <strong>undrawn Bitcoin credit into a promise you can hand to anyone</strong>. You lock BTC in your own vault on Mezo. The vault opens a MUSD
        trove, which gives it a fixed borrowing capacity at a locked rate. You then reserve part of that unused capacity against <strong>commitments</strong>:
        rent guarantees, supplier terms, performance bonds, or a credit line pledged to a trade network.
      </p>
      <p>
        Nothing is borrowed and no interest is paid on a commitment until it&apos;s called. When a promise breaks, the vault pays the person who is owed: first
        from its MUSD buffer, then by minting new MUSD from the trove.
      </p>
      <ul>
        <li>
          <strong>Par Guarantees</strong>: installment guarantees that pay automatically when a payment is missed, and bonds that pay after an uncontested
          claim.
        </li>
        <li>
          <strong>Par Circuit</strong>: businesses that sell to each other log invoices; only net debts settle at the end of each cycle.
        </li>
      </ul>
      <Callout tone="warn" title="Testnet, unaudited">
        Par runs on Mezo testnet with testnet BTC. The contracts have not been audited. Don&apos;t use funds you can&apos;t afford to lose on any network.
      </Callout>

      <DocH2 id="start">Getting started</DocH2>
      <Steps
        items={[
          ["Get a wallet", "A Bitcoin wallet (Xverse, Unisat or OKX) or an EVM wallet (MetaMask, Rabby, OKX, or any WalletConnect mobile wallet)."],
          [
            "Get testnet BTC",
            <>
              Request testnet BTC from the{" "}
              <a href="https://faucet.test.mezo.org" target="_blank" rel="noreferrer">
                Mezo faucet
              </a>
              . BTC is also the gas token on Mezo.
            </>,
          ],
          ["Open a vault", "Create your vault, then open its trove with the BTC you want to pledge."],
          ["Make a promise", "Create a guarantee or pledge a Circuit clearing line. Share the certificate link with whoever it protects."],
        ]}
      />
      <p>About 0.1 BTC is enough to open a vault and back a few hundred to a couple of thousand MUSD of promises, depending on the BTC price.</p>

      <DocH2 id="wallets">Connecting a wallet</DocH2>
      <p>Press <strong>Connect</strong> and choose how you want to sign:</p>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Wallets</th>
            <th>How it works</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ethereum wallet (Reown)</td>
            <td>MetaMask, Rabby, OKX, Trust and any WalletConnect wallet by QR</td>
            <td>Your EVM address signs Mezo transactions directly and owns your vault.</td>
          </tr>
          <tr>
            <td>Bitcoin wallet (Mezo Passport)</td>
            <td>Xverse, Unisat, OKX</td>
            <td>Your Bitcoin wallet signs; Passport routes the transaction through a Mezo smart account, which owns your vault.</td>
          </tr>
        </tbody>
      </table>
      <p>Keep using the same wallet: a vault belongs to the address that created it.</p>

      <DocH2 id="vault">Opening a vault</DocH2>
      <Steps
        items={[
          ["Create the vault", "Deploys your own vault contract (a small clone). Only you control it."],
          [
            "Open the trove with all the BTC you intend to pledge",
            "MUSD fixes the trove's borrowing capacity (collateral × price ÷ 1.1) and its interest rate at this moment. Adding BTC later adds safety, not capacity.",
          ],
          [
            "Keep the buffer",
            "MUSD requires a minimum loan of 1,800 MUSD. Par keeps it inside the vault as a buffer that pays the first claims without new debt.",
          ],
        ]}
      />
      <p>The preview shows the capacity, the locked rate, the opening debt (buffer + 0.1% fee + 200 MUSD gas compensation, refunded on close) and how much cover you can promise.</p>

      <DocH2 id="guarantee">Making a guarantee</DocH2>
      <h3>Rent and installments</h3>
      <p>
        Set who gets paid, who pays, the installment amount, the number of installments, the schedule (monthly, weekly, or a two-minute demo), the grace
        period and the <strong>cover cap</strong>, which is the most the vault will ever pay in total.
      </p>
      <h3>Bonds and claims</h3>
      <p>Set the beneficiary, the principal (who may dispute), an arbiter both sides trust, the cover, how long the bond is valid, and the challenge window.</p>
      <h3>The stress test</h3>
      <p>
        Before a promise is created, the vault checks two things: that every reserved MUSD can still be minted under its capacity, and that if BTC fell
        <strong> 40%</strong> and every promise were called at once, the vault would still be above <strong>160%</strong> collateralised. If either fails, the
        promise is refused. The builder shows the result live.
      </p>

      <DocH2 id="certificate">The certificate</DocH2>
      <p>
        Every commitment has a public certificate page at <code>/c/&lt;vault&gt;/&lt;id&gt;</code>. It shows the status, cover remaining, how far BTC can fall
        before the promise could fail, the installment timeline and every payout with an explorer link. It is built to be read on a phone and shared on
        WhatsApp.
      </p>

      <DocH2 id="paying">Paying installments</DocH2>
      <p>
        The payer opens <code>/pay/&lt;vault&gt;/&lt;id&gt;</code>, approves MUSD once, and pays. The MUSD goes straight to the beneficiary and the installment is
        marked as paid, so the guarantee doesn&apos;t fire.
      </p>

      <DocH2 id="missed">When a payment is missed</DocH2>
      <p>
        After the due date plus the grace period, <strong>anyone</strong> can trigger the vault to pay that installment. Par runs a keeper that checks every 15
        seconds and does this automatically. The vault pays in this order:
      </p>
      <ol className="num-list">
        <li>From its MUSD buffer.</li>
        <li>If the buffer is short, it mints the rest from the trove.</li>
        <li>
          If Mezo is in <strong>Recovery Mode</strong>, MUSD only allows new debt alongside a collateral top-up. The vault uses idle BTC you&apos;ve parked as a
          reserve. If the reserve is short, the payment waits and you are told exactly how much BTC to add.
        </li>
      </ol>

      <DocH2 id="claims">Bonds, claims and disputes</DocH2>
      <ul>
        <li>The beneficiary files a claim with an amount and evidence (a link or file reference; its hash is stored onchain).</li>
        <li>The principal or the vault owner can dispute it during the challenge window.</li>
        <li>Undisputed claims can be executed by anyone after the window.</li>
        <li>Disputed claims go to the arbiter, who approves or rejects. A rejected claim leaves the cover intact.</li>
      </ul>

      <DocH2 id="circuit">Par Circuit</DocH2>
      <p>A circle is a closed group of businesses that trade on credit. It runs in cycles (a week in production, three minutes in the demo).</p>
      <Steps
        items={[
          ["Pledge a clearing line", "In your vault, pledge a line to Par Circuit. It must pass the same stress test as any guarantee."],
          ["Join a circle", "Send the circle admin your address, vault and line number. They add you."],
          ["Invoice and accept", "Creditors log invoices; debtors accept them. Your net payable for a cycle can never exceed your line."],
          ["Settle", "After the cycle closes, net debtors pay during the settle window. Net creditors claim once everyone has paid."],
          ["Force-settle", "A debtor who misses the window is force-settled: the circuit draws their clearing line, so creditors are paid anyway."],
        ]}
      />
      <p>Only net positions move money. In the demo circle, 2,900 MUSD of invoices settle with 100 MUSD actually moving.</p>

      <DocH2 id="manage">Managing your vault</DocH2>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Top up</td>
            <td>Adds collateral. Improves safety; does not raise capacity.</td>
          </tr>
          <tr>
            <td>Reserve</td>
            <td>Parks idle BTC in the vault for Recovery Mode payouts. Withdrawable any time.</td>
          </tr>
          <tr>
            <td>Buffer</td>
            <td>Withdraw MUSD from the buffer. The buffer isn&apos;t counted in health checks.</td>
          </tr>
          <tr>
            <td>Repay</td>
            <td>Repays trove debt from the vault&apos;s MUSD.</td>
          </tr>
          <tr>
            <td>Close</td>
            <td>Only possible once no commitment reserves capacity. Returns all your BTC.</td>
          </tr>
        </tbody>
      </table>
      <p>Anything that would leave the vault unable to honour its promises (withdrawing collateral, borrowing more) is refused.</p>

      <DocH2 id="risks">Risks</DocH2>
      <ul>
        <li>
          <strong>BTC price falls.</strong> Past the stress level the vault can&apos;t make new promises and you&apos;re asked to top up. Existing promises are
          still honoured.
        </li>
        <li>
          <strong>Liquidation.</strong> If the trove falls below 110% it can be liquidated and its promises fail. Every certificate shows how far BTC can fall
          before that.
        </li>
        <li>
          <strong>Redemption.</strong> MUSD redemptions hit the lowest-ratio troves first. Par vaults run high ratios, so exposure is low.
        </li>
        <li>
          <strong>Arbiter trust.</strong> Disputed bond claims depend on the arbiter you chose.
        </li>
        <li>
          <strong>Smart-contract risk.</strong> The contracts are unaudited. See{" "}
          <Link href="/security">Security</Link>.
        </li>
      </ul>

      <DocH2 id="glossary">Glossary</DocH2>
      <table>
        <tbody>
          {[
            ["MUSD", "Mezo's Bitcoin-backed stablecoin, minted against BTC in troves."],
            ["Trove", "A BTC-collateralised MUSD loan position. Each Par vault owns exactly one."],
            ["Capacity", "The most a trove can ever owe, fixed at open: collateral × price ÷ 1.1."],
            ["Buffer", "Liquid MUSD held by the vault, used before any new debt."],
            ["Commitment", "A promise backed by the vault: installments, a bond, or a clearing line."],
            ["ICR", "Individual collateral ratio of a trove."],
            ["TCR", "Total collateral ratio of the whole MUSD system."],
            ["MCR / CCR", "110% (liquidation threshold) and 150% (Recovery Mode threshold)."],
            ["Recovery Mode", "When TCR is below 150%, MUSD only allows new debt with a collateral top-up."],
            ["Keeper", "A bot that triggers missed payments, undisputed claims and force-settlements. Anyone can do the same."],
          ].map(([k, v]) => (
            <tr key={k}>
              <td className="w-40 font-medium text-fg">{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <DocH2 id="addresses">Networks and addresses</DocH2>
      <table>
        <tbody>
          <tr>
            <td className="w-40 font-medium text-fg">Network</td>
            <td>Mezo testnet (chain 31611), RPC https://rpc.test.mezo.org</td>
          </tr>
          <tr>
            <td className="font-medium text-fg">ParFactory</td>
            <td>
              <a href="https://explorer.test.mezo.org/address/0x383795B16eFc89E27ab9785b283061C76eF30297" target="_blank" rel="noreferrer">
                <code>0x383795B16eFc89E27ab9785b283061C76eF30297</code>
              </a>
            </td>
          </tr>
          <tr>
            <td className="font-medium text-fg">ParCircuit</td>
            <td>
              <a href="https://explorer.test.mezo.org/address/0xF14835BF078E532e9743F7e8346174b5F2910Ec2" target="_blank" rel="noreferrer">
                <code>0xF14835BF078E532e9743F7e8346174b5F2910Ec2</code>
              </a>
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Full contract reference, events and the keeper are in <Link href="/developers">Developers</Link>.
      </p>
    </DocLayout>
  )
}

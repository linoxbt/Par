import type { Metadata } from "next"
import Link from "next/link"
import { Callout, DocH2, DocLayout } from "@/components/DocLayout"

const TOC = [
  { id: "agreement", title: "Agreement" },
  { id: "who", title: "Who we are" },
  { id: "service", title: "What Par is" },
  { id: "testnet", title: "Testnet and no value" },
  { id: "eligibility", title: "Eligibility" },
  { id: "wallets", title: "Your wallet and keys" },
  { id: "transactions", title: "Transactions" },
  { id: "risks", title: "Risks you accept" },
  { id: "third", title: "Third-party services" },
  { id: "conduct", title: "Prohibited use" },
  { id: "ip", title: "Open source and content" },
  { id: "warranty", title: "No warranty" },
  { id: "liability", title: "Limitation of liability" },
  { id: "indemnity", title: "Indemnity" },
  { id: "law", title: "Governing law and disputes" },
  { id: "changes", title: "Changes and termination" },
  { id: "contact", title: "Contact" },
]

export const metadata: Metadata = {
  title: "Terms of use",
  description: "The terms for using the Par website and app: an open-source, unaudited testnet project provided as is, with no warranty.",
  alternates: { canonical: "/terms" },
}

export default function Terms() {
  return (
    <DocLayout
      kicker="Legal"
      title="Terms of use"
      updated="14 November 2026"
      toc={TOC}
      intro="These terms govern your use of the Par website and app. They take effect on 14 November 2026. Please read them; by using Par you agree to them."
    >
      <DocH2 id="agreement">Agreement</DocH2>
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) apply to the website at par-rosy.vercel.app, the Par web application and any related pages (together, the
        &ldquo;Interface&rdquo;). By accessing or using the Interface you agree to these Terms, our <Link href="/privacy">Privacy policy</Link> and our{" "}
        <Link href="/cookies">Cookie policy</Link>. If you don&apos;t agree, don&apos;t use the Interface.
      </p>

      <DocH2 id="who">Who we are</DocH2>
      <p>
        Par is an open-source hackathon project. &ldquo;We&rdquo; and &ldquo;us&rdquo; mean the contributors who maintain the{" "}
        <a href="https://github.com/linoxbt/par" target="_blank" rel="noreferrer">
          linoxbt/par
        </a>{" "}
        repository on GitHub. Par is not offered by a bank, broker or other regulated firm, and you can reach us only through that repository (see{" "}
        <a href="#contact">Contact</a>).
      </p>

      <DocH2 id="service">What Par is</DocH2>
      <p>
        Par is open-source software. The Interface is a website that helps you read from and send transactions to smart contracts on the Mezo blockchain (the
        &ldquo;Contracts&rdquo;): ParFactory, ParVault and ParCircuit, which in turn interact with Mezo&apos;s MUSD contracts.
      </p>
      <ul>
        <li>
          <strong>Non-custodial.</strong> We never hold your BTC, MUSD or private keys. Your vault is a contract you control from your own wallet.
        </li>
        <li>
          <strong>No intermediary.</strong> Guarantees, claims and Circuit settlements are executed by the Contracts according to their code. We don&apos;t
          decide, approve or reverse them. Arbiters for bond claims are chosen by the parties, not by us.
        </li>
        <li>
          <strong>Not advice, not a bank.</strong> Nothing in the Interface is financial, investment, legal or tax advice, and Par is not a bank, insurer,
          guarantor, escrow agent or money transmitter. A Par &ldquo;guarantee&rdquo; is a commitment enforced by smart contracts, backed only by the collateral
          in the relevant vault.
        </li>
      </ul>

      <DocH2 id="testnet">Testnet and no value</DocH2>
      <Callout tone="warn" title="Testnet only">
        The Interface is currently configured for Mezo testnet. Testnet BTC and MUSD have no monetary value. The Contracts have not been audited. Do not send
        assets of real value to any address shown in the Interface.
      </Callout>
      <p>
        Par is experimental. Testnet deployments may be replaced or reset, and the Interface may point to new contract addresses, without notice. Anything you
        do on testnet is for testing only.
      </p>

      <DocH2 id="eligibility">Eligibility</DocH2>
      <p>
        You must be at least 18 and able to form a binding contract. You may not use the Interface if you are subject to sanctions, located in a country or
        region subject to comprehensive sanctions, or if using it would break the law where you are. You are responsible for complying with local laws.
      </p>

      <DocH2 id="wallets">Your wallet and keys</DocH2>
      <p>
        You connect through a third-party wallet (via Reown or Mezo Passport). You alone are responsible for your wallet, seed phrase and devices. We cannot
        recover lost keys or access a vault for you. A vault belongs to the address that created it; if you lose that address, you lose control of the vault.
      </p>

      <DocH2 id="transactions">Transactions</DocH2>
      <ul>
        <li>Blockchain transactions are public, permanent and irreversible once confirmed. Check every address and amount before you sign.</li>
        <li>You pay network fees (gas) in BTC to the Mezo network, not to us. We currently charge no fees.</li>
        <li>
          Some actions are permissionless: anyone, including our keeper, can trigger a missed installment, execute an undisputed claim or force-settle a Circuit
          debtor once the Contracts allow it.
        </li>
        <li>Certificate pages are public. Anyone with the link can see the commitment, its addresses and its payouts.</li>
      </ul>

      <DocH2 id="risks">Risks you accept</DocH2>
      <p>Using Par involves significant risk, including but not limited to:</p>
      <ul>
        <li>Bugs or vulnerabilities in the Contracts, the MUSD system, wallets or the Interface, which could cause loss of funds.</li>
        <li>BTC price falls, which can make a vault under-reserved or lead to liquidation, causing commitments to fail.</li>
        <li>MUSD system behaviour such as Recovery Mode, redemptions, fees, oracle failures or governance changes.</li>
        <li>Network congestion, outages, forks or changes to Mezo.</li>
        <li>Counterparties or arbiters acting in bad faith, and keepers not running when expected.</li>
        <li>Regulatory changes affecting digital assets or the services described.</li>
      </ul>
      <p>
        See <Link href="/security">Security</Link> and <Link href="/docs/learn/risk">Docs → Risk and safety</Link> for how the system works and where it can fail.
      </p>

      <DocH2 id="third">Third-party services</DocH2>
      <p>
        The Interface relies on services we don&apos;t control, including the Mezo network and its RPC endpoints, Mezo&apos;s MUSD contracts and price feed,
        Reown (WalletConnect), Mezo Passport, the Base Account SDK from Coinbase that ships inside the wallet libraries, wallet providers, the Mezo block explorer,
        GitHub and Vercel (hosting). Their own terms and privacy policies apply,
        and we are not responsible for their availability or conduct.
      </p>

      <DocH2 id="conduct">Prohibited use</DocH2>
      <p>You agree not to:</p>
      <ul>
        <li>use the Interface for fraud, money laundering, terrorist financing, sanctions evasion or any other unlawful purpose;</li>
        <li>misrepresent a Par commitment as insurance, a bank guarantee or anything it is not;</li>
        <li>interfere with, overload or attack the Interface, the Contracts or other users;</li>
        <li>infringe anyone&apos;s rights or impersonate any person or organisation.</li>
      </ul>

      <DocH2 id="ip">Open source and content</DocH2>
      <p>
        The Par source code is available on <a href="https://github.com/linoxbt/par" target="_blank" rel="noreferrer">GitHub</a> under the MIT License, which
        governs your use of the code. The Par name and logo may not be used to suggest endorsement without permission. Third-party names and marks belong to their
        owners.
      </p>

      <DocH2 id="warranty">No warranty</DocH2>
      <p>
        The Interface and Contracts are provided <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong>, without warranties of any kind, express or
        implied, including merchantability, fitness for a particular purpose, accuracy and non-infringement. We don&apos;t warrant that the Interface will be
        uninterrupted, secure or error-free, or that any figure it displays (prices, ratios, &ldquo;holds if BTC falls&rdquo; estimates) is accurate.
      </p>
      <p>
        In particular, Par is an <strong>unaudited hackathon project running on a test network</strong>. The Contracts may contain bugs that cause commitments
        to fail or funds to be lost, and the Interface may show wrong or stale data. The source code is licensed under the MIT License, which also provides it
        &ldquo;as is&rdquo;, without warranty.
      </p>

      <DocH2 id="liability">Limitation of liability</DocH2>
      <p>
        To the maximum extent permitted by law, the Par contributors will not be liable for any indirect, incidental, special, consequential or punitive damages,
        or for any loss of funds, profits, data or goodwill, arising from your use of or inability to use the Interface or the Contracts, even if advised of the
        possibility. Where liability cannot be excluded, it is limited to the greater of the fees you paid us in the prior twelve months (currently none) or
        USD 100.
      </p>

      <DocH2 id="indemnity">Indemnity</DocH2>
      <p>
        You agree to indemnify and hold harmless the Par contributors from claims, losses and expenses (including reasonable legal fees) arising from your use of
        the Interface, your breach of these Terms or your violation of any law or third-party right.
      </p>

      <DocH2 id="law">Governing law and disputes</DocH2>
      <p>
        Par has no operating company, and these Terms do not choose the law of any particular country. Nothing in them limits rights you have under mandatory
        consumer-protection law where you live. If you have a complaint, contact us first (see <a href="#contact">Contact</a>) so we can try to resolve it
        informally.
      </p>

      <DocH2 id="changes">Changes and termination</DocH2>
      <p>
        We may change these Terms by posting an updated version with a new &ldquo;last updated&rdquo; date; continuing to use the Interface means you accept the
        changes. We may modify, suspend or discontinue the Interface at any time. Because the Contracts are immutable, they keep working on Mezo regardless of the
        Interface. If any part of these Terms is unenforceable, the rest remains in effect.
      </p>

      <DocH2 id="contact">Contact</DocH2>
      <p>
        Questions about these Terms: open an issue on{" "}
        <a href="https://github.com/linoxbt/par/issues" target="_blank" rel="noreferrer">
          GitHub
        </a>
        . For anything private (a complaint, a legal notice, or a security or privacy matter), open a{" "}
        <a href="https://github.com/linoxbt/par/security/advisories/new" target="_blank" rel="noreferrer">
          private security advisory
        </a>{" "}
        on the repository instead. Only you and the maintainers can see it.
      </p>
    </DocLayout>
  )
}

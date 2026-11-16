import type { Metadata } from "next"
import Link from "next/link"
import { Callout, DocH2, DocLayout } from "@/components/DocLayout"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Par processes when you use it: no accounts, no analytics, nothing stored on the website pages, and wallet-library storage only on app pages.",
  alternates: { canonical: "/privacy" },
}

const ADVISORY = "https://github.com/linoxbt/par/security/advisories/new"

const TOC = [
  { id: "summary", title: "Summary" },
  { id: "who", title: "Who we are" },
  { id: "collect", title: "What is processed" },
  { id: "site", title: "Website pages" },
  { id: "app", title: "App pages" },
  { id: "chain", title: "Public blockchain data" },
  { id: "third", title: "Third parties" },
  { id: "use", title: "How information is used" },
  { id: "retention", title: "Retention" },
  { id: "rights", title: "Your rights and requests" },
  { id: "children", title: "Children" },
  { id: "transfers", title: "International transfers" },
  { id: "changes", title: "Changes" },
]

export default function Privacy() {
  return (
    <DocLayout
      kicker="Legal"
      title="Privacy policy"
      updated="14 November 2026"
      toc={TOC}
      intro="Par is built to need as little personal data as possible. This is what is processed when you use it, and by whom. Effective 14 November 2026; we checked it against what the site actually does in a browser."
    >
      <DocH2 id="summary">Summary</DocH2>
      <Callout title="In short">
        No accounts, no sign-up, no email, no analytics, no advertising, and no Par database. The website pages (home, docs, developers, security and these
        legal pages) set no cookies and store nothing in your browser. The app pages (vault, guarantees, certificates, Circuit) load third-party wallet
        libraries that store connection state in your browser and contact their providers. Your wallet address and transactions are public on the Mezo
        blockchain by design.
      </Callout>

      <DocH2 id="who">Who we are</DocH2>
      <p>
        Par is an open-source hackathon project maintained by the contributors of the{" "}
        <a href="https://github.com/linoxbt/par" target="_blank" rel="noreferrer">
          linoxbt/par
        </a>{" "}
        GitHub repository (&ldquo;we&rdquo;). We don&apos;t run a server that stores user data. For privacy questions and requests, see{" "}
        <a href="#rights">Your rights and requests</a>.
      </p>

      <DocH2 id="collect">What is processed</DocH2>
      <p>
        <strong>We don&apos;t ask for or store your name, email, phone number or identity documents.</strong> The information involved when you use Par is:
      </p>
      <ul>
        <li>
          <strong>Technical request data</strong>: your IP address, browser user agent, requested pages and timestamps, received by our host and by any provider
          your browser contacts (listed below).
        </li>
        <li>
          <strong>Wallet address</strong> (app pages only, once you connect): read in your browser to show your vault and prepare transactions you choose to sign.
        </li>
        <li>
          <strong>Transaction data</strong>: amounts, addresses and evidence hashes you submit, sent to the Mezo blockchain when you sign.
        </li>
      </ul>

      <DocH2 id="site">Website pages</DocH2>
      <p>
        The home, docs, developers, security, terms, privacy and cookie pages are served by Vercel and set <strong>no cookies, no local storage and no
        IndexedDB</strong>. The wallet libraries are not loaded on them. The home page reads the live BTC price and system ratio straight from the Mezo testnet
        RPC (<code>rpc.test.mezo.org</code>), so that provider sees your IP address and those read requests. Fonts are self-hosted. No other third party is
        contacted.
      </p>

      <DocH2 id="app">App pages</DocH2>
      <p>
        The vault, guarantee, certificate, payment and Circuit pages load the wallet stack: Reown AppKit (WalletConnect), wagmi and Mezo Passport (RainbowKit).
        The Coinbase and Base Account SDKs are switched off. As soon as one of these pages loads, before you connect anything:
      </p>
      <ul>
        <li>
          the wallet libraries write the connection-state entries listed in the <Link href="/cookies">Cookie policy</Link> to local storage and IndexedDB;
        </li>
        <li>
          Reown loads the project configuration from <code>api.web3modal.org</code>, and may send connection events to <code>pulse.walletconnect.org</code> even
          though its analytics option is off; opening the Ethereum wallet list also loads wallet names and logos from <code>api.web3modal.org</code>;
        </li>
        <li>the app reads the chain through the Mezo RPC.</li>
      </ul>
      <p>
        The WalletConnect relay is used only if you connect a wallet through WalletConnect (for example by QR code). Mezo Passport processes your Bitcoin and
        Mezo addresses only if you connect a Bitcoin wallet. We receive none of this data.
      </p>

      <DocH2 id="chain">Public blockchain data</DocH2>
      <p>
        Everything you do through the Contracts (creating a vault, opening a trove, making a commitment, paying, claiming, invoicing) is recorded permanently on
        the public Mezo blockchain and visible to anyone, including through block explorers and Par certificate pages. We cannot delete or change blockchain data.
        Avoid putting personal information in fields that are written onchain, such as invoice references or claim evidence; only their hash is stored, but
        anyone holding the original can match it to the hash.
      </p>

      <DocH2 id="third">Third parties</DocH2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>When</th>
            <th>Data they receive</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel (hosting)</td>
            <td>Every page</td>
            <td>IP address, user agent, pages requested, timestamps (server logs)</td>
          </tr>
          <tr>
            <td>Mezo RPC (rpc.test.mezo.org)</td>
            <td>Home page (live price and ratio) and app pages</td>
            <td>IP address, addresses and contracts queried, signed transactions you broadcast</td>
          </tr>
          <tr>
            <td>Reown / WalletConnect</td>
            <td>App pages; relay only when you connect through WalletConnect</td>
            <td>IP address, user agent, Par&apos;s project ID, usage events; encrypted session messages and wallet metadata when you use the relay</td>
          </tr>
          <tr>
            <td>ExchangeRate-API</td>
            <td>Our server, about once an hour (pilot and naira hints)</td>
            <td>Nothing about you: our server fetches a public USD/NGN rate; your browser never contacts it</td>
          </tr>
          <tr>
            <td>Mezo Passport</td>
            <td>When you connect a Bitcoin wallet</td>
            <td>Bitcoin and Mezo addresses, signing requests</td>
          </tr>
          <tr>
            <td>Your wallet provider</td>
            <td>When you connect and sign</td>
            <td>Governed by your wallet&apos;s own policy</td>
          </tr>
          <tr>
            <td>Mezo block explorer, GitHub</td>
            <td>Only when you follow a link to them</td>
            <td>Standard web request data</td>
          </tr>
        </tbody>
      </table>
      <p>Each provider handles data under its own privacy policy.</p>

      <DocH2 id="use">How information is used</DocH2>
      <ul>
        <li>To display your vault, commitments, certificates and Circuit positions.</li>
        <li>To prepare the transactions you choose to sign, and to show their status.</li>
        <li>For our host: to deliver, secure and debug the website.</li>
      </ul>
      <p>We don&apos;t sell personal information, build profiles, or use your data for advertising.</p>

      <DocH2 id="retention">Retention</DocH2>
      <p>
        We keep no user database. Vercel keeps hosting logs according to its retention settings. Browser storage on app pages stays until you disconnect or clear
        this site&apos;s data. Blockchain records are permanent.
      </p>

      <DocH2 id="rights">Your rights and requests</DocH2>
      <p>
        Depending on where you live (for example under the EU or UK GDPR, or Nigeria&apos;s Data Protection Act 2023), you may have rights to access, correct,
        delete or object to the processing of your personal data, and to complain to a data protection authority. Because we hold no account data, most requests
        are best directed to the relevant provider above; we&apos;ll help where we can. We cannot alter data recorded on the blockchain.
      </p>
      <p>
        To make a privacy or data request privately, open a{" "}
        <a href={ADVISORY} target="_blank" rel="noreferrer">
          private security advisory
        </a>{" "}
        on the Par repository (a free GitHub account is needed). Only you and the maintainers can see it. Please don&apos;t put personal information in public
        GitHub issues.
      </p>

      <DocH2 id="children">Children</DocH2>
      <p>Par is not intended for anyone under 18, and we don&apos;t knowingly process children&apos;s data.</p>

      <DocH2 id="transfers">International transfers</DocH2>
      <p>
        Our providers operate globally, so technical data may be processed outside your country, including in the United States. Blockchain nodes are distributed
        worldwide.
      </p>

      <DocH2 id="changes">Changes</DocH2>
      <p>
        We may update this policy and will change the &ldquo;last updated&rdquo; date when we do. If the website pages ever start storing anything or loading a
        new third party, this page will say so first.
      </p>
    </DocLayout>
  )
}

import Link from "next/link"
import { Callout, DocH2, DocLayout } from "@/components/DocLayout"

const TOC = [
  { id: "summary", title: "Summary" },
  { id: "collect", title: "What we collect" },
  { id: "chain", title: "Public blockchain data" },
  { id: "third", title: "Third parties" },
  { id: "use", title: "How information is used" },
  { id: "storage", title: "Browser storage" },
  { id: "retention", title: "Retention" },
  { id: "rights", title: "Your rights" },
  { id: "children", title: "Children" },
  { id: "transfers", title: "International transfers" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact" },
]

export default function Privacy() {
  return (
    <DocLayout kicker="Legal" title="Privacy policy" updated="14 November 2026" toc={TOC} intro="Par is built to need as little personal data as possible. Here is exactly what is processed when you use it, and by whom.">
      <DocH2 id="summary">Summary</DocH2>
      <Callout title="In short">
        No accounts, no sign-up, no email, no analytics, no advertising. Par has no backend database. Your wallet address and transactions are public on the
        Mezo blockchain by design. A few infrastructure providers (hosting, the Mezo RPC, wallet connectors) process technical data such as your IP address to
        deliver their service.
      </Callout>

      <DocH2 id="collect">What we collect</DocH2>
      <p>
        <strong>We don&apos;t ask for or store your name, email, phone number or identity documents.</strong> The Par team does not run a server that stores user
        data. The information processed when you use Par is:
      </p>
      <ul>
        <li>
          <strong>Wallet address</strong>: read by the app in your browser to show your vault and to prepare transactions you choose to sign.
        </li>
        <li>
          <strong>Transaction data</strong>: amounts, addresses and evidence hashes you submit are sent to the Mezo blockchain when you sign.
        </li>
        <li>
          <strong>Technical request data</strong>: your IP address, browser user agent, requested pages and timestamps, received by our hosting provider and
          the third parties below when your browser contacts them.
        </li>
      </ul>

      <DocH2 id="chain">Public blockchain data</DocH2>
      <p>
        Everything you do through the Contracts (creating a vault, opening a trove, making a commitment, paying, claiming, invoicing) is recorded permanently on
        the public Mezo blockchain and visible to anyone, including through block explorers and Par certificate pages. We cannot delete or change blockchain data.
        Avoid putting personal information in any field that is written onchain, such as invoice references or claim evidence; only their hash is stored, but
        the hash can be linked to the original by anyone who has it.
      </p>

      <DocH2 id="third">Third parties</DocH2>
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Why</th>
            <th>Data they receive</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Vercel</td>
            <td>Hosts the website</td>
            <td>IP address, user agent, pages requested (server logs)</td>
          </tr>
          <tr>
            <td>Mezo RPC (rpc.test.mezo.org)</td>
            <td>Reads blockchain state and broadcasts your transactions</td>
            <td>IP address, addresses and contracts queried, signed transactions</td>
          </tr>
          <tr>
            <td>Reown (WalletConnect)</td>
            <td>Ethereum wallet connection modal and mobile-wallet relay</td>
            <td>IP address, wallet metadata, encrypted session messages when you use WalletConnect</td>
          </tr>
          <tr>
            <td>Coinbase (Wallet SDK, Base Account)</td>
            <td>Optional wallet connectors bundled with the wallet libraries</td>
            <td>IP address and a Cloudflare security cookie on coinbase.com when its SDK loads; account data only if you choose these wallets</td>
          </tr>
          <tr>
            <td>Mezo Passport</td>
            <td>Bitcoin wallet connection through a Mezo smart account</td>
            <td>Bitcoin and Mezo addresses, signing requests</td>
          </tr>
          <tr>
            <td>Your wallet provider</td>
            <td>Holds your keys and signs</td>
            <td>Governed by your wallet&apos;s own policy</td>
          </tr>
          <tr>
            <td>Mezo block explorer, GitHub</td>
            <td>Only when you click a link to them</td>
            <td>Standard web request data</td>
          </tr>
        </tbody>
      </table>
      <p>Each provider handles data under its own privacy policy. We have disabled Reown&apos;s analytics feature in the Par configuration. Fonts are self-hosted.</p>

      <DocH2 id="use">How information is used</DocH2>
      <ul>
        <li>To display your vault, commitments, certificates and Circuit positions.</li>
        <li>To prepare the transactions you choose to sign, and to show their status.</li>
        <li>For hosting providers: to deliver, secure and debug the website.</li>
      </ul>
      <p>We don&apos;t sell personal information, build profiles, or use your data for advertising.</p>

      <DocH2 id="storage">Browser storage</DocH2>
      <p>
        The app keeps a small amount of information in your browser&apos;s local storage and IndexedDB, mainly which wallet you connected so you stay connected
        between visits. It never leaves your device unless a wallet connector needs it to keep a session alive. See the <Link href="/cookies">Cookie policy</Link>.
      </p>

      <DocH2 id="retention">Retention</DocH2>
      <p>
        We keep no user database. Hosting logs are kept by Vercel according to its retention settings. Browser storage stays until you disconnect your wallet or
        clear your browser data. Blockchain records are permanent.
      </p>

      <DocH2 id="rights">Your rights</DocH2>
      <p>
        Depending on where you live (for example under the EU or UK GDPR, or Nigeria&apos;s Data Protection Act 2023), you may have rights to access, correct,
        delete or object to the processing of your personal data, and to complain to a data protection authority. Because we hold no account data, most requests
        are best directed to the relevant provider above; we&apos;ll help where we can. We cannot alter data recorded on the blockchain.
      </p>

      <DocH2 id="children">Children</DocH2>
      <p>Par is not intended for anyone under 18, and we don&apos;t knowingly process children&apos;s data.</p>

      <DocH2 id="transfers">International transfers</DocH2>
      <p>
        Our providers operate globally, so technical data may be processed outside your country, including in the United States. Blockchain nodes are distributed
        worldwide.
      </p>

      <DocH2 id="changes">Changes</DocH2>
      <p>We may update this policy and will change the &ldquo;last updated&rdquo; date when we do. Material changes will be highlighted on the site.</p>

      <DocH2 id="contact">Contact</DocH2>
      <p>
        Privacy questions or requests: open an issue on <a href="https://github.com/linoxbt/par/issues" target="_blank" rel="noreferrer">GitHub</a>. Please
        don&apos;t post personal information publicly; ask for a private contact channel instead.
      </p>
    </DocLayout>
  )
}

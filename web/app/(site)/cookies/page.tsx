import Link from "next/link"
import { Callout, DocH2, DocLayout } from "@/components/DocLayout"

const TOC = [
  { id: "summary", title: "Summary" },
  { id: "what", title: "What we use" },
  { id: "list", title: "Storage in detail" },
  { id: "third", title: "Third-party storage" },
  { id: "control", title: "Managing storage" },
  { id: "changes", title: "Changes and contact" },
]

export default function Cookies() {
  return (
    <DocLayout kicker="Legal" title="Cookie policy" updated="14 November 2026" toc={TOC} intro="How Par uses cookies and similar browser storage. The list below was checked against what the live app actually stores.">
      <DocH2 id="summary">Summary</DocH2>
      <Callout title="Only what the app needs to work">
        Par does not use advertising, analytics or tracking cookies, and there is nothing to opt out of. The app stores a little information in your browser
        (local storage and IndexedDB) so your wallet stays connected. Privacy laws treat this kind of storage like cookies, so we describe it here.
      </Callout>

      <DocH2 id="what">What we use</DocH2>
      <p>
        All storage Par relies on is <strong>strictly necessary</strong>: it remembers the wallet connection you asked for and the state of an open wallet
        session. Strictly necessary storage doesn&apos;t require consent under the EU ePrivacy rules and similar laws, but you can still clear it at any time.
      </p>

      <DocH2 id="list">Storage in detail</DocH2>
      <table>
        <thead>
          <tr>
            <th>Name (pattern)</th>
            <th>Type</th>
            <th>Set by</th>
            <th>Purpose</th>
            <th>Lasts</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>wagmi.*</code>
            </td>
            <td>Local storage</td>
            <td>wagmi (in the app)</td>
            <td>Remembers which wallet connector you used and the selected network</td>
            <td>Until you disconnect or clear site data</td>
          </tr>
          <tr>
            <td>
              <code>rk-*</code>
            </td>
            <td>Local storage</td>
            <td>RainbowKit / Mezo Passport</td>
            <td>Remembers the wallet-list version and recently used wallets</td>
            <td>Until cleared</td>
          </tr>
          <tr>
            <td>
              <code>@appkit/*</code>, <code>WALLET_CONNECT_V2_INDEXED_DB</code>, <code>keyval-store</code>
            </td>
            <td>Local storage, IndexedDB</td>
            <td>Reown AppKit / WalletConnect</td>
            <td>Connection status, active network, and an Ethereum or mobile-wallet session with its encryption keys</td>
            <td>Until the session ends or is cleared</td>
          </tr>
          <tr>
            <td>
              <code>cbwsdk.store</code>, <code>base-acc-sdk.store</code> (and IndexedDB of the same names)
            </td>
            <td>Local storage, IndexedDB</td>
            <td>Coinbase Wallet and Base Account connectors (bundled with the wallet libraries)</td>
            <td>Connector state, used only if you pick one of these wallets</td>
            <td>Until cleared</td>
          </tr>
          <tr>
            <td>Wallet-specific keys</td>
            <td>Local storage</td>
            <td>Mezo Passport (orangekit)</td>
            <td>Links your Bitcoin wallet to its Mezo smart account during a session</td>
            <td>Until cleared</td>
          </tr>
        </tbody>
      </table>
      <p>
        Par itself does not set any HTTP cookies. One third-party cookie can appear: when a wallet list loads the Coinbase Wallet SDK, Cloudflare may set{" "}
        <code>__cf_bm</code> on <code>coinbase.com</code>. It is a short-lived (about 30 minutes) bot-protection cookie used by Coinbase&apos;s servers, not by Par.
      </p>

      <DocH2 id="third">Third-party storage</DocH2>
      <p>
        Wallet extensions and the services listed in our <Link href="/privacy">Privacy policy</Link> (for example Reown when you open its modal, or your hosting
        provider&apos;s security features) may use their own storage under their own policies. Links to the block explorer or GitHub take you to sites with their
        own cookie practices.
      </p>

      <DocH2 id="control">Managing storage</DocH2>
      <ul>
        <li>Disconnect your wallet from the account menu to end the wallet session.</li>
        <li>Clear this site&apos;s data in your browser settings to remove everything above. You&apos;ll need to reconnect your wallet next time.</li>
        <li>Blocking all site storage will stop wallets from staying connected, and some wallet connections may not work.</li>
      </ul>

      <DocH2 id="changes">Changes and contact</DocH2>
      <p>
        If we ever add non-essential cookies (such as analytics), we&apos;ll update this page and ask for your consent first. Questions: open an issue on{" "}
        <a href="https://github.com/linoxbt/par/issues" target="_blank" rel="noreferrer">GitHub</a>.
      </p>
    </DocLayout>
  )
}

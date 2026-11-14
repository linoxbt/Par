import type { Metadata } from "next"
import Link from "next/link"
import { Callout, DocH2, DocLayout } from "@/components/DocLayout"

export const metadata: Metadata = {
  title: "Cookie policy",
  description: "Par sets no cookies and stores nothing on its website pages. On app pages the wallet libraries keep connection state in local storage and IndexedDB; every entry is listed here.",
  alternates: { canonical: "/cookies" },
}

const TOC = [
  { id: "summary", title: "Summary" },
  { id: "site", title: "Website pages" },
  { id: "list", title: "App pages in detail" },
  { id: "cookie", title: "Third-party cookies" },
  { id: "control", title: "Managing storage" },
  { id: "changes", title: "Changes and contact" },
]

const Code = ({ children }: { children: string }) => <code>{children}</code>

export default function Cookies() {
  return (
    <DocLayout
      kicker="Legal"
      title="Cookie policy"
      updated="14 November 2026"
      toc={TOC}
      intro="How Par uses cookies and similar browser storage. Effective 14 November 2026; every entry below was checked in a fresh browser against the live build."
    >
      <DocH2 id="summary">Summary</DocH2>
      <Callout title="Nothing on the website, wallet state on the app">
        Par sets no cookies of its own and uses no analytics, advertising or tracking. The website pages store nothing at all. The app pages load third-party
        wallet libraries, which keep connection state in local storage and IndexedDB. No cookies are set on any page. Privacy laws treat this kind of storage
        like cookies, so it is all listed here.
      </Callout>

      <DocH2 id="site">Website pages</DocH2>
      <p>
        The home, docs, developers, security, terms, privacy and cookie pages set <strong>no cookies, no local storage, no session storage and no IndexedDB</strong>
        . There is nothing to accept or opt out of.
      </p>

      <DocH2 id="list">App pages in detail</DocH2>
      <p>
        The vault, guarantee, certificate, payment and Circuit pages load the wallet libraries. They create the entries below as soon as the page loads, even
        before you connect a wallet. Par&apos;s own code does not read them for anything except keeping your wallet connected.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Set by</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Code>@appkit/connection_status</Code>, <Code>@appkit/disconnected_connector_ids</Code>, <Code>@appkit/active_caip_network_id</Code>,{" "}
              <Code>@appkit/active_namespace</Code>
            </td>
            <td>Local storage</td>
            <td>Reown AppKit</td>
            <td>Whether you are connected, which connectors you disconnected, the selected network</td>
          </tr>
          <tr>
            <td>
              <Code>wagmi.store</Code>
            </td>
            <td>Local storage</td>
            <td>wagmi</td>
            <td>The connector you used last and the selected chain, so you stay connected between visits</td>
          </tr>
          <tr>
            <td>
              <Code>rk-version</Code>
            </td>
            <td>Local storage</td>
            <td>RainbowKit (used by Mezo Passport)</td>
            <td>The wallet-list version</td>
          </tr>
          <tr>
            <td>
              <Code>WALLET_CONNECT_V2_INDEXED_DB</Code>
            </td>
            <td>IndexedDB</td>
            <td>WalletConnect (via Reown)</td>
            <td>Created on load; holds a WalletConnect session and its encryption keys once you connect through WalletConnect</td>
          </tr>
          <tr>
            <td>Wallet-specific entries</td>
            <td>Local storage</td>
            <td>Mezo Passport, your wallet</td>
            <td>May be added after you connect a wallet, for example to link a Bitcoin wallet to its Mezo account</td>
          </tr>
        </tbody>
      </table>
      <p>All of these stay until you disconnect or clear this site&apos;s data.</p>

      <DocH2 id="cookie">Third-party cookies</DocH2>
      <p>
        None. The Coinbase and Base Account wallet SDKs, which would contact <Code>coinbase.com</Code> and cause a Cloudflare cookie there, are switched off in
        Par. Reown may send connection events to <Code>pulse.walletconnect.org</Code> from app pages, without setting a cookie. See the{" "}
        <Link href="/privacy#app">Privacy policy</Link> for what each provider receives.
      </p>

      <DocH2 id="control">Managing storage</DocH2>
      <ul>
        <li>Disconnect your wallet from the account menu to end the wallet session.</li>
        <li>Clear this site&apos;s data in your browser settings to remove everything above; you&apos;ll need to reconnect next time.</li>
        <li>Blocking third-party cookies does not affect Par.</li>
        <li>If you prefer not to have any of this, stay on the website pages: reading the docs and the home page stores nothing.</li>
      </ul>

      <DocH2 id="changes">Changes and contact</DocH2>
      <p>
        If the website pages ever start storing anything, or we add non-essential cookies such as analytics, we&apos;ll update this page first and ask for
        consent where the law requires it. Questions: open an issue on{" "}
        <a href="https://github.com/linoxbt/par/issues" target="_blank" rel="noreferrer">
          GitHub
        </a>
        , or a{" "}
        <a href="https://github.com/linoxbt/par/security/advisories/new" target="_blank" rel="noreferrer">
          private security advisory
        </a>{" "}
        for anything you&apos;d rather not post publicly.
      </p>
    </DocLayout>
  )
}

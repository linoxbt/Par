/**
 * Docs information architecture: tabs -> groups -> pages. Imported by the docs chrome (tabs, sidebar,
 * mobile drawer, prev/next, search) and by app/sitemap.ts. Keep this file free of React.
 */
export type DocPage = {
  href: string
  title: string
  tab: string
  group: string
  description?: string
  /** "Last updated" shown under the page; defaults to DOCS_UPDATED. */
  updated?: string
}

export const DOCS_UPDATED = "16 November 2026"

export type DocTab = { name: string; href: string }

export const DOC_TABS: DocTab[] = [
  { name: "Learn", href: "/docs/learn/overview" },
  { name: "Guides", href: "/docs/guides/connect-wallet" },
  { name: "Reference", href: "/docs/reference/par-vault" },
]

/** Icon key per sidebar group (see components/docs/icons.tsx). */
export const GROUP_ICONS: Record<string, string> = {
  "Get started": "rocket",
  Concepts: "layers",
  Safety: "shield",
  Setup: "wallet",
  Guarantees: "file",
  Circuit: "circuit",
  Market: "receipt",
  Contracts: "code",
  Protocol: "sliders",
  Developers: "terminal",
}

export const DOC_PAGES: DocPage[] = [
  {
    href: "/docs",
    title: "Par documentation",
    tab: "Home",
    group: "Home",
    description: "Guides and reference for Par: Bitcoin-backed guarantees and trade-credit clearing on Mezo.",
  },

  // Learn
  { href: "/docs/learn/overview", title: "Overview", tab: "Learn", group: "Get started", description: "What Par is, who it is for, and how the pieces fit together." },
  { href: "/docs/learn/quickstart", title: "Quickstart", tab: "Learn", group: "Get started", description: "From a wallet to a live, shareable guarantee in a few minutes." },
  { href: "/docs/learn/how-it-works", title: "How it works", tab: "Learn", group: "Concepts", description: "Vault, trove, capacity, commitments and the payout waterfall." },
  { href: "/docs/learn/guarantees", title: "Guarantees", tab: "Learn", group: "Concepts", description: "Installment guarantees and claim bonds: who does what, and when the vault pays." },
  { href: "/docs/learn/circuit", title: "Circuit", tab: "Learn", group: "Concepts", description: "Trade credit netted onchain. Only net debts settle, backed by clearing lines." },
  { href: "/docs/learn/risk", title: "Risk and safety", tab: "Learn", group: "Safety", description: "The stress test, Mezo's collateral thresholds, Recovery Mode and what a certificate's numbers mean." },
  { href: "/docs/learn/glossary", title: "Glossary", tab: "Learn", group: "Safety", description: "Short definitions of the terms used across Par and MUSD." },

  // Guides
  { href: "/docs/guides/connect-wallet", title: "Connect a wallet", tab: "Guides", group: "Setup", description: "Use an EVM wallet through Reown or a Bitcoin wallet through Mezo Passport." },
  { href: "/docs/guides/open-vault", title: "Open a vault", tab: "Guides", group: "Setup", description: "Create your vault and open its trove with the BTC you want to pledge." },
  { href: "/docs/guides/manage-vault", title: "Manage your vault", tab: "Guides", group: "Setup", description: "Top up, fund the Recovery Mode reserve, use the buffer, repay and close." },
  { href: "/docs/guides/make-guarantee", title: "Make a guarantee", tab: "Guides", group: "Guarantees", description: "Create an installment guarantee or a claim bond and share its certificate." },
  { href: "/docs/guides/read-certificate", title: "Read a certificate", tab: "Guides", group: "Guarantees", description: "What each number on a public certificate page means." },
  { href: "/docs/guides/pay-installments", title: "Pay installments", tab: "Guides", group: "Guarantees", description: "Pay on time from the pay link, and what happens when a payment is missed." },
  { href: "/docs/guides/claims", title: "File, dispute and resolve a claim", tab: "Guides", group: "Guarantees", description: "The claim lifecycle for bonds: file, challenge window, dispute, arbiter." },
  { href: "/docs/guides/join-circle", title: "Join a circle and post invoices", tab: "Guides", group: "Circuit", description: "Pledge a clearing line, become a member, then bill and accept invoices." },
  { href: "/docs/guides/settle-cycle", title: "Settle a cycle", tab: "Guides", group: "Circuit", description: "Settle as a net debtor, force-settle after the window, and claim as a net creditor." },
  { href: "/docs/guides/underwriting", title: "Request or back cover", tab: "Guides", group: "Market", description: "Post a cover request with a premium, or back one from your vault and earn it. Includes the Lagos pilot templates." },

  // Reference
  { href: "/docs/reference/par-factory", title: "ParFactory", tab: "Reference", group: "Contracts", description: "Deploys one ParVault clone per user and holds the risk parameters." },
  { href: "/docs/reference/par-vault", title: "ParVault", tab: "Reference", group: "Contracts", description: "The vault: trove management, commitments, claims, payouts and risk views." },
  { href: "/docs/reference/par-circuit", title: "ParCircuit", tab: "Reference", group: "Contracts", description: "Circles, members, invoices, netting and settlement." },
  { href: "/docs/reference/par-market", title: "ParMarket", tab: "Reference", group: "Contracts", description: "Cover requests with escrowed premiums, filled atomically from a Par vault." },
  { href: "/docs/reference/addresses", title: "Deployed addresses", tab: "Reference", group: "Contracts", description: "Network details and contract addresses on Mezo testnet." },
  { href: "/docs/reference/parameters", title: "Protocol parameters", tab: "Reference", group: "Protocol", description: "Every number Par and MUSD use, and where it comes from." },
  { href: "/docs/reference/errors", title: "Errors", tab: "Reference", group: "Protocol", description: "Custom errors raised by the contracts, what they mean and what to do." },
  { href: "/docs/reference/keeper", title: "Keeper", tab: "Reference", group: "Protocol", description: "The bot that makes promises self-executing, and how to run your own." },
  { href: "/docs/reference/local-development", title: "Local development", tab: "Reference", group: "Developers", description: "Run the tests, a local chain with a MUSD model, and deploy to testnet." },
  { href: "/docs/reference/faq", title: "FAQ", tab: "Reference", group: "Developers", description: "Short answers to the questions people ask most." },
]

/** Pages that appear in the sidebar, in reading order (Learn, Guides, Reference). */
export const NAV_PAGES = DOC_TABS.flatMap((t) => DOC_PAGES.filter((p) => p.tab === t.name))

export function getDocPage(href: string): DocPage | undefined {
  const clean = href.replace(/\/$/, "") || "/"
  return DOC_PAGES.find((p) => p.href === clean)
}

/** Groups of one tab, in declaration order. */
export function groupsForTab(tab: string): { name: string; pages: DocPage[] }[] {
  const out: { name: string; pages: DocPage[] }[] = []
  for (const p of DOC_PAGES) {
    if (p.tab !== tab) continue
    let g = out.find((x) => x.name === p.group)
    if (!g) out.push((g = { name: p.group, pages: [] }))
    g.pages.push(p)
  }
  return out
}

export function prevNext(href: string): { prev?: DocPage; next?: DocPage } {
  const i = NAV_PAGES.findIndex((p) => p.href === href)
  if (i < 0) return {}
  return { prev: NAV_PAGES[i - 1], next: NAV_PAGES[i + 1] }
}

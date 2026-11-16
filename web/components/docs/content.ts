/**
 * Server-only loader for docs content. Pages live as Markdown in app/(docs)/docs/_content/<tab>/<slug>.md
 * and are read with fs at build time (every docs route is statically rendered).
 *
 * `{{name}}` placeholders are filled from lib/deployments.ts (generated from contracts/deployments/matsnet.json
 * by contracts/scripts/export-abis.js), so contract addresses are written down exactly once.
 */
import fs from "fs"
import path from "path"
import { DEPLOYMENTS } from "@/lib/deployments"
import { DOC_PAGES, NAV_PAGES, getDocPage, type DocPage } from "@/lib/docs-nav"
import { headings, parse, searchSections, toMarkdown, type Block, type Heading } from "./markdown"

const deployment = DEPLOYMENTS.matsnet
const CONTENT_DIR = path.join(process.cwd(), "app", "(docs)", "docs", "_content")
const EXPLORER = "https://explorer.test.mezo.org"

export const VARS: Record<string, string> = {
  network: deployment.network,
  chainId: String(deployment.chainId),
  rpc: "https://rpc.test.mezo.org",
  explorer: EXPLORER,
  factoryBlock: String(deployment.factoryBlock),
  ParFactory: deployment.ParFactory,
  ParVaultImplementation: deployment.ParVaultImplementation,
  ParCircuit: deployment.ParCircuit,
  ParMarket: ((deployment as Record<string, unknown>).ParMarket as string | undefined) ?? "0x0000000000000000000000000000000000000000",
  ...Object.fromEntries(Object.entries(deployment.musd).map(([k, v]) => [`musd.${k}`, String(v)])),
}

export type LoadedDoc = { page: DocPage; blocks: Block[]; toc: Heading[]; markdown: string }

const cache = new Map<string, LoadedDoc>()

export function contentFile(href: string) {
  return path.join(CONTENT_DIR, `${href.replace(/^\/docs\/?/, "") || "index"}.md`)
}

export function loadDoc(href: string): LoadedDoc {
  const hit = cache.get(href)
  if (hit) return hit
  const page = getDocPage(href)
  if (!page) throw new Error(`docs: no page registered for ${href} (add it to lib/docs-nav.ts)`)
  const raw = fs.readFileSync(contentFile(href), "utf8")
  const src = raw.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k: string) => {
    if (!(k in VARS)) throw new Error(`docs: unknown placeholder ${m} in ${href}`)
    return VARS[k]
  })
  const blocks = parse(src)
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://par-rosy.vercel.app"
  const markdown = `# ${page.title}\n\n${page.description ? `> ${page.description}\n\n` : ""}${toMarkdown(blocks, site)}\n`
  const doc = { page, blocks, toc: headings(blocks), markdown }
  cache.set(href, doc)
  return doc
}

export type SearchRecord = { href: string; page: string; tab: string; id: string | null; heading: string | null; text: string }

/** Static search index: one record per page section (intro + every h2/h3). */
export function searchIndex(): SearchRecord[] {
  return NAV_PAGES.flatMap((p) => {
    const d = loadDoc(p.href)
    const secs = searchSections(d.blocks)
    if (!secs.length || secs[0].heading) secs.unshift({ id: null, heading: null, text: "" })
    return secs.map((s, i) => ({
      href: p.href,
      page: p.title,
      tab: p.tab,
      id: s.id,
      heading: s.heading,
      text: i === 0 ? `${p.description ?? ""} ${s.text}`.trim() : s.text,
    }))
  })
}

export const allDocHrefs = () => DOC_PAGES.filter((p) => p.tab !== "Home").map((p) => p.href)

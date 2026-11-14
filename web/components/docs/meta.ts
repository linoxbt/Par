import type { Metadata } from "next"
import { getDocPage } from "@/lib/docs-nav"

/** Per-page metadata from the docs IA (title, description, canonical URL). */
export function docMetadata(href: string): Metadata {
  const p = getDocPage(href)
  if (!p) throw new Error(`docs: no page registered for ${href}`)
  const title = p.tab === "Home" ? "Documentation" : `${p.title} · Docs`
  return {
    title,
    description: p.description,
    alternates: { canonical: href },
    openGraph: { title: `${p.title} · Par docs`, description: p.description, url: href, type: "article" },
  }
}

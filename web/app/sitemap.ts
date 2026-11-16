import type { MetadataRoute } from "next"
import { DOC_PAGES } from "@/lib/docs-nav"

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://par-rosy.vercel.app"

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/pilot", "/developers", "/security", "/terms", "/privacy", "/cookies", ...DOC_PAGES.map((p) => p.href)]
  return [...new Set(paths)].map((p) => ({ url: `${SITE}${p}`, changeFrequency: "weekly", priority: p === "/" ? 1 : 0.6 }))
}

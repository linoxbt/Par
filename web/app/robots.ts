import type { MetadataRoute } from "next"

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://par-rosy.vercel.app"

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/vault", "/pay", "/circuit", "/market"] }], sitemap: `${SITE}/sitemap.xml` }
}

/** Docs information architecture. Filled in by the docs rebuild; kept here so the sitemap can list pages. */
export type DocPage = { href: string; title: string; tab: string; group: string; description?: string }
export const DOC_PAGES: DocPage[] = [{ href: "/docs", title: "Overview", tab: "Learn", group: "Get started" }]

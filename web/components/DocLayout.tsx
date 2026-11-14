"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export type TocItem = { id: string; title: string }

const DOCS: [string, string][] = [
  ["/docs", "Documentation"],
  ["/developers", "Developers"],
  ["/security", "Security"],
  ["/terms", "Terms of use"],
  ["/privacy", "Privacy policy"],
  ["/cookies", "Cookie policy"],
]

/** Sidebar + content layout for Docs and the legal pages, with a scroll-spy table of contents. */
export function DocLayout({
  kicker,
  title,
  intro,
  updated,
  toc,
  children,
}: {
  kicker: string
  title: string
  intro?: React.ReactNode
  updated?: string
  toc: TocItem[]
  children: React.ReactNode
}) {
  const path = usePathname()
  const [active, setActive] = useState(toc[0]?.id)
  useEffect(() => {
    const els = toc.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (vis[0]) setActive(vis[0].target.id)
      },
      { rootMargin: "-90px 0px -65% 0px" },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [toc])

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:pt-14">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* mobile: jump menu */}
          <div className="lg:hidden">
            <label className="text-xs text-muted" htmlFor="doc-jump">
              On this page
            </label>
            <select
              id="doc-jump"
              className="mt-1 w-full rounded-xl border border-line-strong bg-white px-3 py-2.5 text-sm"
              value={active}
              onChange={(e) => {
                setActive(e.target.value)
                document.getElementById(e.target.value)?.scrollIntoView({ behavior: "smooth" })
              }}
            >
              {toc.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <nav className="hidden lg:block">
            <div className="tag mb-3">On this page</div>
            <ul className="space-y-0.5 border-l border-line">
              {toc.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className={`-ml-px block border-l py-1.5 pl-3 text-sm transition ${active === t.id ? "border-btc font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
                  >
                    {t.title}
                  </a>
                </li>
              ))}
            </ul>
            <div className="tag mb-3 mt-8">Documents</div>
            <ul className="space-y-1.5 text-sm">
              {DOCS.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className={path === href ? "font-medium text-fg" : "text-muted hover:text-fg"}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <div className="tag">{kicker}</div>
          <h1 className="h-display mt-3 text-[40px] sm:text-5xl">{title}</h1>
          {intro && <div className="mt-4 text-[17px] leading-relaxed text-muted">{intro}</div>}
          {updated && <p className="mt-3 text-sm text-subtle">Last updated {updated}</p>}
          <div className="doc mt-10">{children}</div>
          <div className="mt-16 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-sm text-muted lg:hidden">
            {DOCS.map(([href, label]) => (
              <Link key={href} href={href} className={path === href ? "font-medium text-fg" : "hover:text-fg"}>
                {label}
              </Link>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}

export function DocH2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-4 mt-14 scroll-mt-24 text-2xl font-semibold tracking-tight first:mt-0">
      <a href={`#${id}`} className="group">
        {children}
        <span className="ml-2 text-subtle opacity-0 transition group-hover:opacity-100">#</span>
      </a>
    </h2>
  )
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn"; title?: string; children: React.ReactNode }) {
  return (
    <div className={`my-6 rounded-2xl border p-5 text-sm ${tone === "warn" ? "border-warn/20 bg-warn-wash" : "border-btc-line bg-btc-wash"}`}>
      {title && <div className={`mb-1 font-medium ${tone === "warn" ? "text-warn" : "text-btc-ink"}`}>{title}</div>}
      <div className="leading-relaxed text-fg/80">{children}</div>
    </div>
  )
}

export function Steps({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <ol className="my-6 space-y-4">
      {items.map(([t, d], i) => (
        <li key={t} className="flex gap-4">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fg font-mono text-[11px] text-white">{i + 1}</span>
          <div>
            <div className="font-medium">{t}</div>
            <div className="mt-0.5 text-[15px] leading-relaxed text-muted">{d}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}

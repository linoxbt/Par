import { DocLinks } from "@/components/docs/DocLinks"
import { Toc } from "@/components/docs/Toc"

export type TocItem = { id: string; title: string; level?: number }

/**
 * Layout for long-form documents (legal pages): content with a sticky "On this page" column on desktop
 * and a collapsible "On this page" disclosure on small screens. Shares the Toc component with /docs.
 */
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
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:pt-14">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
        <article className="min-w-0 max-w-3xl">
          <div className="tag">{kicker}</div>
          <h1 className="h-display mt-3 text-[40px] sm:text-5xl">{title}</h1>
          {intro && <div className="mt-4 text-[17px] leading-relaxed text-muted">{intro}</div>}
          {updated && <p className="mt-3 text-sm text-subtle">Last updated {updated}</p>}
          <Toc items={toc} variant="inline" offset={110} className="mt-8 lg:hidden" />
          <div className="doc mt-10">{children}</div>
          <div className="mt-16 border-t border-line pt-6 lg:hidden">
            <DocLinks variant="inline" />
          </div>
        </article>

        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6">
            <Toc items={toc} variant="aside" offset={110} />
            <div className="mb-3 mt-10 text-[13px] font-medium text-fg">Documents</div>
            <DocLinks />
          </div>
        </aside>
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

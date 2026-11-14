import { DOCS_UPDATED } from "@/lib/docs-nav"
import { loadDoc } from "./content"
import { CopyPage } from "./CopyPage"
import { Markdown } from "./Markdown"
import { PrevNext } from "./PrevNext"
import { Toc } from "./Toc"
import { GITHUB_URL } from "./constants"

/** One docs page: header, collapsible TOC (small screens), body, prev/next, and the right-hand TOC. */
export function DocArticle({ href }: { href: string }) {
  const { page, blocks, toc, markdown } = loadDoc(href)
  const source = `${GITHUB_URL}/blob/main/web/app/(docs)/docs/_content/${href.replace(/^\/docs\//, "")}.md`
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_224px] xl:gap-12">
      <article className="mx-auto w-full min-w-0 max-w-[720px] pb-16 pt-7 lg:pt-10 xl:mx-0">
        <div className="text-[13px] font-medium text-btc-ink">{page.group}</div>
        <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.03em] text-fg sm:text-[34px]">{page.title}</h1>
          <CopyPage markdown={markdown} className="hidden sm:inline-flex sm:mt-1.5" />
        </div>
        {page.description && <p className="mt-2.5 text-[17px] leading-relaxed text-muted">{page.description}</p>}
        <CopyPage markdown={markdown} className="mt-4 sm:hidden" />
        {toc.length > 1 && <Toc items={toc} variant="inline" className="mt-6 xl:hidden" offset={150} />}
        <div className="pd-body mt-8">
          <Markdown blocks={blocks} />
        </div>
        <PrevNext href={href} />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-[13px] text-subtle">
          <span>Last updated {page.updated ?? DOCS_UPDATED}</span>
          <a href={source} target="_blank" rel="noreferrer" className="hover:text-fg">
            Suggest an edit on GitHub
          </a>
        </div>
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-[var(--pd-header)] max-h-[calc(100vh-var(--pd-header))] overflow-y-auto pb-10 pt-10">
          <Toc items={toc} variant="aside" offset={150} />
        </div>
      </aside>
    </div>
  )
}

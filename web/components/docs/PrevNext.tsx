import Link from "next/link"
import { prevNext } from "@/lib/docs-nav"
import { Icon } from "./icons"

/** Previous / next page cards, following the sidebar order across tabs. */
export function PrevNext({ href }: { href: string }) {
  const { prev, next } = prevNext(href)
  if (!prev && !next) return null
  const card = "group flex min-w-0 flex-1 flex-col rounded-xl border border-line bg-white px-4 py-3.5 transition hover:border-line-strong hover:shadow-card"
  return (
    <nav aria-label="Pagination" className="mt-14 flex flex-col gap-3 sm:flex-row">
      {prev ? (
        <Link href={prev.href} rel="prev" className={card}>
          <span className="flex items-center gap-1 text-[12px] text-subtle">
            <Icon name="chevronLeft" size={13} /> Previous
          </span>
          <span className="mt-1 truncate text-[14.5px] font-medium text-fg group-hover:text-btc-ink">{prev.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
      {next ? (
        <Link href={next.href} rel="next" className={`${card} sm:items-end sm:text-right`}>
          <span className="flex items-center gap-1 text-[12px] text-subtle">
            Next <Icon name="chevronRight" size={13} />
          </span>
          <span className="mt-1 max-w-full truncate text-[14.5px] font-medium text-fg group-hover:text-btc-ink">{next.title}</span>
        </Link>
      ) : (
        <span className="hidden flex-1 sm:block" />
      )}
    </nav>
  )
}

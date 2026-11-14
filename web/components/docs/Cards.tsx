import Link from "next/link"
import { Icon } from "./icons"

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  const grid = cols >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : cols === 1 ? "" : "sm:grid-cols-2"
  return <div className={`my-6 grid gap-4 ${grid}`}>{children}</div>
}

/** Link card with an optional icon. */
export function Card({ title, href, icon, children }: { title: React.ReactNode; href?: string; icon?: string; children?: React.ReactNode }) {
  const inner = (
    <>
      {icon && (
        <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-btc-ink shadow-card">
          <Icon name={icon} size={18} />
        </span>
      )}
      <span className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-fg">
        {title}
        {href && <Icon name="arrowRight" size={14} className="text-subtle opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />}
      </span>
      {children && <span className="mt-1.5 block text-[14px] leading-relaxed text-muted">{children}</span>}
    </>
  )
  const cls = "group block rounded-2xl border border-line bg-white p-5 transition hover:border-line-strong hover:shadow-float"
  if (!href) return <div className={cls}>{inner}</div>
  return href.startsWith("/") ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={cls}>
      {inner}
    </a>
  )
}

import { Icon } from "./icons"

/** A left-to-right chain of labelled steps (stacks vertically on small screens). */
export function Flow({ items }: { items: { title: React.ReactNode; body?: React.ReactNode }[] }) {
  return (
    <ol className="my-8 flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
      {items.map((it, i) => (
        <li key={i} className="flex flex-col items-stretch md:flex-1 md:flex-row md:items-center">
          <div className="flex-1 rounded-xl border border-line bg-white px-4 py-3 shadow-card">
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">{String(i + 1).padStart(2, "0")}</div>
            <div className="mt-1 text-[14px] font-semibold tracking-tight text-fg">{it.title}</div>
            {it.body && <div className="mt-1 text-[13px] leading-snug text-muted">{it.body}</div>}
          </div>
          {i < items.length - 1 && (
            <span aria-hidden className="flex justify-center py-0.5 text-subtle md:px-1.5 md:py-0">
              <Icon name="arrowRight" size={14} className="rotate-90 md:rotate-0" />
            </span>
          )}
        </li>
      ))}
    </ol>
  )
}

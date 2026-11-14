import { Icon } from "./icons"

type Item = { title: React.ReactNode; body?: React.ReactNode }

/**
 * A chain of labelled steps. Up to four items render left to right on wide screens; longer chains
 * (and small screens) render as a vertical sequence.
 */
export function Flow({ items }: { items: Item[] }) {
  const row = items.length <= 4
  return (
    <ol className={`my-8 flex flex-col ${row ? "gap-2 md:flex-row md:items-stretch md:gap-0" : "gap-0"}`}>
      {items.map((it, i) =>
        row ? (
          <li key={i} className="flex flex-col items-stretch md:flex-1 md:flex-row">
            <div className="flex-1 rounded-xl border border-line bg-white px-4 py-3 shadow-card">
              <div className="font-mono text-[10.5px] uppercase tracking-wider text-subtle">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-1 text-[14px] font-semibold tracking-tight text-fg">{it.title}</div>
              {it.body && <div className="mt-1 text-[13px] leading-snug text-muted">{it.body}</div>}
            </div>
            {i < items.length - 1 && (
              <span aria-hidden className="flex items-center justify-center py-0.5 text-subtle md:px-1.5 md:py-0">
                <Icon name="arrowRight" size={14} className="rotate-90 md:rotate-0" />
              </span>
            )}
          </li>
        ) : (
          <li key={i} className="group relative flex gap-4 pb-3 last:pb-0">
            <span aria-hidden className="absolute bottom-0 left-[13.5px] top-7 w-px bg-line group-last:hidden" />
            <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg font-mono text-[11px] font-medium text-white">{i + 1}</span>
            <div className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-2.5 shadow-card sm:flex sm:items-baseline sm:gap-3">
              <div className="shrink-0 text-[14px] font-semibold tracking-tight text-fg sm:w-36">{it.title}</div>
              {it.body && <div className="text-[13.5px] leading-snug text-muted">{it.body}</div>}
            </div>
          </li>
        ),
      )}
    </ol>
  )
}

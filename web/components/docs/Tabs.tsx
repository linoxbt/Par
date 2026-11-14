"use client"

import { useId, useState } from "react"

/** Tabbed panels. Every panel is server-rendered; inactive ones are hidden. */
export function Tabs({ labels, children }: { labels: string[]; children: React.ReactNode[] }) {
  const [active, setActive] = useState(0)
  const id = useId()
  return (
    <div className="my-6">
      <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-line">
        {labels.map((l, i) => (
          <button
            key={l}
            role="tab"
            type="button"
            id={`${id}-t${i}`}
            aria-selected={active === i}
            aria-controls={`${id}-p${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
              const n = (active + (e.key === "ArrowRight" ? 1 : labels.length - 1)) % labels.length
              setActive(n)
              document.getElementById(`${id}-t${n}`)?.focus()
            }}
            className={`-mb-px whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[14px] transition ${active === i ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {children.map((c, i) => (
        <div key={i} role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={active !== i} className="pt-2 [&>*:last-child]:mb-0">
          {c}
        </div>
      ))}
    </div>
  )
}

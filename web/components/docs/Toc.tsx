"use client"

import { useEffect, useMemo, useState } from "react"
import { Icon } from "./icons"

export type TocEntry = { id: string; title: string; level?: number }

/** Scroll-spy: the last heading whose top has passed `offset` px from the viewport top. */
export function useActiveHeading(ids: string[], offset: number) {
  const [active, setActive] = useState<string | undefined>(ids[0])
  useEffect(() => {
    if (!ids.length) return
    let raf = 0
    const update = () => {
      raf = 0
      const els = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[]
      if (!els.length) return
      let cur = els[0].id
      for (const el of els) {
        if (el.getBoundingClientRect().top - offset <= 1) cur = el.id
        else break
      }
      const doc = document.documentElement
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 4) {
        // at the very bottom, short last sections can never reach the offset line
        const lastVisible = [...els].reverse().find((el) => el.getBoundingClientRect().top < window.innerHeight)
        if (lastVisible) cur = lastVisible.id
      }
      setActive(cur)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ids, offset])
  return active
}

function jumpTo(id: string) {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: "smooth", block: "start" })
  history.replaceState(null, "", `#${id}`)
  return true
}

function jump(e: React.MouseEvent, id: string) {
  if (document.getElementById(id)) {
    e.preventDefault()
    jumpTo(id)
  }
}

function TocList({ items, active, onPick }: { items: TocEntry[]; active?: string; onPick?: () => void }) {
  return (
    <ul className="space-y-px border-l border-line">
      {items.map((t) => {
        const on = active === t.id
        return (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              onClick={(e) => {
                if (!onPick) return jump(e, t.id)
                // close the disclosure first so the layout above the target settles, then scroll
                e.preventDefault()
                onPick()
                requestAnimationFrame(() => requestAnimationFrame(() => jumpTo(t.id)))
              }}
              aria-current={on ? "location" : undefined}
              className={`-ml-px block border-l py-1.5 pr-2 text-[13.5px] leading-snug transition ${t.level === 3 ? "pl-6" : "pl-3.5"} ${on ? "border-btc font-medium text-btc-ink" : "border-transparent text-muted hover:border-line-strong hover:text-fg"}`}
            >
              {t.title}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * "On this page". `aside` is the sticky right-hand column on desktop; `inline` is a collapsible
 * disclosure for small screens (shows the current section while collapsed).
 */
export function Toc({ items, variant = "aside", offset = 150, className = "" }: { items: TocEntry[]; variant?: "aside" | "inline"; offset?: number; className?: string }) {
  const key = items.map((i) => i.id).join("|")
  const ids = useMemo(() => (key ? key.split("|") : []), [key])
  const active = useActiveHeading(ids, offset)
  const [open, setOpen] = useState(false)
  if (!items.length) return null

  if (variant === "aside")
    return (
      <nav aria-label="On this page" className={className}>
        <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-fg">
          <Icon name="list" size={15} className="text-muted" />
          On this page
        </div>
        <TocList items={items} active={active} />
      </nav>
    )

  const current = items.find((i) => i.id === active)
  return (
    <nav aria-label="On this page" className={`rounded-xl border border-line bg-white ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="toc-inline-panel"
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-[14px]"
      >
        <Icon name="list" size={15} className="text-muted" />
        <span className="font-medium text-fg">On this page</span>
        {!open && current && <span className="min-w-0 flex-1 truncate text-right text-[13px] text-muted">{current.title}</span>}
        <Icon name="chevronDown" size={16} className={`ml-auto text-subtle transition ${open ? "rotate-180" : ""}`} />
      </button>
      <div id="toc-inline-panel" hidden={!open} className="border-t border-line px-4 pb-3 pt-3">
        <TocList items={items} active={active} onPick={() => setOpen(false)} />
      </div>
    </nav>
  )
}

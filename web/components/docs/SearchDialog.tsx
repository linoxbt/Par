"use client"

import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import type { SearchRecord } from "./content"
import { Icon } from "./icons"
import { useFocusTrap } from "./useFocusTrap"

export const OPEN_SEARCH_EVENT = "par-docs:search"
export const openDocsSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))

let indexPromise: Promise<SearchRecord[]> | null = null
export function loadSearchIndex() {
  indexPromise ??= fetch("/docs/search.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .catch((e) => {
      indexPromise = null
      throw e
    })
  return indexPromise
}

const SUGGESTED = ["/docs/learn/quickstart", "/docs/guides/open-vault", "/docs/guides/make-guarantee", "/docs/learn/risk", "/docs/reference/par-vault", "/docs/reference/addresses"]

type Hit = SearchRecord & { score: number }

function search(index: SearchRecord[], q: string): Hit[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return []
  const hits: Hit[] = []
  for (const r of index) {
    const page = r.page.toLowerCase()
    const head = (r.heading ?? "").toLowerCase()
    const text = r.text.toLowerCase()
    let score = 0
    let all = true
    for (const t of terms) {
      const inPage = page.includes(t)
      const inHead = head.includes(t)
      const inText = text.includes(t)
      if (!inPage && !inHead && !inText) {
        all = false
        break
      }
      if (inHead) score += head.startsWith(t) || head.includes(" " + t) ? 12 : 8
      if (inPage) score += r.heading ? 2 : page.startsWith(t) || page.includes(" " + t) ? 14 : 10
      if (inText) score += 1 + Math.min(3, text.split(t).length - 1) * 0.5
    }
    if (all) hits.push({ ...r, score })
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 14)
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>
  const re = new RegExp(`(${terms.map(esc).join("|")})`, "gi")
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-sm bg-btc-wash px-0.5 text-btc-ink">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

function snippet(text: string, terms: string[]) {
  const lower = text.toLowerCase()
  let at = -1
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) return text.slice(0, 140) + (text.length > 140 ? "…" : "")
  const start = Math.max(0, at - 50)
  return (start > 0 ? "…" : "") + text.slice(start, start + 150).trim() + (start + 150 < text.length ? "…" : "")
}

/** ⌘K / Ctrl-K command palette over a static index of every docs page, heading and paragraph. */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [q, setQ] = useState("")
  const [index, setIndex] = useState<SearchRecord[] | null>(null)
  const [error, setError] = useState(false)
  const [sel, setSel] = useState(0)
  useFocusTrap(ref, open, onClose)

  useEffect(() => {
    if (!open || index) return
    loadSearchIndex()
      .then((d) => setIndex(d))
      .catch(() => setError(true))
  }, [open, index])

  useEffect(() => {
    if (!open) {
      setQ("")
      setSel(0)
    }
  }, [open])

  const terms = useMemo(() => q.toLowerCase().split(/\s+/).filter(Boolean), [q])
  const results: (SearchRecord | Hit)[] = useMemo(() => {
    if (!index) return []
    if (!terms.length) return SUGGESTED.map((h) => index.find((r) => r.href === h && !r.heading)).filter(Boolean) as SearchRecord[]
    return search(index, q)
  }, [index, q, terms.length])

  useEffect(() => setSel(0), [q])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" })
  }, [sel])

  const go = (r: SearchRecord) => {
    onClose()
    router.push(r.id ? `${r.href}#${r.id}` : r.href)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="pd-fade absolute inset-0 bg-fg/25 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Search documentation"
        className="pd-pop relative mx-auto mt-3 flex max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[640px] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-float sm:mt-[12vh] sm:max-h-[70vh]"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
          <Icon name="search" size={18} className="text-muted" />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setSel((s) => Math.min(results.length - 1, s + 1))
              } else if (e.key === "ArrowUp") {
                e.preventDefault()
                setSel((s) => Math.max(0, s - 1))
              } else if (e.key === "Enter" && results[sel]) {
                e.preventDefault()
                go(results[sel])
              }
            }}
            placeholder="Search the docs"
            aria-label="Search the docs"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="docs-search-results"
            aria-activedescendant={results[sel] ? `docs-hit-${sel}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-fg outline-none placeholder:text-subtle"
          />
          <button type="button" onClick={onClose} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted hover:text-fg">
            Esc
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!index && !error && <p className="px-3 py-8 text-center text-sm text-muted">Loading the index…</p>}
          {error && <p className="px-3 py-8 text-center text-sm text-muted">Search is unavailable right now.</p>}
          {index && terms.length > 0 && results.length === 0 && (
            <p className="px-3 py-10 text-center text-sm text-muted">
              No results for <span className="font-medium text-fg">&ldquo;{q}&rdquo;</span>
            </p>
          )}
          {index && results.length > 0 && (
            <>
              <div className="px-3 pb-1.5 pt-2 text-[11.5px] font-medium text-subtle">{terms.length ? "Results" : "Suggested"}</div>
              <ul ref={listRef} id="docs-search-results" role="listbox" aria-label="Results">
                {results.map((r, i) => (
                  <li key={`${r.href}#${r.id}`} id={`docs-hit-${i}`} role="option" aria-selected={sel === i} data-idx={i}>
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseMove={() => setSel(i)}
                      onClick={() => go(r)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${sel === i ? "bg-soft" : ""}`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-white ${sel === i ? "text-btc-ink" : "text-muted"}`}>
                        <Icon name={r.heading ? "hash" : "file"} size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-fg">
                          <Highlight text={r.heading ?? r.page} terms={terms} />
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-subtle">
                          {r.tab} <span aria-hidden>›</span> {r.page}
                        </span>
                        {terms.length > 0 && r.text && (
                          <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-muted">
                            <Highlight text={snippet(r.text, terms)} terms={terms} />
                          </span>
                        )}
                      </span>
                      {sel === i && <Icon name="arrowRight" size={14} className="mt-2 text-subtle" />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[11.5px] text-subtle sm:flex">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="font-mono">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}

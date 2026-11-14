"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Logo } from "@/components/Header"
import { DOC_TABS, getDocPage } from "@/lib/docs-nav"
import { Icon } from "./icons"
import { OPEN_SEARCH_EVENT, SearchDialog } from "./SearchDialog"
import { SearchButton } from "./SearchButton"
import { SidebarNav } from "./SidebarNav"
import { useFocusTrap } from "./useFocusTrap"

import { GITHUB_URL } from "./constants"

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <Link href="/" aria-label="Par home" className="flex items-center">
        <Logo />
      </Link>
      <span aria-hidden className="h-4 w-px bg-line-strong" />
      <Link href="/docs" className="font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-muted transition hover:text-fg">
        Docs
      </Link>
    </div>
  )
}

/**
 * Docs chrome: top bar (logo, search, links), section tabs (desktop), a sticky mobile sub-header with
 * the current page title, the slide-in navigation drawer, and the ⌘K search dialog.
 */
export function DocsHeader() {
  const path = usePathname()
  const page = getDocPage(path)
  const currentTab = page?.tab
  const [drawer, setDrawer] = useState(false)
  const [drawerTab, setDrawerTab] = useState(currentTab && currentTab !== "Home" ? currentTab : "Learn")
  const [search, setSearch] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(drawerRef, drawer, () => setDrawer(false))

  useEffect(() => {
    setDrawer(false)
    setSearch(false)
  }, [path])
  useEffect(() => {
    if (drawer) setDrawerTab(currentTab && currentTab !== "Home" ? currentTab : "Learn")
  }, [drawer, currentTab])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setDrawer(false)
        setSearch((s) => !s)
      } else if (e.key === "/" && !search && !(e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]")) {
        e.preventDefault()
        setSearch(true)
      }
    }
    const onOpen = () => setSearch(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen)
    }
  }, [search])

  const title = page?.title ?? "Documentation"

  return (
    <>
      <header className="pd-header sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/85">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center gap-4 lg:h-16">
            <Brand />
            <div className="hidden flex-1 justify-center md:flex">
              <SearchButton onClick={() => setSearch(true)} className="max-w-[340px]" />
            </div>
            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <button
                type="button"
                onClick={() => setSearch(true)}
                aria-label="Search documentation"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-fg md:hidden"
              >
                <Icon name="search" size={18} />
              </button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden h-9 items-center gap-2 rounded-full px-3 text-[13.5px] text-muted transition hover:bg-soft hover:text-fg md:flex"
              >
                <Icon name="github" size={16} />
                GitHub
              </a>
              <Link href="/vault" className="hidden h-9 items-center rounded-full bg-fg px-4 text-[13.5px] font-medium text-white transition hover:bg-black/80 sm:flex">
                Open app
              </Link>
            </div>
          </div>

          {/* section tabs (desktop) */}
          <nav aria-label="Documentation sections" className="hidden h-12 items-stretch gap-7 border-t border-line lg:flex">
            {DOC_TABS.map((t) => {
              const on = currentTab === t.name
              return (
                <Link
                  key={t.name}
                  href={t.href}
                  aria-current={on ? "true" : undefined}
                  className={`-mb-px flex items-center border-b-2 text-[14px] transition ${on ? "border-fg font-medium text-fg" : "border-transparent text-muted hover:border-line-strong hover:text-fg"}`}
                >
                  {t.name}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* mobile sub-header: hamburger + current page title */}
        <div className="border-t border-line lg:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-expanded={drawer}
            aria-controls="docs-drawer"
            aria-label={`Open navigation (current page: ${title})`}
            className="flex h-12 w-full items-center gap-3 px-4 text-left sm:px-6"
          >
            <Icon name="menu" size={20} className="text-fg" />
            <span className="min-w-0 truncate text-[15px] font-medium text-fg">{title}</span>
          </button>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="pd-fade absolute inset-0 bg-fg/30" onClick={() => setDrawer(false)} aria-hidden />
          <div
            ref={drawerRef}
            id="docs-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Documentation navigation"
            className="pd-slide absolute inset-y-0 left-0 flex w-[min(340px,88vw)] flex-col bg-white shadow-float"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
              <Brand />
              <button
                type="button"
                data-autofocus
                onClick={() => setDrawer(false)}
                aria-label="Close navigation"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-fg"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-4">
              <SearchButton
                onClick={() => {
                  setDrawer(false)
                  setSearch(true)
                }}
                className="mb-4"
              />
              <div role="tablist" aria-label="Documentation sections" className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
                {DOC_TABS.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    role="tab"
                    aria-selected={drawerTab === t.name}
                    onClick={() => setDrawerTab(t.name)}
                    className={`rounded-lg py-2 text-[13.5px] transition ${drawerTab === t.name ? "bg-white font-medium text-fg shadow-card" : "text-muted hover:text-fg"}`}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
              <SidebarNav tab={drawerTab} onNavigate={() => setDrawer(false)} />
            </div>
            <div className="flex shrink-0 items-center gap-2 border-t border-line p-3">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full border border-line text-[14px] text-fg">
                <Icon name="github" size={16} />
                GitHub
              </a>
              <Link href="/vault" className="flex h-10 flex-1 items-center justify-center rounded-full bg-fg text-[14px] font-medium text-white">
                Open app
              </Link>
            </div>
          </div>
        </div>
      )}

      <SearchDialog open={search} onClose={() => setSearch(false)} />
    </>
  )
}

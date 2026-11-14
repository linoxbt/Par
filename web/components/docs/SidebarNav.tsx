"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { GROUP_ICONS, getDocPage, groupsForTab } from "@/lib/docs-nav"
import { Icon } from "./icons"

/** Grouped page list for one tab. Used by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ tab, onNavigate }: { tab: string; onNavigate?: () => void }) {
  const path = usePathname()
  return (
    <div className="space-y-7">
      {groupsForTab(tab).map((g) => (
        <div key={g.name}>
          <div className="mb-2 flex items-center gap-2 px-3 text-[13px] font-semibold text-fg">
            <Icon name={GROUP_ICONS[g.name] ?? "file"} size={15} className="text-muted" />
            {g.name}
          </div>
          <ul className="space-y-px">
            {g.pages.map((p) => {
              const on = path === p.href
              return (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    onClick={onNavigate}
                    aria-current={on ? "page" : undefined}
                    className={`block rounded-lg px-3 py-[7px] text-[14px] leading-snug transition ${on ? "bg-btc-wash font-medium text-btc-ink" : "text-muted hover:bg-soft hover:text-fg"}`}
                  >
                    {p.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Desktop sidebar: shows the groups of the current page's tab. */
export function Sidebar() {
  const path = usePathname()
  const tab = getDocPage(path)?.tab ?? "Learn"
  return (
    <nav aria-label="Documentation" className="pb-10 pt-8">
      <SidebarNav tab={tab} />
    </nav>
  )
}

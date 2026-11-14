"use client"

import { useEffect, useState } from "react"
import { Icon } from "./icons"
import { loadSearchIndex } from "./SearchDialog"

function useShortcutLabel() {
  const [label, setLabel] = useState("⌘K")
  useEffect(() => {
    if (!/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setLabel("Ctrl K")
  }, [])
  return label
}

/** Search field used in the top bar and the docs landing hero. */
export function SearchButton({ onClick, size = "sm", className = "" }: { onClick: () => void; size?: "sm" | "lg"; className?: string }) {
  const kbd = useShortcutLabel()
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => void loadSearchIndex().catch(() => {})}
      aria-label="Search documentation"
      className={`group flex w-full items-center gap-2.5 rounded-xl border border-line bg-white text-left text-muted shadow-card transition hover:border-line-strong hover:text-fg ${size === "lg" ? "h-[52px] px-4 text-[15px]" : "h-9 px-3 text-[13.5px]"} ${className}`}
    >
      <Icon name="search" size={size === "lg" ? 18 : 15} />
      <span className="flex-1 truncate">Search the docs…</span>
      <kbd className="hidden rounded-md border border-line bg-soft/60 px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline">{kbd}</kbd>
    </button>
  )
}


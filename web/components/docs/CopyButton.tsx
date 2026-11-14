"use client"

import { useState } from "react"
import { Icon } from "./icons"

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without the async clipboard API (or without permission)
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  }
}

/** Small icon button that copies `text` and shows a check for 1.5 s. */
export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        }
      }}
      aria-label={done ? "Copied" : label}
      title={done ? "Copied" : label}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-soft hover:text-fg ${className}`}
    >
      <Icon name={done ? "check" : "copy"} size={14} className={done ? "text-ok" : ""} />
    </button>
  )
}

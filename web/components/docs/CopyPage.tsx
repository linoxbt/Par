"use client"

import { useState } from "react"
import { copyText } from "./CopyButton"
import { Icon } from "./icons"

/** Copies the page as Markdown (title, description, body). */
export function CopyPage({ markdown, className = "" }: { markdown: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle")
  return (
    <button
      type="button"
      onClick={async () => {
        setState((await copyText(markdown)) ? "done" : "fail")
        setTimeout(() => setState("idle"), 1800)
      }}
      className={`inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 text-[13px] text-fg/80 shadow-card transition hover:border-line-strong hover:text-fg ${className}`}
      title="Copy this page as Markdown"
    >
      <Icon name={state === "done" ? "check" : "copy"} size={14} className={state === "done" ? "text-ok" : "text-muted"} />
      <span aria-live="polite">{state === "done" ? "Copied" : state === "fail" ? "Copy failed" : "Copy page"}</span>
    </button>
  )
}

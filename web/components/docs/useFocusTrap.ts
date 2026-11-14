"use client"

import { useEffect, useRef } from "react"

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'

/**
 * While `active`: keeps Tab focus inside `ref`, calls `onEscape` on Escape, locks body scroll,
 * focuses `[data-autofocus]` (or the first focusable), and restores focus on deactivate.
 */
export function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean, onEscape: () => void) {
  const esc = useRef(onEscape)
  esc.current = onEscape
  useEffect(() => {
    if (!active) return
    const node = ref.current
    if (!node) return
    const prev = document.activeElement as HTMLElement | null
    const list = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)
    const first = node.querySelector<HTMLElement>("[data-autofocus]") ?? list()[0]
    requestAnimationFrame(() => first?.focus())

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        esc.current()
        return
      }
      if (e.key !== "Tab") return
      const f = list()
      if (!f.length) return
      const a = document.activeElement
      if (!node.contains(a)) {
        e.preventDefault()
        f[0].focus()
      } else if (e.shiftKey && a === f[0]) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && a === f[f.length - 1]) {
        e.preventDefault()
        f[0].focus()
      }
    }
    document.addEventListener("keydown", onKey)
    const html = document.documentElement
    const prevOverflow = document.body.style.overflow
    const prevPad = document.body.style.paddingRight
    const gap = window.innerWidth - html.clientWidth
    document.body.style.overflow = "hidden"
    if (gap > 0) document.body.style.paddingRight = `${gap}px`
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPad
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true })
    }
  }, [active, ref])
}

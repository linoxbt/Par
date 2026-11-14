"use client"

import { useEffect, useState, type RefObject } from "react"

/** True when the user asked the OS for reduced motion. Tracks changes. */
export function useReducedMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const upd = () => setReduce(mq.matches)
    upd()
    mq.addEventListener("change", upd)
    return () => mq.removeEventListener("change", upd)
  }, [])
  return reduce
}

/** True while the element is (nearly) on screen. Used to pause animation loops off-screen. */
export function useInView(ref: RefObject<Element>, rootMargin = "80px") {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return inView
}

/** Font stack for canvas/SVG text, matching Tailwind's `font-mono`. */
export const MONO = '"Geist Mono Variable", "Geist Mono", ui-monospace, monospace'

"use client"

import { useEffect } from "react"

/** Route-level error boundary: a crash in one page never blanks the whole app. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-start justify-center px-5 py-24">
      <div className="tag">Something broke</div>
      <h1 className="h-display mt-3 text-3xl sm:text-4xl">This page hit an error.</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        Nothing was sent onchain. Try again; if it keeps happening, reload the page.
        {error.digest ? <span className="num mt-2 block text-xs text-subtle">ref {error.digest}</span> : null}
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-white hover:bg-black/80">
          Try again
        </button>
        <a href="/" className="rounded-full border border-line-strong bg-white px-5 py-2.5 text-sm font-medium hover:bg-soft">
          Home
        </a>
      </div>
    </div>
  )
}

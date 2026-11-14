import Link from "next/link"
import { Header } from "@/components/Header"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center px-5 py-24">
        <div className="tag">404</div>
        <h1 className="h-display mt-3 text-4xl sm:text-5xl">Nothing here.</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-muted">This page doesn&apos;t exist, or the link is incomplete. Certificate links look like /c/&lt;vault&gt;/&lt;id&gt;.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-fg px-5 py-2.5 text-sm font-medium text-white hover:bg-black/80">
            Back home
          </Link>
          <Link href="/docs" className="rounded-full border border-line-strong bg-white px-5 py-2.5 text-sm font-medium hover:bg-soft">
            Read the docs
          </Link>
        </div>
      </main>
    </div>
  )
}

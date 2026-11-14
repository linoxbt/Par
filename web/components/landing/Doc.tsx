import Link from "next/link"

export function DocHero({ kicker, title, muted, sub, children }: { kicker: string; title: string; muted: string; sub: string; children?: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-12 pt-10 sm:pb-14 sm:pt-16">
      <span className="tag">{kicker}</span>
      <h1 className="h-display mt-3 max-w-3xl text-[40px] sm:text-6xl">
        {title} <span className="text-subtle">{muted}</span>
      </h1>
      <p className="mt-5 max-w-xl text-base text-muted sm:text-[17px]">{sub}</p>
      {children}
    </section>
  )
}

export function DocSection({ id, n, title, children }: { id?: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto grid max-w-6xl scroll-mt-24 gap-6 border-t border-line px-5 py-10 sm:gap-8 sm:py-14 lg:grid-cols-[240px_1fr]">
      <div>
        <span className="font-mono text-[11px] text-subtle">{n}</span>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line bg-canvas text-xs text-muted">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-4 py-3 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md bg-soft px-1.5 py-0.5 font-mono text-[12.5px]">{children}</code>
}

export function Pre({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-2xl bg-[#0B0B0D] p-5 font-mono text-[12.5px] leading-relaxed text-white/85">{children}</pre>
}

export function NextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-btc-ink hover:underline">
      {children} <span aria-hidden>→</span>
    </Link>
  )
}

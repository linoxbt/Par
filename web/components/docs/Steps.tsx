/** Numbered steps with a connecting rail. */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="relative my-8">{children}</ol>
}

export function Step({ n, title, children }: { n: number; title: React.ReactNode; children?: React.ReactNode }) {
  return (
    <li className="group relative pb-8 pl-11 last:pb-1">
      <span aria-hidden className="absolute bottom-0 left-[13.5px] top-8 w-px bg-line group-last:hidden" />
      <span aria-hidden className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-white font-mono text-[12px] font-medium text-fg shadow-card">
        {n}
      </span>
      <div className="pt-0.5 text-[15.5px] font-semibold tracking-tight text-fg">{title}</div>
      <div className="mt-1.5 text-fg/80 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{children}</div>
    </li>
  )
}

import { Icon } from "./icons"

/** Collapsible section built on <details> (works without JavaScript). */
export function Accordion({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line first-of-type:border-t [&+details]:border-t-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15.5px] font-medium text-fg [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <Icon name="chevronDown" size={16} className="text-subtle transition group-open:rotate-180" />
      </summary>
      <div className="pb-5 text-fg/80 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{children}</div>
    </details>
  )
}

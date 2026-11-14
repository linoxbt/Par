"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export const DOC_LINKS: [string, string][] = [
  ["/docs", "Documentation"],
  ["/developers", "Developers"],
  ["/security", "Security"],
  ["/terms", "Terms of use"],
  ["/privacy", "Privacy policy"],
  ["/cookies", "Cookie policy"],
]

/** Links between the long-form documents, with the current one highlighted. */
export function DocLinks({ variant = "list" }: { variant?: "list" | "inline" }) {
  const path = usePathname()
  if (variant === "inline")
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {DOC_LINKS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={path === href ? "font-medium text-fg" : "hover:text-fg"}>
            {label}
          </Link>
        ))}
      </div>
    )
  return (
    <ul className="space-y-1.5 text-[13.5px]">
      {DOC_LINKS.map(([href, label]) => (
        <li key={href}>
          <Link href={href} aria-current={path === href ? "page" : undefined} className={path === href ? "font-medium text-fg" : "text-muted hover:text-fg"}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

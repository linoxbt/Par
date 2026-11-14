import "./docs.css"
import { DocsHeader } from "@/components/docs/DocsHeader"

export const dynamic = "force-static"

/** Docs chrome: own header (logo, search, tabs; mobile sub-header and drawer). Replaces the site header on /docs. */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pd-root min-h-screen bg-white">
      <DocsHeader />
      {children}
    </div>
  )
}

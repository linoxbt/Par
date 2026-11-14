import { Sidebar } from "@/components/docs/SidebarNav"

/** Inner docs pages: persistent left sidebar (desktop) + page content. */
export default function DocsPagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
      <div className="lg:grid lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <aside className="hidden lg:block">
          <div className="sticky top-[var(--pd-header)] -ml-3 max-h-[calc(100vh-var(--pd-header))] overflow-y-auto overscroll-contain pr-2">
            <Sidebar />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}

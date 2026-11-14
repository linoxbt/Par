import type { Metadata } from "next"
import { AppShell } from "./app-shell"

export const metadata: Metadata = { robots: { index: false } }

/** App routes (vault, guarantees, certificates, Circuit): wallet stack loads here only. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>
}

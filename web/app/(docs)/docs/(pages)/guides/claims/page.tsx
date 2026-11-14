import { DocArticle } from "@/components/docs/DocArticle"
import { docMetadata } from "@/components/docs/meta"

export const metadata = docMetadata("/docs/guides/claims")

export default function Page() {
  return <DocArticle href="/docs/guides/claims" />
}

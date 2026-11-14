import { DocArticle } from "@/components/docs/DocArticle"
import { docMetadata } from "@/components/docs/meta"

export const metadata = docMetadata("/docs/reference/errors")

export default function Page() {
  return <DocArticle href="/docs/reference/errors" />
}

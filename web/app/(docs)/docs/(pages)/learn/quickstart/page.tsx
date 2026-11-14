import { DocArticle } from "@/components/docs/DocArticle"
import { docMetadata } from "@/components/docs/meta"

export const metadata = docMetadata("/docs/learn/quickstart")

export default function Page() {
  return <DocArticle href="/docs/learn/quickstart" />
}

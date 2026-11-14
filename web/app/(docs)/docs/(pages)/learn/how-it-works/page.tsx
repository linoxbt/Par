import { DocArticle } from "@/components/docs/DocArticle"
import { docMetadata } from "@/components/docs/meta"

export const metadata = docMetadata("/docs/learn/how-it-works")

export default function Page() {
  return <DocArticle href="/docs/learn/how-it-works" />
}

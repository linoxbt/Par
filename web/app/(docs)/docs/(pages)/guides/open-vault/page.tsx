import { DocArticle } from "@/components/docs/DocArticle"
import { docMetadata } from "@/components/docs/meta"

export const metadata = docMetadata("/docs/guides/open-vault")

export default function Page() {
  return <DocArticle href="/docs/guides/open-vault" />
}

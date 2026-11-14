import { searchIndex } from "@/components/docs/content"

export const dynamic = "force-static"

/** Static search index for the docs command palette (built once at build time). */
export function GET() {
  return Response.json(searchIndex())
}

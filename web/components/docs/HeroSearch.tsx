"use client"

import { SearchButton } from "./SearchButton"
import { openDocsSearch } from "./SearchDialog"

export function HeroSearch() {
  return <SearchButton size="lg" onClick={openDocsSearch} />
}

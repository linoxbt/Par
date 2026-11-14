/**
 * A small Markdown dialect for the docs (no dependencies, runs at build time on the server).
 *
 * Blocks: ## / ### / #### headings (optional `{#id}`), paragraphs, - and 1. lists (indent 2 spaces to
 * continue or nest), | tables |, ``` fenced code (```lang title="file"), --- rules, and containers:
 *
 *   :::note Title        callouts: note, info, tip, warning, danger, check
 *   :::steps             @step Title  (body follows)
 *   :::tabs              @tab Label   (body follows)
 *   :::cards 2           @card title="…" href="/…" icon="…"  (description follows)
 *   :::details Question  collapsible
 *   :::flow              one "Title | description" per line, drawn as a left-to-right chain
 *   :::                  closes the innermost container
 *
 * Inline: **bold**, `code`, [text](href). Anything else is plain text (never raw HTML).
 */

export type Block =
  | { t: "h"; level: 2 | 3 | 4; text: string; id: string }
  | { t: "p"; text: string }
  | { t: "ul" | "ol"; items: Block[][] }
  | { t: "table"; head: string[]; rows: string[][] }
  | { t: "code"; lang: string; title?: string; code: string }
  | { t: "callout"; kind: string; title?: string; body: Block[] }
  | { t: "steps"; steps: { title: string; body: Block[] }[] }
  | { t: "tabs"; tabs: { label: string; body: Block[] }[] }
  | { t: "cards"; cols: number; cards: { title: string; href?: string; icon?: string; body: string }[] }
  | { t: "details"; title: string; body: Block[] }
  | { t: "flow"; items: { title: string; body: string }[] }
  | { t: "hr" }

export type Heading = { id: string; title: string; level: 2 | 3 }

export const CALLOUT_KINDS = ["note", "info", "tip", "warning", "danger", "check"]

export function slugify(s: string) {
  return (
    stripInline(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  )
}

/** Inline markdown to plain text. */
export function stripInline(s: string) {
  return s
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
}

const dedent = (lines: string[]) => {
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return Number.isFinite(ind) && ind > 0 ? lines.map((l) => l.slice(ind)) : lines
}

const attrs = (s: string) => {
  const out: Record<string, string> = {}
  for (const m of s.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2]
  return out
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"))

/** Split a container body on marker lines like "@step Title". */
function sections(lines: string[], marker: string) {
  const out: { head: string; lines: string[] }[] = []
  for (const l of lines) {
    const m = l.match(new RegExp(`^${marker}\\b\\s*(.*)$`))
    if (m) out.push({ head: m[1].trim(), lines: [] })
    else if (out.length) out[out.length - 1].lines.push(l)
  }
  return out
}

const isBlockStart = (l: string) => /^(```|:::|#{2,4}\s|\||\s*[-*]\s+|\s*\d+\.\s+|---\s*$|@\w)/.test(l)

export function parse(src: string, ids = new Set<string>()): Block[] {
  const lines = dedent(src.replace(/\r/g, "").split("\n"))
  const out: Block[] = []
  let i = 0
  const uid = (base: string) => {
    let id = base
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`
    ids.add(id)
    return id
  }

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }

    // fenced code
    const fence = line.match(/^```(\w*)\s*(.*)$/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++])
      i++
      out.push({ t: "code", lang: fence[1] || "text", title: attrs(fence[2]).title, code: body.join("\n") })
      continue
    }

    // containers
    const open = line.match(/^:::(\w+)\s*(.*)$/)
    if (open) {
      const kind = open[1]
      const rest = open[2].trim()
      const body: string[] = []
      let depth = 1
      i++
      while (i < lines.length) {
        const l = lines[i]
        if (/^:::\w/.test(l)) depth++
        else if (/^:::\s*$/.test(l) && --depth === 0) break
        body.push(l)
        i++
      }
      i++
      if (CALLOUT_KINDS.includes(kind)) out.push({ t: "callout", kind, title: rest || undefined, body: parse(body.join("\n"), ids) })
      else if (kind === "steps") out.push({ t: "steps", steps: sections(body, "@step").map((s) => ({ title: s.head, body: parse(s.lines.join("\n"), ids) })) })
      else if (kind === "tabs") out.push({ t: "tabs", tabs: sections(body, "@tab").map((s) => ({ label: s.head, body: parse(s.lines.join("\n"), ids) })) })
      else if (kind === "cards")
        out.push({
          t: "cards",
          cols: Number(rest) || 2,
          cards: sections(body, "@card").map((s) => {
            const a = attrs(s.head)
            return { title: a.title ?? "", href: a.href, icon: a.icon, body: s.lines.map((l) => l.trim()).filter(Boolean).join(" ") }
          }),
        })
      else if (kind === "details") out.push({ t: "details", title: rest, body: parse(body.join("\n"), ids) })
      else if (kind === "flow")
        out.push({
          t: "flow",
          items: body
            .filter((l) => l.trim())
            .map((l) => {
              const [title, ...d] = l.split("|")
              return { title: title.trim(), body: d.join("|").trim() }
            }),
        })
      else out.push({ t: "callout", kind: "note", title: rest || kind, body: parse(body.join("\n"), ids) })
      continue
    }

    // headings
    const h = line.match(/^(#{2,4})\s+(.*?)\s*(?:\{#([\w-]+)\})?\s*$/)
    if (h) {
      const text = h[2]
      out.push({ t: "h", level: h[1].length as 2 | 3 | 4, text, id: uid(h[3] || slugify(text)) })
      i++
      continue
    }

    if (/^---\s*$/.test(line)) {
      out.push({ t: "hr" })
      i++
      continue
    }

    // tables
    if (line.startsWith("|")) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].startsWith("|")) rows.push(splitRow(lines[i++]))
      const sep = rows[1] && rows[1].every((c) => /^:?-{2,}:?$/.test(c))
      out.push(sep ? { t: "table", head: rows[0], rows: rows.slice(2) } : { t: "table", head: [], rows })
      continue
    }

    // lists
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+/)
    if (li) {
      const ordered = /\d/.test(li[2])
      const base = li[1].length
      const items: string[][] = []
      while (i < lines.length) {
        const l = lines[i]
        const m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/)
        if (m && m[1].length === base && /\d/.test(m[2]) === ordered) {
          items.push([m[3]])
          i++
        } else if (l.trim() === "") {
          // blank line: continue the list only if the next line is indented or another item
          const nx = lines[i + 1] ?? ""
          const nm = nx.match(/^(\s*)([-*]|\d+\.)\s+/)
          if ((nm && nm[1].length === base && /\d/.test(nm[2]) === ordered) || /^\s{2,}\S/.test(nx)) {
            items[items.length - 1].push("")
            i++
          } else break
        } else if (/^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1].push(l.slice(Math.min(base + 2, l.match(/^ */)![0].length)))
          i++
        } else if (!isBlockStart(l) && items.length) {
          items[items.length - 1][items[items.length - 1].length - 1] += " " + l.trim()
          i++
        } else break
      }
      out.push({ t: ordered ? "ol" : "ul", items: items.map((it) => parse(it.join("\n"), ids)) })
      continue
    }

    // paragraph
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++].trim())
    out.push({ t: "p", text: para.join(" ") })
  }
  return out
}

/** Top-level h2/h3 headings (headings inside tabs, steps, etc. are not in the TOC). */
export function headings(blocks: Block[]): Heading[] {
  return blocks.flatMap((b) => (b.t === "h" && b.level <= 3 ? [{ id: b.id, title: stripInline(b.text), level: b.level as 2 | 3 }] : []))
}

/** Plain text of a block list (for search). */
export function plain(blocks: Block[]): string {
  const parts: string[] = []
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      switch (b.t) {
        case "h":
        case "p":
          parts.push(stripInline(b.text))
          break
        case "ul":
        case "ol":
          b.items.forEach(walk)
          break
        case "table":
          parts.push([b.head, ...b.rows].map((r) => r.map(stripInline).join(" ")).join(" "))
          break
        case "code":
          parts.push(b.code)
          break
        case "callout":
          if (b.title) parts.push(stripInline(b.title))
          walk(b.body)
          break
        case "steps":
          b.steps.forEach((s) => (parts.push(stripInline(s.title)), walk(s.body)))
          break
        case "tabs":
          b.tabs.forEach((s) => (parts.push(stripInline(s.label)), walk(s.body)))
          break
        case "cards":
          b.cards.forEach((c) => parts.push(stripInline(c.title), stripInline(c.body)))
          break
        case "details":
          parts.push(stripInline(b.title))
          walk(b.body)
          break
        case "flow":
          b.items.forEach((f) => parts.push(stripInline(f.title), stripInline(f.body)))
          break
      }
    }
  }
  walk(blocks)
  return parts.join(" ").replace(/\s+/g, " ").trim()
}

/** Split a page into searchable sections at each top-level h2/h3. */
export function searchSections(blocks: Block[]): { id: string | null; heading: string | null; text: string }[] {
  const out: { id: string | null; heading: string | null; buf: Block[] }[] = [{ id: null, heading: null, buf: [] }]
  for (const b of blocks) {
    if (b.t === "h" && b.level <= 3) out.push({ id: b.id, heading: stripInline(b.text), buf: [] })
    else out[out.length - 1].buf.push(b)
  }
  return out.map((s) => ({ id: s.id, heading: s.heading, text: plain(s.buf) })).filter((s) => s.heading || s.text)
}

/** Standard Markdown (for "Copy page"): containers become quotes, numbered steps, and sections. */
export function toMarkdown(blocks: Block[], site = ""): string {
  const abs = (s: string) => s.replace(/\]\((\/[^)]*)\)/g, `](${site}$1)`)
  const out: string[] = []
  for (const b of blocks) {
    switch (b.t) {
      case "h":
        out.push(`${"#".repeat(b.level)} ${abs(b.text)}`)
        break
      case "p":
        out.push(abs(b.text))
        break
      case "ul":
      case "ol":
        out.push(
          b.items
            .map((it, n) => {
              const inner = toMarkdown(it, site).split("\n")
              const mark = b.t === "ol" ? `${n + 1}. ` : "- "
              return mark + inner[0] + inner.slice(1).map((l) => (l ? "\n   " + l : "\n")).join("")
            })
            .join("\n"),
        )
        break
      case "table": {
        const rows = b.head.length ? [b.head, b.head.map(() => "---"), ...b.rows] : b.rows
        out.push(rows.map((r) => `| ${r.map((c) => abs(c).replace(/\|/g, "\\|")).join(" | ")} |`).join("\n"))
        break
      }
      case "code":
        out.push("```" + (b.lang === "text" ? "" : b.lang) + "\n" + b.code + "\n```")
        break
      case "callout": {
        const label = b.title ?? b.kind[0].toUpperCase() + b.kind.slice(1)
        const body = toMarkdown(b.body, site)
        out.push([`**${label}**`, ...body.split("\n")].map((l) => (l ? `> ${l}` : ">")).join("\n"))
        break
      }
      case "steps":
        out.push(b.steps.map((s, n) => `**${n + 1}. ${abs(s.title)}**\n\n${toMarkdown(s.body, site)}`).join("\n\n"))
        break
      case "tabs":
        out.push(b.tabs.map((s) => `**${s.label}**\n\n${toMarkdown(s.body, site)}`).join("\n\n"))
        break
      case "cards":
        out.push(b.cards.map((c) => `- ${c.href ? `[${c.title}](${c.href.startsWith("/") ? site + c.href : c.href})` : `**${c.title}**`}: ${abs(c.body)}`).join("\n"))
        break
      case "details":
        out.push(`**${abs(b.title)}**\n\n${toMarkdown(b.body, site)}`)
        break
      case "flow":
        out.push(b.items.map((f, n) => `${n + 1}. **${f.title}**: ${abs(f.body)}`).join("\n"))
        break
      case "hr":
        out.push("---")
        break
    }
  }
  return out.join("\n\n")
}

import Link from "next/link"
import { Fragment } from "react"
import { Accordion } from "./Accordion"
import { Callout } from "./Callout"
import { Card, CardGroup } from "./Cards"
import { CodeBlock } from "./CodeBlock"
import { Flow } from "./Flow"
import { Step, Steps } from "./Steps"
import { Table } from "./Table"
import { Tabs } from "./Tabs"
import type { Block } from "./markdown"

const linkCls = "font-medium text-fg underline decoration-btc/40 decoration-1 underline-offset-[3px] transition hover:decoration-btc [&_code]:border-btc-line [&_code]:text-btc-ink"

/** Inline markdown: **bold**, `code`, [text](href). */
export function Inline({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  const re = /`([^`]+)`|\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined)
      out.push(
        <code key={k++} className="rounded-md border border-line bg-soft/70 px-[5px] py-[1px] font-mono text-[0.86em] text-fg [overflow-wrap:anywhere]">
          {m[1]}
        </code>,
      )
    else if (m[2] !== undefined)
      out.push(
        <strong key={k++} className="font-semibold text-fg">
          <Inline text={m[2]} />
        </strong>,
      )
    else {
      const href = m[4]
      const inner = <Inline text={m[3]} />
      out.push(
        href.startsWith("/") || href.startsWith("#") ? (
          <Link key={k++} href={href} className={linkCls}>
            {inner}
          </Link>
        ) : (
          <a key={k++} href={href} target="_blank" rel="noreferrer" className={linkCls}>
            {inner}
          </a>
        ),
      )
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out}</>
}

function Heading({ level, id, text }: { level: 2 | 3 | 4; id: string; text: string }) {
  const cls =
    level === 2
      ? "mt-12 mb-3 text-[22px] font-semibold tracking-[-0.02em] text-fg"
      : level === 3
        ? "mt-9 mb-2 text-[17px] font-semibold tracking-tight text-fg"
        : "mt-6 mb-2 text-[15px] font-semibold text-fg"
  const Tag = `h${level}` as "h2" | "h3" | "h4"
  return (
    <Tag id={id} className={`pd-heading group relative ${cls}`}>
      <Inline text={text} />
      <a href={`#${id}`} aria-label="Link to this section" className="ml-2 inline-block text-subtle no-underline opacity-0 transition hover:text-btc-ink focus:opacity-100 group-hover:opacity-100">
        #
      </a>
    </Tag>
  )
}

/** Renders parsed docs Markdown with the shared docs components. */
export function Markdown({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => (
        <Fragment key={i}>{renderBlock(b)}</Fragment>
      ))}
    </>
  )
}

function renderBlock(b: Block): React.ReactNode {
  switch (b.t) {
    case "h":
      return <Heading level={b.level} id={b.id} text={b.text} />
    case "p":
      return (
        <p className="my-4 text-[15.5px] leading-[1.75] text-fg/80">
          <Inline text={b.text} />
        </p>
      )
    case "ul":
    case "ol": {
      const Tag = b.t
      return (
        <Tag className={`my-4 space-y-2 pl-6 text-[15.5px] leading-[1.7] text-fg/80 ${b.t === "ul" ? "list-disc marker:text-subtle" : "list-decimal marker:font-mono marker:text-[13px] marker:text-muted"}`}>
          {b.items.map((it, i) => (
            <li key={i} className="pl-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>p]:my-2 [&_ol]:my-2 [&_ul]:my-2">
              {it.length === 1 && it[0].t === "p" ? <Inline text={it[0].text} /> : <Markdown blocks={it} />}
            </li>
          ))}
        </Tag>
      )
    }
    case "table":
      return <Table head={b.head.map((h, i) => <Inline key={i} text={h} />)} rows={b.rows.map((r) => r.map((c, j) => <Inline key={j} text={c} />))} />
    case "code":
      return <CodeBlock code={b.code} lang={b.lang} title={b.title} />
    case "callout":
      return (
        <Callout kind={b.kind} title={b.title ? <Inline text={b.title} /> : undefined}>
          <Markdown blocks={b.body} />
        </Callout>
      )
    case "steps":
      return (
        <Steps>
          {b.steps.map((s, i) => (
            <Step key={i} n={i + 1} title={<Inline text={s.title} />}>
              <Markdown blocks={s.body} />
            </Step>
          ))}
        </Steps>
      )
    case "tabs":
      return (
        <Tabs labels={b.tabs.map((t) => t.label)}>
          {b.tabs.map((t, i) => (
            <Markdown key={i} blocks={t.body} />
          ))}
        </Tabs>
      )
    case "cards":
      return (
        <CardGroup cols={b.cols}>
          {b.cards.map((c, i) => (
            <Card key={i} title={c.title} href={c.href} icon={c.icon}>
              {c.body ? <Inline text={c.body} /> : null}
            </Card>
          ))}
        </CardGroup>
      )
    case "details":
      return (
        <Accordion title={<Inline text={b.title} />}>
          <Markdown blocks={b.body} />
        </Accordion>
      )
    case "flow":
      return <Flow items={b.items.map((f) => ({ title: <Inline text={f.title} />, body: f.body ? <Inline text={f.body} /> : undefined }))} />
    case "hr":
      return <hr className="my-10 border-line" />
  }
}

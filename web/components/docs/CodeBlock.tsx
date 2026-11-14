import { CopyButton } from "./CopyButton"

const LANG: Record<string, string> = { bash: "Terminal", sh: "Terminal", ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", sol: "Solidity", solidity: "Solidity", json: "JSON", text: "" }

/** Code block with a header (title or language) and a copy button. Comment lines are dimmed. */
export function CodeBlock({ code, lang = "text", title }: { code: string; lang?: string; title?: string }) {
  const label = title ?? LANG[lang] ?? lang
  const comment = lang === "bash" || lang === "sh" ? /^\s*#/ : /^\s*\/\//
  return (
    <div className="group my-6 overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className="flex h-10 items-center justify-between border-b border-line bg-soft/50 pl-4 pr-1.5">
        <span className="truncate font-mono text-[11.5px] text-muted">{label || "Code"}</span>
        <CopyButton text={code} label="Copy code" />
      </div>
      <pre className="overflow-x-auto px-4 py-3.5 font-mono text-[13px] leading-[1.7] text-fg">
        <code>
          {code.split("\n").map((l, i) => (
            <span key={i} className={`block ${comment.test(l) ? "text-subtle" : ""}`}>
              {l || " "}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

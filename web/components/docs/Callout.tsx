import { Icon } from "./icons"

const TONES: Record<string, { box: string; icon: string; title: string; name: string }> = {
  note: { box: "border-line bg-soft/60", icon: "text-muted", title: "text-fg", name: "info" },
  info: { box: "border-btc-line bg-btc-wash/70", icon: "text-btc-ink", title: "text-btc-ink", name: "info" },
  tip: { box: "border-ok/20 bg-ok-wash", icon: "text-ok", title: "text-ok", name: "bulb" },
  check: { box: "border-ok/20 bg-ok-wash", icon: "text-ok", title: "text-ok", name: "check" },
  warning: { box: "border-warn/25 bg-warn-wash", icon: "text-warn", title: "text-warn", name: "alert" },
  danger: { box: "border-bad/20 bg-bad-wash", icon: "text-bad", title: "text-bad", name: "alert" },
}

/** Callout box (note, info, tip, check, warning, danger). */
export function Callout({ kind = "note", title, children }: { kind?: string; title?: React.ReactNode; children?: React.ReactNode }) {
  const t = TONES[kind] ?? TONES.note
  return (
    <div className={`my-6 flex gap-3 rounded-xl border px-4 py-3.5 ${t.box}`}>
      <Icon name={t.name} size={18} className={`mt-[3px] ${t.icon}`} />
      <div className="min-w-0 flex-1 text-[14.5px] leading-relaxed text-fg/80 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-2 [&_p]:text-[14.5px]">
        {title && <div className={`mb-1 font-medium ${t.title}`}>{title}</div>}
        {children}
      </div>
    </div>
  )
}

/** Bordered, horizontally scrollable table. */
export function Table({ head, rows }: { head?: React.ReactNode[]; rows: React.ReactNode[][] }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-left text-[14px]">
        {head && head.length > 0 && (
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} className="whitespace-nowrap border-b border-line bg-soft/60 px-4 py-2.5 text-[13px] font-medium text-fg">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="[&:last-child>td]:border-b-0">
              {r.map((c, j) => (
                <td key={j} className={`border-b border-line px-4 py-2.5 align-top leading-relaxed text-fg/80 ${j === 0 ? "min-w-[9rem]" : "min-w-[10rem]"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

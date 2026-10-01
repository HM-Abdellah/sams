import type { ReactNode } from 'react'

interface TableProps {
  caption?: string
  headers: string[]
  children: ReactNode
}

export function Table({ caption, headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <table className="min-w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-[var(--sams-border)] bg-[var(--sams-muted-surface)]/75">
            {headers.map((header) => (
              <th key={header} scope="col" className="whitespace-nowrap px-4 py-3 text-start text-xs font-bold uppercase tracking-[0.045em] text-[var(--sams-muted)]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr]:transition-colors [&_tr:hover]:bg-[var(--sams-muted-surface)]/40">{children}</tbody>
      </table>
    </div>
  )
}

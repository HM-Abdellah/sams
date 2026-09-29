import type { ReactNode } from 'react'

interface TableProps {
  caption?: string
  headers: string[]
  children: ReactNode
}

export function Table({ caption, headers, children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--sams-border)]">
      <table className="min-w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-[var(--sams-border)] bg-[var(--sams-muted-surface)]">
            {headers.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 text-start font-semibold text-[var(--sams-text)]">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

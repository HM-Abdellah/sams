import type { ReactNode } from 'react'
import { cn } from './cn.ts'

interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sams-muted)]">{eyebrow}</p>}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--sams-text)]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-[var(--sams-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

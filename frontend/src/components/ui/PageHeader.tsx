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
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="sams-section-label">{eyebrow}</p>}
        <h1 className="mt-1 text-[clamp(1.5rem,1.18rem+1vw,1.875rem)] font-semibold leading-tight tracking-[-0.025em] text-[var(--sams-text)]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sams-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:max-w-full sm:justify-end">{actions}</div>}
    </header>
  )
}

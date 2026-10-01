import type { ReactNode } from 'react'
import { cn } from './cn.ts'

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--sams-muted-surface)] text-[var(--sams-text)]',
  success: 'bg-[var(--sams-success-surface)] text-[var(--sams-success)]',
  warning: 'bg-[var(--sams-warning-surface)] text-[var(--sams-warning)]',
  danger: 'bg-[var(--sams-danger-surface)] text-[var(--sams-danger)]',
  info: 'bg-[var(--sams-info-surface)] text-[var(--sams-info)]',
}

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  )
}

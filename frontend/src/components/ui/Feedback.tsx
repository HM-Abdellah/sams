import type { ReactNode } from 'react'
import { cn } from './cn.ts'

interface StatusMessageProps {
  title?: string
  children: ReactNode
  variant?: 'info' | 'success' | 'warning' | 'danger'
  role?: 'alert' | 'status'
  className?: string
}

const statusClasses = {
  info: 'border-[var(--sams-info)] bg-[var(--sams-info-surface)] text-[var(--sams-info)]',
  success: 'border-[var(--sams-success)] bg-[var(--sams-success-surface)] text-[var(--sams-success)]',
  warning: 'border-[var(--sams-warning)] bg-[var(--sams-warning-surface)] text-[var(--sams-warning)]',
  danger: 'border-[var(--sams-danger)] bg-[var(--sams-danger-surface)] text-[var(--sams-danger)]',
} as const

export function StatusMessage({
  title,
  children,
  variant = 'info',
  role = variant === 'danger' ? 'alert' : 'status',
  className,
}: StatusMessageProps) {
  return (
    <div role={role} className={cn('rounded-md border p-3 text-sm', statusClasses[variant], className)}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  )
}

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-dashed border-[var(--sams-border)] bg-[var(--sams-surface)] p-8 text-center">
      <h2 className="font-semibold text-[var(--sams-text)]">{title}</h2>
      {description && <p className="mt-2 text-sm text-[var(--sams-muted)]">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </section>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again.',
  action,
}: {
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <StatusMessage title={title} variant="danger">
      <p>{description}</p>
      {action && <div className="mt-3">{action}</div>}
    </StatusMessage>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-[var(--sams-muted-surface)]', className)}
    />
  )
}

import type { ReactNode } from 'react'
import { cn } from './cn.ts'

interface StatusMessageProps {
  title?: string
  children: ReactNode
  variant?: 'info' | 'success' | 'warning' | 'danger'
  role?: 'alert' | 'status'
  action?: ReactNode
  className?: string
}

const statusClasses = {
  info: 'border-[var(--sams-info)]/20 bg-[var(--sams-info-surface)] text-[var(--sams-info)]',
  success: 'border-[var(--sams-success)]/20 bg-[var(--sams-success-surface)] text-[var(--sams-success)]',
  warning: 'border-[var(--sams-warning)]/20 bg-[var(--sams-warning-surface)] text-[var(--sams-warning)]',
  danger: 'border-[var(--sams-danger)]/20 bg-[var(--sams-danger-surface)] text-[var(--sams-danger)]',
} as const

export function StatusMessage({
  title,
  children,
  variant = 'info',
  role = variant === 'danger' ? 'alert' : 'status',
  action,
  className,
}: StatusMessageProps) {
  return (
    <div role={role} className={cn('rounded-xl border p-3.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]', statusClasses[variant], className)}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? 'mt-1.5' : undefined}>{children}</div>
      {action && <div className="mt-3">{action}</div>}
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
    <section className="sams-card border-dashed p-10 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-2xl bg-[var(--sams-action-soft)] text-[var(--sams-action)]" aria-hidden="true">
        <span className="text-lg">+</span>
      </div>
      <h2 className="mt-4 font-semibold text-[var(--sams-text)]">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--sams-muted)]">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
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
      className={cn('animate-pulse rounded-lg bg-[var(--sams-muted-surface)]', className)}
    />
  )
}

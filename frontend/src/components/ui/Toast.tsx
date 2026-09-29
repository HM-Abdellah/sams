import type { ReactNode } from 'react'
import { Button } from './Button.tsx'
import { cn } from './cn.ts'

interface ToastProps {
  open: boolean
  title: string
  children?: ReactNode
  variant?: 'info' | 'success' | 'warning' | 'danger'
  closeLabel?: string
  onClose: () => void
}

const toastClasses = {
  info: 'border-[var(--sams-info)]',
  success: 'border-[var(--sams-success)]',
  warning: 'border-[var(--sams-warning)]',
  danger: 'border-[var(--sams-danger)]',
} as const

export function Toast({
  open,
  title,
  children,
  variant = 'info',
  closeLabel = 'Dismiss',
  onClose,
}: ToastProps) {
  if (!open) return null

  return (
    <aside
      role={variant === 'danger' ? 'alert' : 'status'}
      aria-live={variant === 'danger' ? 'assertive' : 'polite'}
      className={cn('fixed inset-e-4 top-4 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border bg-[var(--sams-surface)] p-4 shadow-lg', toastClasses[variant])}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--sams-text)]">{title}</p>
          {children && <div className="mt-1 text-sm text-[var(--sams-muted)]">{children}</div>}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>{closeLabel}</Button>
      </div>
    </aside>
  )
}

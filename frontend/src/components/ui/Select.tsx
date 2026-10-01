import type { SelectHTMLAttributes } from 'react'
import { cn } from './cn.ts'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export function Select({ className, invalid = false, ...props }: SelectProps) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        'block min-h-11 w-full rounded-lg border bg-[var(--sams-surface)] px-3.5 py-2.5',
        'text-[var(--sams-text)] shadow-sm',
        'focus-visible:outline-none focus-visible:border-[var(--sams-focus)] focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-[var(--sams-danger)]' : 'border-[var(--sams-border)]',
        className,
      )}
    />
  )
}

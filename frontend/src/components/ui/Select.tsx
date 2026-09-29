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
        'block min-h-10 w-full rounded-md border bg-[var(--sams-surface)] px-3 py-2',
        'text-[var(--sams-text)] focus-visible:outline-2 focus-visible:outline-offset-0',
        'focus-visible:outline-[var(--sams-focus)] disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-[var(--sams-danger)]' : 'border-[var(--sams-border)]',
        className,
      )}
    />
  )
}

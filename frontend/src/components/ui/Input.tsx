import type { InputHTMLAttributes } from 'react'
import { cn } from './cn.ts'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export function Input({ className, invalid = false, ...props }: InputProps) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        'block min-h-11 w-full rounded-lg border bg-[var(--sams-surface)] px-3.5 py-2.5',
        'text-[var(--sams-text)] placeholder:text-[var(--sams-muted)] shadow-sm',
        'transition-[border-color,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:border-[var(--sams-focus)] focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--sams-muted-surface)] disabled:opacity-60',
        invalid
          ? 'border-[var(--sams-danger)] ring-4 ring-[var(--sams-danger-surface)]'
          : 'border-[var(--sams-border)]',
        className,
      )}
    />
  )
}

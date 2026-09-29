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
        'block min-h-10 w-full rounded-md border bg-[var(--sams-surface)] px-3 py-2',
        'text-[var(--sams-text)] placeholder:text-[var(--sams-muted)]',
        'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--sams-focus)]',
        'disabled:cursor-not-allowed disabled:bg-[var(--sams-muted-surface)] disabled:opacity-60',
        invalid
          ? 'border-[var(--sams-danger)] ring-1 ring-[var(--sams-danger)]'
          : 'border-[var(--sams-border)]',
        className,
      )}
    />
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './cn.ts'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--sams-action)] text-[var(--sams-action-foreground)] hover:opacity-90',
  secondary: 'border border-[var(--sams-border)] bg-[var(--sams-surface)] text-[var(--sams-text)] hover:bg-[var(--sams-muted-surface)]',
  ghost: 'text-[var(--sams-text)] hover:bg-[var(--sams-muted-surface)]',
  danger: 'bg-[var(--sams-danger)] text-white hover:opacity-90',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-base',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2',
        'focus-visible:outline-[var(--sams-focus)] disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading && <span aria-hidden="true" className="size-4 animate-pulse rounded-full border-2 border-current border-r-transparent" />}
      <span>{children}</span>
    </button>
  )
}

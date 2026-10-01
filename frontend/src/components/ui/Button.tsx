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
  primary: 'bg-[var(--sams-action)] text-[var(--sams-action-foreground)] shadow-sm hover:bg-[var(--sams-action-hover)]',
  secondary: 'border border-[var(--sams-border)] bg-[var(--sams-surface)] text-[var(--sams-text)] shadow-sm hover:border-[var(--sams-action)]/30 hover:bg-[var(--sams-action-soft)]',
  ghost: 'text-[var(--sams-text)] hover:bg-[var(--sams-muted-surface)]',
  danger: 'bg-[var(--sams-danger)] text-white shadow-sm hover:brightness-95',
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
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
        'active:scale-[0.98]',
        'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {loading && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      <span>{children}</span>
    </button>
  )
}

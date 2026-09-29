import type { InputHTMLAttributes } from 'react'
import { Input } from './Input.tsx'

export interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  clearLabel?: string
  onClear?: () => void
}

export function Search({ clearLabel = 'Clear search', onClear, className, ...props }: SearchProps) {
  const canClear = onClear !== undefined && props.value !== undefined && props.value !== ''

  return (
    <div className="relative">
      <Input {...props} type="search" role="searchbox" className={className} />
      {canClear && (
        <button
          type="button"
          aria-label={clearLabel}
          className="absolute inset-e-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-sm text-[var(--sams-muted)] hover:bg-[var(--sams-muted-surface)]"
          onClick={onClear}
        >
          ×
        </button>
      )}
    </div>
  )
}

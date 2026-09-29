import type { ReactNode } from 'react'
import { useId } from 'react'

interface FormFieldProps {
  label: string
  description?: string
  error?: string
  children: (props: {
    id: string
    'aria-describedby'?: string | undefined
    'aria-invalid'?: boolean | undefined
  }) => ReactNode
}

export function FormField({ label, description, error, children }: FormFieldProps) {
  const id = useId()
  const descriptionId = useId()
  const errorId = useId()
  const describedBy = [description ? descriptionId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-[var(--sams-text)]">{label}</label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error !== undefined,
      })}
      {description && <p id={descriptionId} className="text-sm text-[var(--sams-muted)]">{description}</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}
    </div>
  )
}

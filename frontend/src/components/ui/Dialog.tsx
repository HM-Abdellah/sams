import { useId, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { cn } from './cn.ts'

export interface DialogProps {
  open: boolean
  title: string
  description?: string
  children?: ReactNode
  closeLabel?: string
  onClose: () => void
  className?: string
}

export function Dialog({
  open,
  title,
  description,
  children,
  closeLabel = 'Close',
  onClose,
  className,
}: DialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className={cn('w-full max-w-lg rounded-lg border bg-[var(--sams-surface)] p-5 shadow-lg', className)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-semibold text-[var(--sams-text)]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-[var(--sams-muted)]">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" autoFocus onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
        {children && <div className="mt-5">{children}</div>}
      </section>
    </div>
  )
}

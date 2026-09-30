import { useId, useRef, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { cn } from './cn.ts'
import { useModalFocus } from './useModalFocus.ts'

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
  const dialogRef = useRef<HTMLElement>(null)
  const handleKeyDown = useModalFocus({ open, containerRef: dialogRef, onClose })

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
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn('max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border bg-[var(--sams-surface)] p-4 shadow-lg sm:max-h-[calc(100dvh-3rem)] sm:p-5', className)}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-semibold text-[var(--sams-text)]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-[var(--sams-muted)]">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
        {children && <div className="mt-5">{children}</div>}
      </section>
    </div>
  )
}

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button.tsx'
import { cn } from './cn.ts'

interface DrawerProps {
  open: boolean
  title: string
  description?: string
  side?: 'start' | 'end'
  closeLabel?: string
  children?: ReactNode
  onClose: () => void
}

export function Drawer({
  open,
  title,
  description,
  side = 'end',
  closeLabel = 'Close',
  children,
  onClose,
}: DrawerProps) {
  const titleId = useId()
  const descriptionId = useId()
  const drawerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open) drawerRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/40" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        ref={drawerRef}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
        className={cn(
          'absolute inset-y-0 w-full max-w-md bg-[var(--sams-surface)] p-5 shadow-lg',
          side === 'start' ? 'inset-s-0' : 'inset-e-0',
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-semibold text-[var(--sams-text)]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm text-[var(--sams-muted)]">{description}</p>}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>{closeLabel}</Button>
        </div>
        {children && <div className="mt-5">{children}</div>}
      </aside>
    </div>
  )
}

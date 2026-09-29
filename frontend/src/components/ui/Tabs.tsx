import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from './cn.ts'

export interface TabItem {
  id: string
  label: string
  content: ReactNode
}

interface TabsProps {
  items: readonly TabItem[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
}

export function Tabs({ items, defaultValue, value, onChange }: TabsProps) {
  const generatedId = useId()
  const [internalValue, setInternalValue] = useState(defaultValue ?? items[0]?.id ?? '')
  const activeValue = value ?? internalValue
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeValue))
  const setActive = (next: string) => {
    setInternalValue(next)
    onChange?.(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (items.length === 0) return
    const nextIndex = event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (activeIndex + 1) % items.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (activeIndex - 1 + items.length) % items.length
        : -1
    if (nextIndex >= 0) {
      event.preventDefault()
      const nextItem = items[nextIndex]
      if (nextItem === undefined) return
      setActive(nextItem.id)
      document.getElementById(`${generatedId}-tab-${nextItem.id}`)?.focus()
    }
  }

  return (
    <div>
      <div role="tablist" aria-label="Tabs" className="flex gap-1 border-b border-[var(--sams-border)]">
        {items.map((item) => (
          <button
            key={item.id}
            id={`${generatedId}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={item.id === activeValue}
            aria-controls={`${generatedId}-panel-${item.id}`}
            tabIndex={item.id === activeValue ? 0 : -1}
            className={cn(
              'min-h-10 px-3 text-sm font-medium',
              item.id === activeValue
                ? 'border-b-2 border-[var(--sams-action)] text-[var(--sams-text)]'
                : 'text-[var(--sams-muted)]',
            )}
            onClick={() => setActive(item.id)}
            onKeyDown={handleKeyDown}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          id={`${generatedId}-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`${generatedId}-tab-${item.id}`}
          hidden={item.id !== activeValue}
          tabIndex={0}
          className="pt-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  )
}

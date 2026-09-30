import { useEffect, useRef, type KeyboardEvent, type RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true',
  )
}

interface ModalFocusOptions {
  open: boolean
  containerRef: RefObject<HTMLElement | null>
  onClose: () => void
}
export function useModalFocus({ open, containerRef, onClose }: ModalFocusOptions) {
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = containerRef.current
    if (container) {
      const firstFocusable = getFocusable(container)[0]
      ;(firstFocusable ?? container).focus()
    }

    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus()
      previousFocusRef.current = null
    }
  }, [open, containerRef])

  return (event: KeyboardEvent<HTMLElement>) => {
    if (!open) return
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const container = containerRef.current
    if (!container) return

    const focusable = getFocusable(container)
    if (focusable.length === 0) {
      event.preventDefault()
      container.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first || !last) return
    const active = document.activeElement

    if (event.shiftKey) {
      if (active === first || !container.contains(active)) {
        event.preventDefault()
        last.focus()
      }
      return
    }

    if (active === last || !container.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

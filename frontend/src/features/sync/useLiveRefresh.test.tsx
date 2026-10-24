import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { subscribeToDataChanges } from './changeSignal.ts'
import { useLiveRefresh } from './useLiveRefresh.ts'

afterEach(() => {
  vi.useRealTimers()
})

describe('shared live refresh', () => {
  test('refreshes an active view when the window regains focus', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useLiveRefresh(refresh, { intervalMs: 60_000 }))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
    })

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  test('polls while visible and skips background work while hidden', async () => {
    vi.useFakeTimers()
    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState')
    const refresh = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })

    try {
      renderHook(() => useLiveRefresh(refresh, { intervalMs: 5_000 }))

      await act(async () => { await vi.advanceTimersByTimeAsync(5_000) })
      expect(refresh).toHaveBeenCalledTimes(1)

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(refresh).toHaveBeenCalledTimes(1)

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
        await Promise.resolve()
      })
      expect(refresh).toHaveBeenCalledTimes(2)
    } finally {
      if (visibilityDescriptor) Object.defineProperty(document, 'visibilityState', visibilityDescriptor)
    }
  })

  test('notifies subscribers when another tab reports a data change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToDataChanges(listener)
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'sams:data-change',
        newValue: JSON.stringify({ type: 'data-changed', nonce: 'test-1' }),
      }))
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
    }
  })
})

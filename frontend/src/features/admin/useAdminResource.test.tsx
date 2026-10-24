import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useAdminResource } from './useAdminResource.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useAdminResource', () => {
  test('ignores an older response when a newer loader finishes first', async () => {
    const oldRequest = deferred<string>()
    const newRequest = deferred<string>()
    const oldLoader = vi.fn(() => oldRequest.promise)
    const newLoader = vi.fn(() => newRequest.promise)

    const { result, rerender } = renderHook(
      ({ loader }: { loader: () => Promise<string> }) => useAdminResource(loader),
      { initialProps: { loader: oldLoader } },
    )

    rerender({ loader: newLoader })

    await act(async () => {
      newRequest.resolve('new result')
      await newRequest.promise
    })
    await waitFor(() => expect(result.current.data).toBe('new result'))

    await act(async () => {
      oldRequest.resolve('stale result')
      await oldRequest.promise
    })

    expect(result.current.status).toBe('success')
    expect(result.current.data).toBe('new result')
  })
})

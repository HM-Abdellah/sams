import { describe, expect, test, vi } from 'vitest'
import { onAttendancePendingWork, publishAttendancePendingWork } from './pendingWork.ts'

describe('attendance pending-work event', () => {
  test('publishes the current busy state', () => {
    const listener = vi.fn()
    const unsubscribe = onAttendancePendingWork(listener)
    publishAttendancePendingWork(true)
    publishAttendancePendingWork(false)
    unsubscribe()
    publishAttendancePendingWork(true)
    expect(listener).toHaveBeenNthCalledWith(1, true)
    expect(listener).toHaveBeenNthCalledWith(2, false)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  test('unsubscribe removes only its own listener', () => {
    const first = vi.fn()
    const second = vi.fn()
    const stopFirst = onAttendancePendingWork(first)
    onAttendancePendingWork(second)
    stopFirst()
    publishAttendancePendingWork(true)
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledWith(true)
  })
})

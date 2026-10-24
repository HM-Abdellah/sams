import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { reportsApi, type MonthlyReportData } from './api.ts'
import { useMonthlyReport } from './useMonthlyReport.ts'

vi.mock('./api.ts', () => ({ reportsApi: { monthly: vi.fn() } }))

const api = vi.mocked(reportsApi)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function report(classId: number, month: string): MonthlyReportData {
  return {
    class: { id: classId },
    month,
    start: `${month}-01`,
    end: `${month}-28`,
    summary: {
      present_count: 1,
      absent_count: 0,
      late_count: 0,
      excused_count: 0,
      recorded_count: 1,
      presence_rate: 100,
    },
    students: [],
  }
}

describe('useMonthlyReport request race handling', () => {
  beforeEach(() => vi.resetAllMocks())

  test('does not display or restore an older class report after the query changes', async () => {
    const oldRequest = deferred<MonthlyReportData>()
    const newRequest = deferred<MonthlyReportData>()
    api.monthly.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)

    const { result, rerender } = renderHook(
      ({ classId, month }) => useMonthlyReport(classId, month),
      { initialProps: { classId: 1, month: '2026-09' } },
    )
    await waitFor(() => expect(api.monthly).toHaveBeenCalledWith(1, '2026-09', expect.any(AbortSignal)))

    rerender({ classId: 2, month: '2026-09' })
    expect(result.current.status).toBe('loading')
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(api.monthly).toHaveBeenCalledTimes(2))

    await act(async () => { newRequest.resolve(report(2, '2026-09')) })
    await waitFor(() => expect(result.current.data?.class.id).toBe(2))
    await act(async () => { oldRequest.resolve(report(1, '2026-09')) })

    expect(result.current.data?.class.id).toBe(2)
    expect(result.current.status).toBe('success')
  })

  test('a newer manual reload wins when requests finish out of order', async () => {
    const oldRequest = deferred<MonthlyReportData>()
    const newRequest = deferred<MonthlyReportData>()
    api.monthly.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)

    const { result } = renderHook(() => useMonthlyReport(7, '2026-10'))
    await waitFor(() => expect(api.monthly).toHaveBeenCalledTimes(1))

    let reloadPromise!: Promise<void>
    act(() => { reloadPromise = result.current.reload() })
    await waitFor(() => expect(api.monthly).toHaveBeenCalledTimes(2))

    await act(async () => { newRequest.resolve(report(7, '2026-10')) })
    await waitFor(() => expect(result.current.data?.month).toBe('2026-10'))
    await act(async () => { oldRequest.resolve(report(7, '2026-09')) })
    await reloadPromise

    expect(result.current.data?.month).toBe('2026-10')
  })
})

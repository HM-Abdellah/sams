import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useAttendanceRegister } from './useAttendanceRegister.ts'
import { attendanceApi } from './api.ts'

vi.mock('./api.ts', () => ({
  attendanceApi: {
    weeklyRegister: vi.fn(),
    saveBulk: vi.fn(),
  },
}))

const api = vi.mocked(attendanceApi)

const register = (status: 'present' | 'absent' | 'late' | 'excused' | undefined = undefined) => ({
  class_id: 1,
  week_start: '2026-09-28',
  week_end: '2026-10-04',
  students: [{ id: 101, first_name: 'Ada', last_name: 'Lovelace' }],
  attendance: status === undefined ? [] : [{
    id: 1,
    enrollment_id: 7,
    student_id: 101,
    attendance_date: '2026-09-28',
    period: 1,
    status,
  }],
  period_signoffs: [],
})

const signedRegister = {
  ...register('present'),
  period_signoffs: [{
    id: 1,
    class_id: 1,
    teacher_id: 10,
    teacher_name: 'E2E Teacher',
    employee_id: 'T010',
    attendance_date: '2026-09-28',
    period: 1,
    status: 'signed' as const,
    signed_at: '2026-09-28T09:00:00Z',
    invalidated_at: null,
  }],
}

describe('useAttendanceRegister integration', () => {
  beforeEach(() => {
    api.weeklyRegister.mockReset()
    api.saveBulk.mockReset()
  })

  test('loads server state and blocks edits to signed lessons', async () => {
    api.weeklyRegister.mockResolvedValue(signedRegister)
    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('present')
    expect(result.current.isSigned('2026-09-28', 1)).toBe(true)

    act(() => result.current.changeStatus(101, '2026-09-28', 1, 'absent'))
    expect(result.current.isDirty).toBe(false)
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('present')
  })
  test('persists an optimistic status and clears the draft after server confirmation', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register())
    api.weeklyRegister.mockResolvedValueOnce(register('absent'))
    api.saveBulk.mockResolvedValue({ changed: 1, unchanged: 0, total: 1 })
    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.changeStatus(101, '2026-09-28', 1, 'absent'))
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('absent')
    expect(result.current.isDirty).toBe(true)

    await act(async () => {
      await result.current.flush()
    })

    expect(api.saveBulk).toHaveBeenCalledWith(1, [{
      student_id: 101,
      attendance_date: '2026-09-28',
      period: 1,
      action: 'upsert',
      status: 'absent',
    }])
    expect(result.current.isDirty).toBe(false)
    expect(result.current.mutationState).toBe('saved')
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('absent')
  })
  test('preserves failed work and retry reconciles it with the server', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register())
    api.weeklyRegister.mockResolvedValueOnce(register('late'))
    api.saveBulk.mockRejectedValueOnce(new Error('Temporary failure'))
    api.saveBulk.mockResolvedValueOnce({ changed: 1, unchanged: 0, total: 1 })
    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.changeStatus(101, '2026-09-28', 1, 'late'))

    await act(async () => {
      await expect(result.current.flush()).resolves.toBe(false)
    })
    expect(result.current.mutationState).toBe('failed')
    expect(result.current.isDirty).toBe(true)
    expect(result.current.mutationError).toBe('Temporary failure')

    await act(async () => {
      await expect(result.current.retry()).resolves.toBe(true)
    })
    expect(result.current.mutationState).toBe('saved')
    expect(result.current.isDirty).toBe(false)
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('late')
    expect(api.saveBulk).toHaveBeenCalledTimes(2)
  })
  test('collapses rapid changes for one cell to the latest server mutation', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register())
    api.weeklyRegister.mockResolvedValueOnce(register('late'))
    api.saveBulk.mockResolvedValue({ changed: 1, unchanged: 0, total: 1 })
    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => {
      result.current.changeStatus(101, '2026-09-28', 1, 'absent')
      result.current.changeStatus(101, '2026-09-28', 1, 'late')
    })

    await act(async () => {
      await result.current.flush()
    })

    expect(api.saveBulk).toHaveBeenCalledTimes(1)
    expect(api.saveBulk.mock.calls[0]?.[1]).toEqual([{
      student_id: 101,
      attendance_date: '2026-09-28',
      period: 1,
      action: 'upsert',
      status: 'late',
    }])
  })
})

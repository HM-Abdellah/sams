[Reading 232 lines from start (total: 232 lines, 0 remaining)]

import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useAttendanceRegister } from './useAttendanceRegister.ts'
import { attendanceApi } from './api.ts'
import { ApiError } from '../../services/api/errors.ts'

vi.mock('./api.ts', () => ({
  attendanceApi: {
    weeklyRegister: vi.fn(),
    saveBulk: vi.fn(),
  },
}))

const api = vi.mocked(attendanceApi)

const register = (
  status: 'present' | 'absent' | 'late' | 'excused' | undefined = undefined,
  revision = 0,
) => ({
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
  attendance_revisions: revision === 0 ? [] : [{
    attendance_date: '2026-09-28',
    period: 1,
    revision,
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
    api.saveBulk.mockResolvedValue({ changed: 1, unchanged: 0, total: 1, revisions: [] })
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
      expected_revision: 0,
    }])
    expect(result.current.isDirty).toBe(false)
    expect(result.current.mutationState).toBe('saved')
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('absent')
  })
  test('preserves failed work and retry reconciles it with the server', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register())
    api.weeklyRegister.mockResolvedValueOnce(register('late'))
    api.saveBulk.mockRejectedValueOnce(new Error('Temporary failure'))
    api.saveBulk.mockResolvedValueOnce({ changed: 1, unchanged: 0, total: 1, revisions: [] })
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
  test('detects stale writes, loads the latest register, and preserves explicit keep or discard choices', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register('present', 5))
    api.weeklyRegister.mockResolvedValueOnce(register('late', 6))
    api.weeklyRegister.mockResolvedValueOnce(register('absent', 7))
    api.saveBulk
      .mockRejectedValueOnce(new ApiError(409, 'Attendance was updated by another teacher.', 'ATTENDANCE_CONCURRENCY_CONFLICT'))
      .mockResolvedValueOnce({ changed: 1, unchanged: 0, total: 1, revisions: [] })

    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.changeStatus(101, '2026-09-28', 1, 'absent'))

    await act(async () => {
      await expect(result.current.flush()).resolves.toBe(false)
    })

    expect(result.current.mutationState).toBe('conflict')
    expect(result.current.hasConflict).toBe(true)
    expect(result.current.isDirty).toBe(true)
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('late')

    await act(async () => {
      await expect(result.current.keepChanges()).resolves.toBe(true)
    })

    expect(api.saveBulk).toHaveBeenLastCalledWith(1, [{
      student_id: 101,
      attendance_date: '2026-09-28',
      period: 1,
      action: 'upsert',
      status: 'absent',
      expected_revision: 6,
    }])
    expect(result.current.hasConflict).toBe(false)
    expect(result.current.isDirty).toBe(false)
    expect(result.current.mutationState).toBe('saved')
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('absent')
  })

  test('does not treat unrelated HTTP 409 responses as concurrency conflicts', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register(undefined, 1))
    api.saveBulk.mockRejectedValueOnce(new ApiError(409, 'This lesson is signed. Reopen it before correcting attendance.'))

    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.changeStatus(101, '2026-09-28', 1, 'absent'))

    await act(async () => {
      await expect(result.current.flush()).resolves.toBe(false)
    })

    expect(result.current.mutationState).toBe('failed')
    expect(result.current.hasConflict).toBe(false)
    expect(result.current.isDirty).toBe(true)
  })

  test('can explicitly adopt the latest server version after a conflict', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register('present', 2))
    api.weeklyRegister.mockResolvedValueOnce(register('late', 3))
    api.saveBulk.mockRejectedValueOnce(new ApiError(409, 'Conflict.', 'ATTENDANCE_CONCURRENCY_CONFLICT'))

    const { result } = renderHook(() => useAttendanceRegister(1, '2026-09-28'))

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.changeStatus(101, '2026-09-28', 1, 'absent'))

    await act(async () => {
      await result.current.flush()
    })

    expect(result.current.mutationState).toBe('conflict')
    expect(result.current.isDirty).toBe(true)
    expect(result.current.useLatest()).toBe(true)
    await waitFor(() => expect(result.current.isDirty).toBe(false))
    expect(result.current.hasConflict).toBe(false)
    expect(result.current.getStatus(101, '2026-09-28', 1)).toBe('late')
  })

  test('collapses rapid changes for one cell to the latest server mutation', async () => {
    api.weeklyRegister.mockResolvedValueOnce(register())
    api.weeklyRegister.mockResolvedValueOnce(register('late'))
    api.saveBulk.mockResolvedValue({ changed: 1, unchanged: 0, total: 1, revisions: [] })
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
      expected_revision: 0,
    }])
  })
})

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]
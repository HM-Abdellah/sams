import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useClassStudents } from './useClassStudents.ts'
import { studentsApi } from './api.ts'
import type { ClassStudentsData } from './types.ts'

vi.mock('./api.ts', () => ({
  studentsApi: {
    forClass: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    transfer: vi.fn(),
  },
}))

const api = vi.mocked(studentsApi)

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const student = (id: number, firstName: string): ClassStudentsData => ({
  students: [{
    id,
    student_number: String(id),
    massar_code: null,
    birth_date: null,
    first_name: firstName,
    last_name: 'Test',
    status: 'active',
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  }],
})

describe('useClassStudents request race handling', () => {
  beforeEach(() => vi.resetAllMocks())

  test('clears the previous class roster and ignores a late reload after class changes', async () => {
    const staleClassOneReload = deferred<ClassStudentsData>()
    const classTwoLoad = deferred<ClassStudentsData>()
    api.forClass
      .mockResolvedValueOnce(student(101, 'Class One'))
      .mockReturnValueOnce(staleClassOneReload.promise)
      .mockReturnValueOnce(classTwoLoad.promise)

    const { result, rerender } = renderHook(
      ({ classId }) => useClassStudents(classId),
      { initialProps: { classId: 1 } },
    )
    await waitFor(() => expect(result.current.students[0]?.id).toBe(101))

    let staleReloadPromise!: Promise<boolean>
    act(() => { staleReloadPromise = result.current.reload() })
    await waitFor(() => expect(api.forClass).toHaveBeenCalledTimes(2))

    rerender({ classId: 2 })
    expect(result.current.status).toBe('loading')
    expect(result.current.students).toEqual([])
    await waitFor(() => expect(api.forClass).toHaveBeenCalledTimes(3))

    await act(async () => { classTwoLoad.resolve(student(202, 'Class Two')) })
    await waitFor(() => expect(result.current.students[0]?.id).toBe(202))

    await act(async () => { staleClassOneReload.resolve(student(101, 'Stale Class One')) })
    await expect(staleReloadPromise).resolves.toBe(false)
    expect(result.current.students).toEqual(student(202, 'Class Two').students)
  })

  test('ignores stale reload responses even when the underlying request resolves after abort', async () => {
    const oldRequest = deferred<ClassStudentsData>()
    const newRequest = deferred<ClassStudentsData>()
    api.forClass.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise)

    const { result } = renderHook(() => useClassStudents(7))
    await waitFor(() => expect(api.forClass).toHaveBeenCalledTimes(1))

    let reloadPromise!: Promise<boolean>
    await act(async () => { reloadPromise = result.current.reload() })
    await waitFor(() => expect(api.forClass).toHaveBeenCalledTimes(2))

    await act(async () => { newRequest.resolve(student(707, 'Latest')) })
    await waitFor(() => expect(result.current.students[0]?.id).toBe(707))
    await act(async () => { oldRequest.resolve(student(700, 'Stale')) })

    expect(await reloadPromise).toBe(true)
    expect(result.current.students[0]?.id).toBe(707)
  })
})

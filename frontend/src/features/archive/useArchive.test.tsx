import { act, renderHook, waitFor } from '@testing-library/react'
import { useMemo } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { archiveApi } from './api.ts'
import type { ArchiveData } from './types.ts'
import { useArchive } from './useArchive.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function archiveResult(classId: number): ArchiveData {
  return {
    view: 'days',
    class: {
      id: classId,
      name: 'Test class ' + classId,
      level: '2BAC',
      branch: 'SP',
      academic_year_id: 1,
      is_active: 1,
      academic_year_name: '2027/2028',
      academic_year_active: 1,
      student_count: 1,
      teacher_count: 1,
      academic_year_starts_on: '2027-09-01',
      academic_year_ends_on: '2028-07-31',
    },
    month: '2027-10',
    start: '2027-10-01',
    end: '2027-10-31',
    days: [],
  }
}

describe('useArchive', () => {
  test('does not show a stale archive response after the selected class changes', async () => {
    const oldRequest = deferred<ArchiveData>()
    const newRequest = deferred<ArchiveData>()
    const read = vi.spyOn(archiveApi, 'read')
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise)

    const { result, rerender } = renderHook(
      ({ classId }: { classId: number }) => useArchive(useMemo(() => ({ view: 'days' as const, classId, month: '2027-10' }), [classId])),
      { initialProps: { classId: 1 } },
    )

    rerender({ classId: 2 })

    await act(async () => {
      newRequest.resolve(archiveResult(2))
      await newRequest.promise
    })
    await waitFor(() => expect(result.current.data?.class.id).toBe(2))

    await act(async () => {
      oldRequest.resolve(archiveResult(1))
      await oldRequest.promise
    })

    expect(result.current.status).toBe('success')
    expect(result.current.data?.class.id).toBe(2)
    read.mockRestore()
  })
})

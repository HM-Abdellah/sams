import { useCallback, useEffect, useState } from 'react'
import type { AsyncStatus, BasicMutationStatus } from '../../types/ui-state.ts'
import { studentsApi } from './api.ts'
import type { Student, StudentMutationInput } from './types.ts'

interface ClassStudentsState {
  status: AsyncStatus
  students: Student[]
  error: string | null
  mutationStatus: BasicMutationStatus
  mutationError: string | null
}

export function useClassStudents(classId: number | null) {
  const [state, setState] = useState<ClassStudentsState>({
    status: 'idle',
    students: [],
    error: null,
    mutationStatus: 'idle',
    mutationError: null,
  })

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    if (classId === null) {
      setState({ status: 'idle', students: [], error: null, mutationStatus: 'idle', mutationError: null })
      return false
    }

    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const result = await studentsApi.forClass(classId, signal)
      setState((current) => ({ ...current, status: 'success', students: result.students, error: null }))
      return true
    } catch (cause) {
      if (signal?.aborted) return false
      setState((current) => ({
        ...current,
        status: 'error',
        students: current.students,
        error: cause instanceof Error ? cause.message : 'Unable to load students.',
      }))
      return false
    }
  }, [classId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const createStudent = useCallback(async (input: StudentMutationInput) => {
    if (classId === null) return false
    setState((current) => ({ ...current, mutationStatus: 'saving', mutationError: null }))
    try {
      await studentsApi.create(classId, input)
      const refreshed = await load()
      if (!refreshed) {
        setState((current) => ({ ...current, mutationStatus: 'error', mutationError: 'Student was saved, but the updated roster could not be confirmed.' }))
        return false
      }
      setState((current) => ({ ...current, mutationStatus: 'success', mutationError: null }))
      return true
    } catch (cause) {
      setState((current) => ({
        ...current,
        mutationStatus: 'error',
        mutationError: cause instanceof Error ? cause.message : 'Unable to save student.',
      }))
      return false
    }
  }, [classId, load])

  const updateStudent = useCallback(async (studentId: number, input: StudentMutationInput) => {
    if (classId === null) return false
    setState((current) => ({ ...current, mutationStatus: 'saving', mutationError: null }))
    try {
      await studentsApi.update(classId, studentId, input)
      const refreshed = await load()
      if (!refreshed) {
        setState((current) => ({ ...current, mutationStatus: 'error', mutationError: 'Student was updated, but the refreshed roster could not be confirmed.' }))
        return false
      }
      setState((current) => ({ ...current, mutationStatus: 'success', mutationError: null }))
      return true
    } catch (cause) {
      setState((current) => ({
        ...current,
        mutationStatus: 'error',
        mutationError: cause instanceof Error ? cause.message : 'Unable to save student.',
      }))
      return false
    }
  }, [classId, load])

  return {
    ...state,
    reload: () => load(),
    createStudent,
    updateStudent,
  }
}

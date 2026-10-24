import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncStatus, BasicMutationStatus } from '../../types/ui-state.ts'
import { studentsApi } from './api.ts'
import type { Student, StudentMutationInput } from './types.ts'
import { useLiveRefresh } from '../sync/useLiveRefresh.ts'

interface ClassStudentsState {
  resourceClassId: number | null
  status: AsyncStatus
  students: Student[]
  error: string | null
  mutationStatus: BasicMutationStatus
  mutationError: string | null
}

export function useClassStudents(classId: number | null) {
  const [state, setState] = useState<ClassStudentsState>({
    resourceClassId: null,
    status: 'idle',
    students: [],
    error: null,
    mutationStatus: 'idle',
    mutationError: null,
  })
  const currentClassIdRef = useRef(classId)
  const loadRequestIdRef = useRef(0)

  useEffect(() => {
    currentClassIdRef.current = classId
  }, [classId])

  const load = useCallback(async (signal?: AbortSignal, silent = false): Promise<boolean> => {
    const requestId = ++loadRequestIdRef.current
    if (classId === null) {
      setState({ resourceClassId: null, status: 'idle', students: [], error: null, mutationStatus: 'idle', mutationError: null })
      return false
    }

    if (!silent) {
      setState((current) => ({
        ...current,
        resourceClassId: classId,
        status: 'loading',
        students: current.resourceClassId === classId ? current.students : [],
        error: null,
        mutationStatus: current.resourceClassId === classId ? current.mutationStatus : 'idle',
        mutationError: current.resourceClassId === classId ? current.mutationError : null,
      }))
    }
    try {
      const result = await studentsApi.forClass(classId, signal)
      if (
        signal?.aborted
        || requestId !== loadRequestIdRef.current
        || currentClassIdRef.current !== classId
      ) return false
      setState((current) => ({
        ...current,
        resourceClassId: classId,
        status: 'success',
        students: result.students,
        error: null,
      }))
      return true
    } catch (cause) {
      if (
        signal?.aborted
        || requestId !== loadRequestIdRef.current
        || currentClassIdRef.current !== classId
      ) return false
      setState((current) => {
        if (silent && current.resourceClassId === classId && current.status === 'success') {
          return { ...current, error: cause instanceof Error ? cause.message : 'Unable to refresh students.' }
        }
        return {
          ...current,
          resourceClassId: classId,
          status: 'error',
          students: current.resourceClassId === classId ? current.students : [],
          error: cause instanceof Error ? cause.message : 'Unable to load students.',
        }
      })
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
      if (currentClassIdRef.current !== classId) return false
      const refreshed = await load()
      if (currentClassIdRef.current !== classId) return false
      if (!refreshed) {
        setState((current) => ({ ...current, mutationStatus: 'error', mutationError: 'Student was saved, but the updated roster could not be confirmed.' }))
        return false
      }
      setState((current) => ({ ...current, mutationStatus: 'success', mutationError: null }))
      return true
    } catch (cause) {
      if (currentClassIdRef.current !== classId) return false
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
      if (currentClassIdRef.current !== classId) return false
      const refreshed = await load()
      if (currentClassIdRef.current !== classId) return false
      if (!refreshed) {
        setState((current) => ({ ...current, mutationStatus: 'error', mutationError: 'Student was updated, but the refreshed roster could not be confirmed.' }))
        return false
      }
      setState((current) => ({ ...current, mutationStatus: 'success', mutationError: null }))
      return true
    } catch (cause) {
      if (currentClassIdRef.current !== classId) return false
      setState((current) => ({
        ...current,
        mutationStatus: 'error',
        mutationError: cause instanceof Error ? cause.message : 'Unable to save student.',
      }))
      return false
    }
  }, [classId, load])

  const refreshQuietly = useCallback(() => {
    if (classId === null || state.mutationStatus === 'saving') return Promise.resolve(false)
    return load(undefined, true)
  }, [classId, load, state.mutationStatus])
  useLiveRefresh(refreshQuietly, { enabled: classId !== null && state.status === 'success' })

  const isCurrentResource = state.resourceClassId === classId
  return {
    ...state,
    status: isCurrentResource ? state.status : (classId === null ? 'idle' : 'loading'),
    students: isCurrentResource ? state.students : [],
    error: isCurrentResource ? state.error : null,
    mutationStatus: isCurrentResource ? state.mutationStatus : 'idle',
    mutationError: isCurrentResource ? state.mutationError : null,
    reload: () => load(),
    createStudent,
    updateStudent,
  }
}

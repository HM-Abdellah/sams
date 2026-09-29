import { useCallback, useEffect, useState } from 'react'
import { studentsApi } from './api.ts'
import type { Student } from './types.ts'

interface ClassStudentsState {
  status: 'idle' | 'loading' | 'success' | 'error'
  students: Student[]
  error: string | null
}

export function useClassStudents(classId: number | null) {
  const [state, setState] = useState<ClassStudentsState>({
    status: 'idle',
    students: [],
    error: null,
  })

  const load = useCallback(async (signal?: AbortSignal) => {
    if (classId === null) {
      setState({ status: 'idle', students: [], error: null })
      return
    }

    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const result = await studentsApi.forClass(classId, signal)
      setState({ status: 'success', students: result.students, error: null })
    } catch (cause) {
      if (signal?.aborted) return
      setState({
        status: 'error',
        students: [],
        error: cause instanceof Error ? cause.message : 'Unable to load students.',
      })
    }
  }, [classId])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

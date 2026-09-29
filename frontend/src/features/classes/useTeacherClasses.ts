import { useCallback, useEffect, useState } from 'react'
import { classesApi } from './api.ts'
import type { TeacherClass } from './types.ts'

interface TeacherClassesState {
  status: 'idle' | 'loading' | 'success' | 'error'
  classes: TeacherClass[]
  error: string | null
}

export function useTeacherClasses() {
  const [state, setState] = useState<TeacherClassesState>({
    status: 'idle',
    classes: [],
    error: null,
  })

  const load = useCallback(async (signal?: AbortSignal) => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const result = await classesApi.forCurrentUser(signal)
      setState({ status: 'success', classes: result.classes, error: null })
    } catch (cause) {
      if (signal?.aborted) return
      setState({
        status: 'error',
        classes: [],
        error: cause instanceof Error ? cause.message : 'Unable to load classes.',
      })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

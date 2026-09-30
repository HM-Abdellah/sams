import { useCallback, useEffect, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'
import { classesApi } from './api.ts'
import type { TeacherClass } from './types.ts'

interface TeacherClassesState extends AsyncResourceState<TeacherClass[]> {
  classes: TeacherClass[]
}

export function useTeacherClasses() {
  const [state, setState] = useState<TeacherClassesState>({
    status: 'idle',
    data: null,
    classes: [],
    error: null,
  })

  const load = useCallback(async (signal?: AbortSignal) => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const result = await classesApi.forCurrentUser(signal)
      setState({ status: 'success', data: result.classes, classes: result.classes, error: null })
    } catch (cause) {
      if (signal?.aborted) return
      setState((current) => ({
        status: 'error',
        data: current.data,
        classes: current.classes,
        error: cause instanceof Error ? cause.message : 'Unable to load classes.',
      }))
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

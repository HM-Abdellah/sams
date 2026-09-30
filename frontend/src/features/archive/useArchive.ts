import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'
import { archiveApi } from './api.ts'
import type { ArchiveData } from './types.ts'

export function useArchive(params: Parameters<typeof archiveApi.read>[0] | null) {
  const [state, setState] = useState<AsyncResourceState<ArchiveData>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const queryKeyRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    if (params === null) {
      queryKeyRef.current = null
      setState({ status: 'idle', data: null, error: null })
      return
    }

    const queryKey = JSON.stringify(params)
    const queryChanged = queryKeyRef.current !== queryKey
    queryKeyRef.current = queryKey
    setState((current) => queryChanged
      ? { status: 'loading', data: null, error: null }
      : { ...current, status: 'loading', error: null })
    try {
      setState({ status: 'success', data: await archiveApi.read(params), error: null })
    } catch (cause) {
      setState((current) => ({
        status: 'error',
        data: current.data,
        error: cause instanceof Error ? cause.message : 'Unable to load archive.',
      }))
    }
  }, [params])

  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'
import { archiveApi } from './api.ts'
import type { ArchiveData } from './types.ts'
import { useLiveRefresh } from '../sync/useLiveRefresh.ts'

export function useArchive(params: Parameters<typeof archiveApi.read>[0] | null) {
  const [state, setState] = useState<AsyncResourceState<ArchiveData>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const queryKeyRef = useRef<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async (silent = false) => {
    const currentRequestId = ++requestId.current
    if (params === null) {
      queryKeyRef.current = null
      setState({ status: 'idle', data: null, error: null })
      return
    }

    const queryKey = JSON.stringify(params)
    const queryChanged = queryKeyRef.current !== queryKey
    queryKeyRef.current = queryKey
    if (!silent) {
      setState((current) => queryChanged
        ? { status: 'loading', data: null, error: null }
        : { ...current, status: 'loading', error: null })
    }
    try {
      const data = await archiveApi.read(params)
      if (currentRequestId !== requestId.current) return
      setState({ status: 'success', data, error: null })
    } catch (cause) {
      if (currentRequestId !== requestId.current) return
      setState((current) => {
        if (silent && current.data !== null && current.status === 'success') {
          return { ...current, error: cause instanceof Error ? cause.message : 'Unable to refresh archive.' }
        }
        return {
          status: 'error',
          data: current.data,
          error: cause instanceof Error ? cause.message : 'Unable to load archive.',
        }
      })
    }
  }, [params])

  useEffect(() => {
    void load()
    return () => {
      requestId.current += 1
    }
  }, [load])

  const refreshQuietly = useCallback(() => load(true), [load])
  useLiveRefresh(refreshQuietly, { enabled: state.status === 'success' && state.data !== null })

  return { ...state, reload: load }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'
import { useLiveRefresh } from '../sync/useLiveRefresh.ts'

type ResourceState<T> = AsyncResourceState<T>

export function useAdminResource<T>(
  loader: () => Promise<T>,
) {
  const [state, setState] = useState<ResourceState<T>>({
    status: 'idle',
    data: null,
    error: null,
  })
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current
    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const data = await loader()
      if (currentRequestId !== requestId.current) return
      setState({ status: 'success', data, error: null })
    } catch (cause) {
      if (currentRequestId !== requestId.current) return
      setState((current) => ({
        status: 'error',
        data: current.data,
        error: cause instanceof Error ? cause.message : 'Unable to load administrative data.',
      }))
    }
  }, [loader])
  const refreshQuietly = useCallback(async () => {
    const currentRequestId = ++requestId.current
    try {
      const data = await loader()
      if (currentRequestId !== requestId.current) return
      setState({ status: 'success', data, error: null })
    } catch (cause) {
      if (currentRequestId !== requestId.current) return
      setState((current) => ({
        ...current,
        status: current.data === null ? 'error' : current.status,
        error: cause instanceof Error ? cause.message : 'Unable to refresh administrative data.',
      }))
    }
  }, [loader])

  useEffect(() => {
    void load()
    return () => {
      requestId.current += 1
    }
  }, [load])

  useLiveRefresh(refreshQuietly, { enabled: state.status === 'success' && state.data !== null })

  return { ...state, reload: load }
}

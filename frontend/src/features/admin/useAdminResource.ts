import { useCallback, useEffect, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'

type ResourceState<T> = AsyncResourceState<T>

export function useAdminResource<T>(
  loader: () => Promise<T>,
) {
  const [state, setState] = useState<ResourceState<T>>({
    status: 'idle',
    data: null,
    error: null,
  })

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', error: null }))
    try {
      const data = await loader()
      setState({ status: 'success', data, error: null })
    } catch (cause) {
      setState((current) => ({
        status: 'error',
        data: current.data,
        error: cause instanceof Error ? cause.message : 'Unable to load administrative data.',
      }))
    }
  }, [loader])
  useEffect(() => {
    void load()
  }, [load])

  return { ...state, reload: load }
}

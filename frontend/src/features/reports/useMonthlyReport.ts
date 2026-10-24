import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'
import { reportsApi, type MonthlyReportData } from './api.ts'
import { useLiveRefresh } from '../sync/useLiveRefresh.ts'

interface MonthlyReportState extends AsyncResourceState<MonthlyReportData> {
  queryKey: string | null
}

export function useMonthlyReport(classId: number | null, month: string | null) {
  const [state, setState] = useState<MonthlyReportState>({
    queryKey: null,
    status: 'idle',
    data: null,
    error: null,
  })
  const queryKeyRef = useRef<string | null>(null)
  const requestIdRef = useRef(0)

  const load = useCallback(async (signal?: AbortSignal, silent = false) => {
    const requestId = ++requestIdRef.current
    if (classId === null || month === null) {
      queryKeyRef.current = null
      setState({ queryKey: null, status: 'idle', data: null, error: null })
      return
    }

    const queryKey = String(classId) + '|' + month
    const queryChanged = queryKeyRef.current !== queryKey
    queryKeyRef.current = queryKey
    if (!silent) {
      setState((current) => queryChanged
        ? { queryKey, status: 'loading', data: null, error: null }
        : { ...current, queryKey, status: 'loading', error: null })
    }
    try {
      const data = await reportsApi.monthly(classId, month, signal)
      if (
        signal?.aborted
        || requestId !== requestIdRef.current
        || queryKeyRef.current !== queryKey
      ) return
      setState({ queryKey, status: 'success', data, error: null })
    } catch (cause) {
      if (
        signal?.aborted
        || requestId !== requestIdRef.current
        || queryKeyRef.current !== queryKey
      ) return
      setState((current) => {
        if (silent && current.queryKey === queryKey && current.status === 'success') {
          return { ...current, error: cause instanceof Error ? cause.message : 'Unable to refresh report.' }
        }
        return {
          queryKey,
          status: 'error',
          data: current.queryKey === queryKey ? current.data : null,
          error: cause instanceof Error ? cause.message : 'Unable to load report.',
        }
      })
    }
  }, [classId, month])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const activeQueryKey = classId === null || month === null
    ? null
    : String(classId) + '|' + month
  const isCurrentQuery = state.queryKey === activeQueryKey
  const refreshQuietly = useCallback(() => load(undefined, true), [load])
  useLiveRefresh(refreshQuietly, { enabled: isCurrentQuery && state.status === 'success' && state.data !== null })

  return {
    ...state,
    status: isCurrentQuery ? state.status : (activeQueryKey === null ? 'idle' : 'loading'),
    data: isCurrentQuery ? state.data : null,
    error: isCurrentQuery ? state.error : null,
    reload: () => load(),
  }
}

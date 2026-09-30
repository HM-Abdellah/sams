import { useCallback, useEffect, useRef, useState } from 'react'
import type { AsyncResourceState } from '../../types/ui-state.ts'
import { reportsApi, type MonthlyReportData } from './api.ts'

type MonthlyReportState = AsyncResourceState<MonthlyReportData>

export function useMonthlyReport(classId: number | null, month: string | null) {
  const [state, setState] = useState<MonthlyReportState>({
    status: 'idle',
    data: null,
    error: null,
  })
  const queryKeyRef = useRef<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    if (classId === null || month === null) {
      queryKeyRef.current = null
      setState({ status: 'idle', data: null, error: null })
      return
    }

    const queryKey = String(classId) + '|' + month
    const queryChanged = queryKeyRef.current !== queryKey
    queryKeyRef.current = queryKey
    setState((current) => queryChanged
      ? { status: 'loading', data: null, error: null }
      : { ...current, status: 'loading', error: null })
    try {
      const data = await reportsApi.monthly(classId, month)
      setState({ status: 'success', data, error: null })
    } catch (cause) {
      if (signal?.aborted) return
      setState((current) => ({
        status: 'error',
        data: current.data,
        error: cause instanceof Error ? cause.message : 'Unable to load report.',
      }))
    }
  }, [classId, month])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

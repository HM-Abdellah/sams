import { useCallback, useEffect, useState } from 'react'
import { reportsApi, type MonthlyReportData } from './api.ts'

interface MonthlyReportState {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: MonthlyReportData | null
  error: string | null
}

export function useMonthlyReport(classId: number | null, month: string | null) {
  const [state, setState] = useState<MonthlyReportState>({
    status: 'idle',
    data: null,
    error: null,
  })

  const load = useCallback(async (signal?: AbortSignal) => {
    if (classId === null || month === null) {
      setState({ status: 'idle', data: null, error: null })
      return
    }

    setState({ status: 'loading', data: null, error: null })
    try {
      const data = await reportsApi.monthly(classId, month)
      setState({ status: 'success', data, error: null })
    } catch (cause) {
      if (signal?.aborted) return
      setState({
        status: 'error',
        data: null,
        error: cause instanceof Error ? cause.message : 'Unable to load report.',
      })
    }
  }, [classId, month])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  return { ...state, reload: () => load() }
}

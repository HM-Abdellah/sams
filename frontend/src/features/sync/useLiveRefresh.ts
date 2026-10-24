import { useEffect, useRef } from 'react'
import { subscribeToDataChanges } from './changeSignal.ts'

interface LiveRefreshOptions {
  enabled?: boolean
  intervalMs?: number
}

const MIN_REFRESH_GAP_MS = 250

/**
 * Refreshes from the server after cross-device SSE events, cross-tab signals,
 * focus/network recovery, and a low-frequency fallback poll.
 */
export function useLiveRefresh(
  refresh: () => Promise<unknown> | unknown,
  { enabled = true, intervalMs = 10_000 }: LiveRefreshOptions = {},
): void {
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  }, [refresh])

  useEffect(() => {
    if (!enabled) return undefined

    let disposed = false
    let inFlight = false
    let pending = false
    let lastStartedAt = 0
    let throttleTimer: number | null = null

    const run = () => {
      if (disposed || document.visibilityState === 'hidden') return
      pending = true
      if (inFlight || throttleTimer !== null) return

      const remaining = lastStartedAt + MIN_REFRESH_GAP_MS - Date.now()
      if (remaining > 0) {
        throttleTimer = window.setTimeout(() => {
          throttleTimer = null
          if (pending) run()
        }, remaining)
        return
      }

      pending = false
      inFlight = true
      lastStartedAt = Date.now()

      void Promise.resolve()
        .then(() => refreshRef.current())
        .catch(() => {
          // Keep the last confirmed snapshot if a background refresh fails.
        })
        .finally(() => {
          inFlight = false
          if (pending && !disposed && document.visibilityState !== 'hidden') run()
        })
    }

    const interval = window.setInterval(run, intervalMs)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') run()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', run)
    window.addEventListener('online', run)
    window.addEventListener('pageshow', run)
    const unsubscribe = subscribeToDataChanges(run)

    return () => {
      disposed = true
      pending = false
      window.clearInterval(interval)
      if (throttleTimer !== null) window.clearTimeout(throttleTimer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', run)
      window.removeEventListener('online', run)
      window.removeEventListener('pageshow', run)
      unsubscribe()
    }
  }, [enabled, intervalMs])
}

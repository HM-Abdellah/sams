[Reading 375 lines from start (total: 375 lines, 0 remaining)]

import { useCallback, useEffect, useRef, useState } from 'react'
import { attendanceApi } from './api.ts'
import type { AttendanceRecord, AttendanceRevision, WeeklyRegisterData } from './api.ts'
import { ApiError } from '../../services/api/errors.ts'
import type { AttendanceEntry } from '../../services/api/types.ts'
import { publishAttendancePendingWork } from './pendingWork.ts'
import type { AttendanceDraft, AttendanceMutationState, AttendanceViewStatus } from './types.ts'

const keyFor = (studentId: number, date: string, period: number) =>
  `${studentId}|${date}|${period}`

const readServerStatus = (
  data: WeeklyRegisterData | null,
  studentId: number,
  date: string,
  period: number,
): AttendanceViewStatus => {
  const row = data?.attendance.find(
    (item) => item.student_id === studentId
      && item.attendance_date === date
      && item.period === period,
  )
  return row?.status ?? 'clear'
}

const readServerRevision = (
  data: WeeklyRegisterData | null,
  date: string,
  period: number,
): number => {
  const revision = data?.attendance_revisions.find(
    (item: AttendanceRevision) => item.attendance_date === date && item.period === period,
  )
  return revision?.revision ?? 0
}

export function useAttendanceRegister(classId: number | null, weekStart: string) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [data, setData] = useState<WeeklyRegisterData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Map<string, AttendanceDraft>>(new Map())
  const [mutationState, setMutationState] = useState<AttendanceMutationState>('idle')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [conflictData, setConflictData] = useState<WeeklyRegisterData | null>(null)

  const queryKeyRef = useRef<string | null>(null)
  const dataRef = useRef<WeeklyRegisterData | null>(null)
  const draftsRef = useRef<Map<string, AttendanceDraft>>(new Map())
  const versionRef = useRef(0)
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushPromiseRef = useRef<Promise<boolean> | null>(null)

  const requestRegister = useCallback(async () => {
    if (classId === null) throw new Error('A class is required.')
    return attendanceApi.weeklyRegister(classId, weekStart)
  }, [classId, weekStart])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (classId === null) {
      queryKeyRef.current = null
      setStatus('idle')
      setData(null)
      dataRef.current = null
      setError(null)
      return
    }

    const queryKey = String(classId) + '|' + weekStart
    const queryChanged = queryKeyRef.current !== queryKey
    queryKeyRef.current = queryKey
    if (queryChanged) {
      setData(null)
      dataRef.current = null
    }
    setStatus('loading')
    setError(null)
    try {
      const result = await requestRegister()
      if (signal?.aborted) return
      dataRef.current = result
      setData(result)
      setStatus('success')
      setMutationError(null)
    } catch (cause) {
      if (signal?.aborted) return
      const message = cause instanceof Error ? cause.message : 'Unable to load attendance.'
      setStatus('error')
      setError(message)
    }
  }, [classId, requestRegister, weekStart])

  useEffect(() => {
    draftsRef.current = new Map()
    setDrafts(new Map())
    setMutationState('idle')
    setMutationError(null)
    setLastSavedAt(null)
    setConflictData(null)

    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [classId, weekStart, load])

  const isBusy = drafts.size > 0
    || mutationState === 'saving'
    || mutationState === 'retrying'

  useEffect(() => {
    publishAttendancePendingWork(isBusy)
    return () => publishAttendancePendingWork(false)
  }, [isBusy])

  const getStatus = useCallback((studentId: number, date: string, period: number): AttendanceViewStatus => {
    if (mutationState === 'conflict' && conflictData !== null) {
      return readServerStatus(conflictData, studentId, date, period)
    }

    const draft = draftsRef.current.get(keyFor(studentId, date, period))
    if (draft) return draft.entry.action === 'delete' ? 'clear' : (draft.entry.status ?? 'clear')
    return readServerStatus(dataRef.current, studentId, date, period)
  }, [conflictData, mutationState])

  const getSignoff = useCallback((date: string, period: number) => {
    return dataRef.current?.period_signoffs.find(
      (item) => item.attendance_date === date && item.period === period,
    ) ?? null
  }, [])

  const isSigned = useCallback((date: string, period: number) => {
    return getSignoff(date, period)?.status === 'signed'
  }, [getSignoff])

  const flush = useCallback(async (mode: 'auto' | 'retry' = 'auto'): Promise<boolean> => {
    if (classId === null || draftsRef.current.size === 0) return true
    if (flushPromiseRef.current) return flushPromiseRef.current

    const run = (async () => {
      setMutationState(mode === 'retry' ? 'retrying' : 'saving')
      setMutationError(null)

      while (draftsRef.current.size > 0) {
        const batch = Array.from(draftsRef.current.entries()).slice(0, 500)
        const entries = batch.map(([, draft]) => draft.entry)

        try {
          await attendanceApi.saveBulk(classId, entries)
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Unable to save attendance.'

          if (cause instanceof ApiError && cause.code === 'ATTENDANCE_CONCURRENCY_CONFLICT') {
            setMutationState('conflict')
            setMutationError(message)
            try {
              const latest = await requestRegister()
              dataRef.current = latest
              setData(latest)
              setConflictData(latest)
            } catch {
              setMutationError(
                message + ' The latest register could not be loaded; your pending changes remain preserved.',
              )
            }
            return false
          }

          setMutationState('failed')
          setMutationError(message)
          return false
        }

        let refreshed: WeeklyRegisterData
        try {
          refreshed = await requestRegister()
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Unable to confirm attendance.'
          setMutationState('failed')
          setMutationError(message)
          // The server may already have committed the batch. Keep matching drafts
          // until an authoritative refresh confirms their final state.
          return false
        }

        dataRef.current = refreshed
        setData(refreshed)
        setConflictData(null)

        const remaining = new Map(draftsRef.current)
        for (const [key, draft] of batch) {
          const current = remaining.get(key)
          if (current?.version === draft.version) remaining.delete(key)
        }
        draftsRef.current = remaining
        setDrafts(remaining)
      }

      setMutationState('saved')
      setLastSavedAt(new Date())
      return true
    })()

    flushPromiseRef.current = run
    try {
      return await run
    } finally {
      flushPromiseRef.current = null
    }
  }, [classId, requestRegister])

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current)
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      void flush()
    }, 500)
  }, [flush])

  const changeStatus = useCallback((
    studentId: number,
    date: string,
    period: number,
    nextStatus: AttendanceViewStatus,
  ) => {
    if (classId === null || isSigned(date, period) || mutationState === 'conflict') return

    const current = getStatus(studentId, date, period)
    if (current === nextStatus) return

    const key = keyFor(studentId, date, period)
    const previousDraft = draftsRef.current.get(key)
    const expectedRevision = previousDraft?.expectedRevision
      ?? readServerRevision(dataRef.current, date, period)
    const version = ++versionRef.current
    let entry: AttendanceEntry
    if (nextStatus === 'clear') {
      entry = {
        student_id: studentId,
        attendance_date: date,
        period,
        action: 'delete',
        expected_revision: expectedRevision,
      }
    } else {
      entry = {
        student_id: studentId,
        attendance_date: date,
        period,
        action: 'upsert',
        status: nextStatus,
        expected_revision: expectedRevision,
      }
    }

    const draft: AttendanceDraft = {
      entry,
      previousStatus: previousDraft?.previousStatus ?? current,
      expectedRevision,
      version,
    }
    const next = new Map(draftsRef.current)
    next.set(key, draft)
    draftsRef.current = next
    setDrafts(next)
    setMutationState('idle')
    setMutationError(null)
    scheduleFlush()
  }, [classId, getStatus, isSigned, mutationState, scheduleFlush])

  const keepChanges = useCallback(async (): Promise<boolean> => {
    if (conflictData === null || draftsRef.current.size === 0) return false

    const rebased = new Map<string, AttendanceDraft>()
    for (const [key, draft] of draftsRef.current) {
      const expectedRevision = readServerRevision(
        conflictData,
        draft.entry.attendance_date,
        draft.entry.period,
      )
      rebased.set(key, {
        ...draft,
        expectedRevision,
        entry: {
          ...draft.entry,
          expected_revision: expectedRevision,
        },
      })
    }

    dataRef.current = conflictData
    setData(conflictData)
    draftsRef.current = rebased
    setDrafts(rebased)
    setConflictData(null)
    setMutationState('idle')
    setMutationError(null)
    return flush('retry')
  }, [conflictData, flush])

  const useLatest = useCallback(() => {
    if (conflictData === null) return false

    dataRef.current = conflictData
    setData(conflictData)
    draftsRef.current = new Map()
    setDrafts(new Map())
    setConflictData(null)
    setMutationState('idle')
    setMutationError(null)
    return true
  }, [conflictData])

  const retry = useCallback(() => flush('retry'), [flush])

  const markBlocked = useCallback(() => {
    if (isBusy && mutationState !== 'conflict') setMutationState('blocked')
  }, [isBusy, mutationState])

  useEffect(() => () => {
    if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current)
  }, [])

  const reload = useCallback(async () => {
    if (!(await flush())) return
    await load()
  }, [flush, load])

  const recordsWithDrafts = useCallback((): AttendanceRecord[] => {
    const records = new Map<string, AttendanceRecord>()
    for (const row of dataRef.current?.attendance ?? []) {
      records.set(keyFor(row.student_id, row.attendance_date, row.period), row)
    }
    for (const [key, draft] of draftsRef.current) {
      if (draft.entry.action === 'delete') {
        records.delete(key)
      } else {
        const previous = records.get(key)
        records.set(key, {
          id: previous?.id ?? 0,
          enrollment_id: previous?.enrollment_id ?? 0,
          student_id: draft.entry.student_id,
          attendance_date: draft.entry.attendance_date,
          period: draft.entry.period,
          status: draft.entry.status!,
        })
      }
    }
    return Array.from(records.values())
  }, [])

  return {
    status,
    data,
    error,
    drafts,
    isDirty: drafts.size > 0,
    dirtyCount: drafts.size,
    isBusy,
    mutationState,
    mutationError,
    lastSavedAt,
    hasConflict: conflictData !== null,
    keepChanges,
    useLatest,
    getStatus,
    getSignoff,
    isSigned,
    markBlocked,
    changeStatus,
    flush,
    retry,
    reload,
    recordsWithDrafts,
  }
}

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]
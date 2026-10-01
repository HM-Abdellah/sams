import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useBeforeUnload, useBlocker, useSearchParams } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { useAttendanceRegister } from '../../features/attendance/useAttendanceRegister.ts'
import { attendanceApi, type AttendanceStudent } from '../../features/attendance/api.ts'
import type { AttendanceFilter, AttendanceViewStatus } from '../../features/attendance/types.ts'
import { signaturesApi } from '../../features/signatures/api.ts'
import { AsyncStateFeedback, Badge, Button, EmptyState, Search, Select, StatusMessage } from '../../components/ui/index.ts'

const PERIODS = [
  '08:00–09:00', '09:00–10:00', '10:00–11:00', '11:00–12:00',
  '14:00–15:00', '15:00–16:00', '16:00–17:00', '17:00–18:00',
] as const

const FILTERS: AttendanceFilter[] = ['all', 'with_absences', 'eight_plus_absences']
const MARK_STATUSES = ['present', 'absent', 'late', 'excused'] as const
type MarkStatus = (typeof MARK_STATUSES)[number]
const EMPTY_STUDENTS: AttendanceStudent[] = []

const STATUS_STYLES: Record<AttendanceViewStatus, string> = {
  clear: 'border-[var(--sams-border)] bg-[var(--sams-surface)] text-[var(--sams-muted)] hover:border-[var(--sams-action)]/40 hover:bg-[var(--sams-muted-surface)]',
  present: 'border-[var(--sams-success)]/25 bg-[var(--sams-success-surface)] text-[var(--sams-success)]',
  absent: 'border-[var(--sams-danger)]/25 bg-[var(--sams-danger-surface)] text-[var(--sams-danger)]',
  late: 'border-[var(--sams-warning)]/25 bg-[var(--sams-warning-surface)] text-[var(--sams-warning)]',
  excused: 'border-[var(--sams-excused)]/25 bg-[var(--sams-excused-surface)] text-[var(--sams-excused)]',
}

const STATUS_SYMBOLS: Record<AttendanceViewStatus, string> = {
  clear: '·', present: '✓', absent: 'A', late: 'L', excused: 'E',
}

function isIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function localDateString(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return String(date.getFullYear()) + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

function addDays(dateString: string, amount: number) {
  const date = new Date(dateString + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function startOfWeek(dateString: string) {
  const date = new Date(dateString + 'T00:00:00Z')
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return date.toISOString().slice(0, 10)
}

function formatDate(dateString: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(
    new Date(dateString + 'T00:00:00Z'),
  )
}

function displayName(firstName: string, lastName: string) {
  return (firstName + ' ' + lastName).trim()
}

export function TeacherAttendancePage() {
  const { t, locale } = useI18n()
  const classes = useTeacherClasses()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AttendanceFilter>('all')
  const [selectedDay, setSelectedDay] = useState('')
  const [markMode, setMarkMode] = useState<MarkStatus>('present')
  const [signingPeriod, setSigningPeriod] = useState<number | null>(null)
  const [signError, setSignError] = useState<string | null>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [signatureLoading, setSignatureLoading] = useState(false)

  const selectedClassParam = Number(params.get('class_id') ?? 0) || null
  const weekParam = params.get('week_start')
  const weekStart = isIsoDate(weekParam) ? startOfWeek(weekParam) : startOfWeek(localDateString())
  const selectedClassId = classes.classes.some((item) => item.id === selectedClassParam)
    ? selectedClassParam : null

  const register = useAttendanceRegister(selectedClassId, weekStart)
  const { data } = register
  const blocker = useBlocker(register.isBusy)

  useBeforeUnload(useCallback((event) => {
    if (!register.isBusy) return
    event.preventDefault()
    event.returnValue = ''
  }, [register.isBusy]))

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const finish = async () => {
      register.markBlocked()
      if (await register.flush()) blocker.proceed()
      else blocker.reset()
    }
    void finish()
  }, [blocker, register])

  useEffect(() => {
    if (classes.status !== 'success' || classes.classes.length === 0) return
    if (classes.classes.some((item) => item.id === selectedClassParam)) return
    const firstClass = classes.classes[0]
    if (!firstClass) return
    const next = new URLSearchParams(params)
    next.set('class_id', String(firstClass.id))
    setParams(next, { replace: true })
  }, [classes.classes, classes.status, params, selectedClassParam, setParams])

  useEffect(() => {
    if (weekParam === weekStart) return
    const next = new URLSearchParams(params)
    next.set('week_start', weekStart)
    setParams(next, { replace: true })
  }, [params, setParams, weekParam, weekStart])

  const days = useMemo(() => {
    const start = data?.week_start ?? weekStart
    const end = data?.week_end ?? addDays(start, 5)
    return Array.from({ length: 6 }, (_, index) => addDays(start, index)).filter((day) => day <= end)
  }, [data?.week_end, data?.week_start, weekStart])

  useEffect(() => {
    if (!days.includes(selectedDay)) setSelectedDay(days[0] ?? weekStart)
  }, [days, selectedDay, weekStart])

  const activeDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? weekStart)
  const students = data?.students ?? EMPTY_STUDENTS
  const { getStatus, getSignoff, recordsWithDrafts } = register

  const absenceCounts = new Map<number, number>()
  for (const row of recordsWithDrafts()) {
    if (row.status === 'absent') {
      absenceCounts.set(row.student_id, (absenceCounts.get(row.student_id) ?? 0) + 1)
    }
  }

  const normalizedSearch = search.trim().toLocaleLowerCase(locale)
  const filteredStudents = students.filter((student) => {
    const name = displayName(student.first_name, student.last_name).toLocaleLowerCase(locale)
    const absences = absenceCounts.get(student.id) ?? 0
    if (normalizedSearch && !name.includes(normalizedSearch)) return false
    if (filter === 'with_absences' && absences < 1) return false
    if (filter === 'eight_plus_absences' && absences < 8) return false
    return true
  })

  const periodSummary = useMemo(() => PERIODS.map((_, index) => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 }
    for (const student of students) {
      const status = getStatus(student.id, activeDay, index + 1)
      if (status === 'clear') counts.unmarked += 1
      else counts[status] += 1
    }
    return { period: index + 1, ...counts }
  }), [activeDay, getStatus, students])

  const selectedClass = classes.classes.find((item) => item.id === selectedClassId) ?? null

  useEffect(() => {
    if (selectedClassId === null) {
      setHasSignature(false)
      return
    }
    let active = true
    setSignatureLoading(true)
    void signaturesApi.get(selectedClassId)
      .then((result) => {
        if (active) setHasSignature(result.signature !== null)
      })
      .catch(() => {
        if (active) setHasSignature(false)
      })
      .finally(() => {
        if (active) setSignatureLoading(false)
      })
    return () => { active = false }
  }, [selectedClassId])

  const signPeriod = async (period: number) => {
    if (selectedClassId === null || signingPeriod !== null) return
    setSignError(null)
    const summary = periodSummary[period - 1]
    if (!summary || summary.unmarked > 0) {
      setSignError(t(TRANSLATION_KEYS.attendance.signAllStudentsFirst))
      return
    }
    if (!hasSignature) {
      setSignError(t(TRANSLATION_KEYS.attendance.signatureRequired))
      return
    }
    if (!(await register.flush())) return
    setSigningPeriod(period)
    try {
      await attendanceApi.signPeriod(selectedClassId, weekStart, activeDay, period)
      await register.reload()
    } catch (cause) {
      setSignError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSigningPeriod(null)
    }
  }

  const setWeek = async (delta: number) => {
    if (!(await register.flush())) return
    const next = new URLSearchParams(params)
    next.set('week_start', delta === 0 ? startOfWeek(localDateString()) : addDays(weekStart, delta * 7))
    setParams(next)
  }

  const setClass = async (classId: string) => {
    if (!(await register.flush())) return
    const next = new URLSearchParams(params)
    next.set('class_id', classId)
    setParams(next)
  }

  if (classes.data === null) {
    return <AsyncStateFeedback state={classes} loadingLabel={t(TRANSLATION_KEYS.auth.loading)} refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)} errorTitle={t(TRANSLATION_KEYS.system.errorTitle)} genericError={t(TRANSLATION_KEYS.system.genericError)} staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)} reloadLabel={t(TRANSLATION_KEYS.system.reload)} onRetry={() => void classes.reload()} />
  }

  if (classes.classes.length === 0) {
    return <EmptyState title={t(TRANSLATION_KEYS.attendance.selectClass)} description={t(TRANSLATION_KEYS.teacher.noClasses)} />
  }

  const weekLabel = data
    ? formatDate(data.week_start, locale, { day: '2-digit', month: 'short' }) + ' – ' + formatDate(data.week_end, locale, { day: '2-digit', month: 'short', year: 'numeric' })
    : formatDate(weekStart, locale, { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="sams-section-label">{t(TRANSLATION_KEYS.navigation.attendance)}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em]">{t(TRANSLATION_KEYS.attendance.title)}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.attendance.description)}</p>
        </div>
        <Link
          to={selectedClassId ? '/app/signatures?class_id=' + selectedClassId : '/app/signatures'}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 text-sm font-semibold text-[var(--sams-text)] shadow-sm hover:bg-[var(--sams-action-soft)]"
        >
          {t(TRANSLATION_KEYS.navigation.signatures)}
        </Link>
      </header>

      <div className="sams-card p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block text-sm font-semibold" htmlFor="attendance-class">
            {t(TRANSLATION_KEYS.attendance.selectClass)}
            <Select id="attendance-class" className="mt-2" value={selectedClassId ? String(selectedClassId) : ''} onChange={(event) => void setClass(event.target.value)}>
              {!selectedClassId && <option value="">{t(TRANSLATION_KEYS.attendance.selectClass)}</option>}
              {classes.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>
          <div className="flex items-center justify-center gap-2 lg:justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={() => void setWeek(-1)} aria-label={t(TRANSLATION_KEYS.attendance.previousWeek)}>←</Button>
            <span className="min-w-40 text-center text-sm font-semibold">{weekLabel}</span>
            <Button type="button" variant="secondary" size="sm" onClick={() => void setWeek(1)} aria-label={t(TRANSLATION_KEYS.attendance.nextWeek)}>→</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => void setWeek(0)}>{t(TRANSLATION_KEYS.attendance.today)}</Button>
          </div>
        </div>

        <div role="group" aria-label={t(TRANSLATION_KEYS.attendance.title)} className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day}
              type="button"
              aria-pressed={day === activeDay}
              onClick={() => setSelectedDay(day)}
              className={day === activeDay
                ? 'min-h-11 shrink-0 rounded-xl bg-[var(--sams-action)] px-3.5 py-2 text-left text-white shadow-sm'
                : 'min-h-11 shrink-0 rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] px-3.5 py-2 text-left hover:bg-[var(--sams-action-soft)]'}
            >
              <span className="block text-xs font-semibold">{formatDate(day, locale, { weekday: 'short' })}</span>
              <span className="block text-sm font-semibold">{formatDate(day, locale, { day: '2-digit', month: 'short' })}</span>
            </button>
          ))}
        </div>
      </div>

      {register.data === null ? (
        <AsyncStateFeedback
          state={{ status: register.status, data: register.data, error: register.error }}
          loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
          refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
          errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
          genericError={t(TRANSLATION_KEYS.system.genericError)}
          staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
          reloadLabel={t(TRANSLATION_KEYS.system.reload)}
          onRetry={() => void register.reload()}
        />
      ) : (
        <>
          <AsyncStateFeedback
            state={{ status: register.status, data: register.data, error: register.error }}
            loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
            refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
            errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
            genericError={t(TRANSLATION_KEYS.system.genericError)}
            staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
            reloadLabel={t(TRANSLATION_KEYS.system.reload)}
            onRetry={() => void register.reload()}
          />

          <section className="sams-card overflow-hidden">
            <div className="border-b border-[var(--sams-border)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="sams-section-label">{selectedClass?.name ?? ''}</p>
                  <p className="mt-1 text-xl font-semibold tracking-tight">{formatDate(activeDay, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--sams-muted)]">
                    <span>{students.length} {t(TRANSLATION_KEYS.teacher.studentCount)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{filteredStudents.length} / {students.length} {t(TRANSLATION_KEYS.attendance.studentsShown)}</span>
                    <span aria-hidden="true">·</span>
                    {signatureLoading ? <Badge variant="neutral">{t(TRANSLATION_KEYS.auth.loading)}</Badge> : hasSignature ? <Badge variant="success">{t(TRANSLATION_KEYS.navigation.signatures)}</Badge> : <Badge variant="warning">{t(TRANSLATION_KEYS.navigation.signatures)}</Badge>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t(TRANSLATION_KEYS.attendance.markAs)}>
                  <span className="text-xs font-semibold text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.attendance.markAs)}</span>
                  {MARK_STATUSES.map((status) => (
                    <button
                      key={status}
                      type="button"
                      aria-pressed={markMode === status}
                      onClick={() => setMarkMode(status)}
                      className={markMode === status
                        ? 'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ring-2 ring-[var(--sams-action-soft)] ring-offset-1 md:min-h-9 ' + STATUS_STYLES[status]
                        : 'inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--sams-border)] bg-[var(--sams-surface)] px-3 text-xs font-semibold text-[var(--sams-muted)] hover:bg-[var(--sams-muted-surface)] md:min-h-9'}
                    >
                      <span aria-hidden="true">{STATUS_SYMBOLS[status]}</span>
                      {t(TRANSLATION_KEYS.attendance[status])}
                    </button>
                  ))}
                </div>
              </div>

              {signError && (
                <StatusMessage className="mt-4" variant="warning" title={t(TRANSLATION_KEYS.attendance.signLesson)}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{signError}</span>
                    {!hasSignature && !signatureLoading && <Link to={selectedClassId ? '/app/signatures?class_id=' + selectedClassId : '/app/signatures'} className="font-semibold underline">{t(TRANSLATION_KEYS.navigation.signatures)}</Link>}
                  </div>
                </StatusMessage>
              )}
              <p className="mt-4 text-xs text-[var(--sams-muted)] md:hidden">{t(TRANSLATION_KEYS.attendance.swipeHint)}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <Search
                  aria-label={t(TRANSLATION_KEYS.attendance.searchStudents)}
                  placeholder={t(TRANSLATION_KEYS.attendance.searchStudents)}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onClear={() => setSearch('')}
                  clearLabel={t(TRANSLATION_KEYS.teacher.clearSearch)}
                />
                <div className="flex flex-wrap gap-2" role="group" aria-label={t(TRANSLATION_KEYS.attendance.status)}>
                  {FILTERS.map((item) => {
                    const label = item === 'all'
                      ? t(TRANSLATION_KEYS.attendance.allStudents)
                      : item === 'with_absences'
                        ? t(TRANSLATION_KEYS.attendance.withAbsences)
                        : t(TRANSLATION_KEYS.attendance.eightPlusAbsences)
                    return (
                      <Button
                        key={item}
                        type="button"
                        size="sm"
                        variant={filter === item ? 'primary' : 'secondary'}
                        aria-pressed={filter === item}
                        onClick={() => setFilter(item)}
                      >
                        {label}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>

            {students.length === 0 ? (
              <EmptyState title={t(TRANSLATION_KEYS.attendance.noStudents)} />
            ) : filteredStudents.length === 0 ? (
              <div className="p-6"><EmptyState title={t(TRANSLATION_KEYS.attendance.noMatches)} /></div>
            ) : (
              <div className="sams-scroll-surface overflow-x-auto">
                <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
                  <caption className="sr-only">{t(TRANSLATION_KEYS.attendance.title)}</caption>
                  <colgroup>
                    <col className="w-[205px]" />
                    {PERIODS.map((period) => <col key={period} className="w-[94px]" />)}
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan={2} scope="col" className="sticky start-0 z-20 border-b border-e border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 py-3 text-start text-xs font-bold uppercase tracking-[0.08em] text-[var(--sams-muted)]">
                        {t(TRANSLATION_KEYS.teacher.studentName)}
                      </th>
                      <th colSpan={4} scope="colgroup" className="border-b border-e border-[var(--sams-border)] bg-[var(--sams-action-soft)] px-3 py-2 text-start text-xs font-bold uppercase tracking-[0.08em] text-[var(--sams-action)]">
                        {t(TRANSLATION_KEYS.attendance.morning)}
                      </th>
                      <th colSpan={4} scope="colgroup" className="border-b border-[var(--sams-border)] bg-[var(--sams-brand-accent-soft)] px-3 py-2 text-start text-xs font-bold uppercase tracking-[0.08em] text-[var(--sams-brand-accent)]">
                        {t(TRANSLATION_KEYS.attendance.afternoon)}
                      </th>
                    </tr>
                    <tr>
                      {PERIODS.map((time, index) => {
                        const period = index + 1
                        const summary = periodSummary[index]
                        const signoff = getSignoff(activeDay, period)
                        const signed = signoff?.status === 'signed'
                        const complete = (summary?.unmarked ?? students.length) === 0 && students.length > 0
                        return (
                          <th key={time} scope="col" className="border-b border-e border-[var(--sams-border)] bg-[var(--sams-surface)] px-2 py-2 text-start align-top last:border-e-0">
                            <div className="flex min-h-24 flex-col justify-between gap-2">
                              <div>
                                <span className="block text-xs font-bold">{t(TRANSLATION_KEYS.attendance.period)} {period}</span>
                                <span className="block text-[11px] font-medium text-[var(--sams-muted)]">{time}</span>
                                <span className="mt-2 block text-[11px] font-semibold text-[var(--sams-muted)]">{students.length - (summary?.unmarked ?? students.length)}/{students.length}</span>
                              </div>
                              {signed ? (
                                <Badge variant="success" className="w-fit">{t(TRANSLATION_KEYS.attendance.signedLesson)}</Badge>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={complete ? 'primary' : 'secondary'}
                                  disabled={!complete || signingPeriod !== null || !hasSignature}
                                  loading={signingPeriod === period}
                                  onClick={() => void signPeriod(period)}
                                  className="w-full px-2 text-[11px]"
                                >
                                  {t(TRANSLATION_KEYS.attendance.signLesson)}
                                </Button>
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStudents.map((student, index) => (
                      <tr key={student.id}>
                        <th scope="row" className="sticky start-0 z-10 border-b border-e border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 py-2.5 text-start">
                          <div className="flex items-center gap-3">
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--sams-muted-surface)] text-[11px] font-bold text-[var(--sams-muted)]">{index + 1}</span>
                            <div className="min-w-0">
                              <span className="block truncate font-semibold" dir="auto">{displayName(student.first_name, student.last_name)}</span>
                              <span className="block text-[11px] tabular-nums text-[var(--sams-muted)]">{absenceCounts.get(student.id) ?? 0} {t(TRANSLATION_KEYS.attendance.withAbsences)}</span>
                            </div>
                          </div>
                        </th>

                        {PERIODS.map((_, index) => {
                          const period = index + 1
                          const status = getStatus(student.id, activeDay, period)
                          const signed = getSignoff(activeDay, period)?.status === 'signed'
                          const label = status === 'clear' ? t(TRANSLATION_KEYS.attendance.unmarked) : t(TRANSLATION_KEYS.attendance[status])
                          return (
                            <td key={period} className="border-b border-e border-[var(--sams-border)] bg-[var(--sams-surface)] p-2 text-center last:border-e-0">
                              <button
                                type="button"
                                disabled={signed}
                                aria-label={displayName(student.first_name, student.last_name) + ' — ' + t(TRANSLATION_KEYS.attendance.period) + ' ' + period + ' — ' + label}
                                onClick={() => register.changeStatus(student.id, activeDay, period, status === markMode ? 'clear' : markMode)}
                                className={'sams-touch-cell mx-auto grid aspect-square w-12 place-items-center rounded-xl border text-base font-bold shadow-sm transition-[background-color,border-color,box-shadow] duration-150 hover:shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-action-soft)] disabled:cursor-not-allowed disabled:opacity-60 ' + STATUS_STYLES[status]}
                              >
                                <span aria-hidden="true">{STATUS_SYMBOLS[status]}</span>
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--sams-muted)]">
              {MARK_STATUSES.map((status) => (
                <span key={status} className="inline-flex items-center gap-1.5">
                  <span className={'grid size-5 place-items-center rounded-md border text-[10px] font-bold ' + STATUS_STYLES[status]} aria-hidden="true">{STATUS_SYMBOLS[status]}</span>
                  {t(TRANSLATION_KEYS.attendance[status])}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {register.isDirty && <Badge variant="warning">{register.dirtyCount} {t(TRANSLATION_KEYS.attendance.unsavedChanges)}</Badge>}
              <Button type="button" size="sm" loading={register.mutationState === 'saving'} disabled={!register.isDirty || register.mutationState === 'saving'} onClick={() => void register.flush()}>
                {t(TRANSLATION_KEYS.attendance.saveNow)}
              </Button>
            </div>
          </div>

          {register.mutationState === 'failed' && register.mutationError && (
            <StatusMessage variant="danger" title={t(TRANSLATION_KEYS.attendance.saveFailed)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{register.mutationError}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => void register.retry()}>{t(TRANSLATION_KEYS.attendance.retry)}</Button>
              </div>
            </StatusMessage>
          )}
          {register.mutationState === 'saving' && <StatusMessage>{t(TRANSLATION_KEYS.attendance.saving)}</StatusMessage>}
          {register.mutationState === 'retrying' && <StatusMessage>{t(TRANSLATION_KEYS.attendance.retrying)}</StatusMessage>}
          {register.mutationState === 'blocked' && <StatusMessage variant="warning" title={t(TRANSLATION_KEYS.attendance.blocked)}>{t(TRANSLATION_KEYS.attendance.blockedHint)}</StatusMessage>}
          {register.mutationState === 'saved' && !register.isDirty && <StatusMessage variant="success">{t(TRANSLATION_KEYS.attendance.saved)}</StatusMessage>}
          {register.isDirty && register.mutationState !== 'saving' && <StatusMessage variant="warning" title={t(TRANSLATION_KEYS.attendance.unsavedChanges)}>{register.dirtyCount}</StatusMessage>}
        </>
      )}
    </section>
  )
}

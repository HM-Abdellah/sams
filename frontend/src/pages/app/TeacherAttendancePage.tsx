import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBeforeUnload, useBlocker, useSearchParams } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { useAttendanceRegister } from '../../features/attendance/useAttendanceRegister.ts'
import type { AttendanceStudent } from '../../features/attendance/api.ts'
import type { AttendanceFilter, AttendanceViewStatus } from '../../features/attendance/types.ts'
import { AsyncStateFeedback, Button, EmptyState, Search, Select, StatusMessage, Table } from '../../components/ui/index.ts'

const PERIODS = [
  '08:00–09:00', '09:00–10:00', '10:00–11:00', '11:00–12:00',
  '14:00–15:00', '15:00–16:00', '16:00–17:00', '17:00–18:00',
] as const

const FILTERS: AttendanceFilter[] = ['all', 'with_absences', 'eight_plus_absences']
const EMPTY_STUDENTS: AttendanceStudent[] = []

function isIsoDate(value: string | null): value is string {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function localDateString(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(dateString: string, amount: number): string {
  const date = new Date(`${dateString}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function startOfWeek(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`)
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() + (day === 0 ? -6 : 1 - day))
  return date.toISOString().slice(0, 10)
}

function formatDate(dateString: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(
    new Date(`${dateString}T00:00:00Z`),
  )
}

function displayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim()
}

export function TeacherAttendancePage() {
  const { t, locale } = useI18n()
  const classes = useTeacherClasses()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AttendanceFilter>('all')
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState(1)

  const selectedClassParam = Number(params.get('class_id') ?? 0) || null
  const weekParam = params.get('week_start')
  const weekStart = isIsoDate(weekParam) ? startOfWeek(weekParam) : startOfWeek(localDateString())
  const selectedClassId = classes.classes.some((item) => item.id === selectedClassParam)
    ? selectedClassParam
    : null
  const register = useAttendanceRegister(selectedClassId, weekStart)
  const data = register.data
  const { flush, markBlocked } = register
  const blocker = useBlocker(register.isBusy)
  const { state: blockerState, proceed: proceedBlockedNavigation, reset: resetBlockedNavigation } = blocker

  useBeforeUnload(useCallback((event) => {
    if (!register.isBusy) return
    event.preventDefault()
    event.returnValue = ''
  }, [register.isBusy]))

  useEffect(() => {
    if (blockerState !== 'blocked') return
    const completeNavigation = async () => {
      markBlocked()
      if (await flush()) proceedBlockedNavigation()
      else resetBlockedNavigation()
    }
    void completeNavigation()
  }, [blockerState, flush, markBlocked, proceedBlockedNavigation, resetBlockedNavigation])

  useEffect(() => {
    if (classes.status !== 'success' || classes.classes.length === 0) return
    const current = Number(params.get('class_id') ?? 0)
    if (classes.classes.some((item) => item.id === current)) return
    const firstClass = classes.classes[0]
    if (!firstClass) return
    const next = new URLSearchParams(params)
    next.set('class_id', String(firstClass.id))
    setParams(next, { replace: true })
  }, [classes.classes, classes.status, params, setParams])

  useEffect(() => {
    if (weekParam === weekStart) return
    const next = new URLSearchParams(params)
    next.set('week_start', weekStart)
    setParams(next, { replace: true })
  }, [params, setParams, weekParam, weekStart])

  const days = useMemo(() => {
    const start = data?.week_start ?? weekStart
    const end = data?.week_end ?? addDays(start, 5)
    const result: string[] = []
    for (let offset = 0; offset < 6; offset += 1) {
      const date = addDays(start, offset)
      if (date > end) break
      result.push(date)
    }
    return result
  }, [data?.week_end, data?.week_start, weekStart])

  useEffect(() => {
    const firstDay = days[0]
    if (!firstDay) return
    if (!days.includes(selectedDay)) setSelectedDay(firstDay)
  }, [days, selectedDay])

  const activeDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? weekStart)
  const { getStatus, getSignoff, recordsWithDrafts } = register
  const absenceCounts = new Map<number, number>()
  for (const row of recordsWithDrafts()) {
    if (row.status === 'absent') absenceCounts.set(row.student_id, (absenceCounts.get(row.student_id) ?? 0) + 1)
  }
  const normalizedSearch = search.trim().toLocaleLowerCase(locale)
  const students = data?.students ?? EMPTY_STUDENTS
  const filteredStudents = students.filter((student) => {
    const name = displayName(student.first_name, student.last_name).toLocaleLowerCase(locale)
    if (normalizedSearch && !name.includes(normalizedSearch)) return false
    const absences = absenceCounts.get(student.id) ?? 0
    if (filter === 'with_absences' && absences < 1) return false
    if (filter === 'eight_plus_absences' && absences < 8) return false
    return true
  })

  const currentPeriodCounts = useMemo(() => {
    const result = { present: 0, absent: 0, late: 0, excused: 0, unmarked: 0 }
    for (const student of students) {
      const status = getStatus(student.id, activeDay, selectedPeriod)
      if (status === 'clear') result.unmarked += 1
      else result[status] += 1
    }
    return result
  }, [activeDay, getStatus, selectedPeriod, students])

  const signoff = getSignoff(activeDay, selectedPeriod)
  const signed = signoff?.status === 'signed'
  const needsResign = signoff?.status === 'needs_resign'
  const selectedClass = classes.classes.find((item) => item.id === selectedClassId) ?? null
  const weekLabel = data
    ? `${formatDate(data.week_start, locale, { day: '2-digit', month: 'short' })} – ${formatDate(data.week_end, locale, { day: '2-digit', month: 'short', year: 'numeric' })}`
    : formatDate(weekStart, locale, { day: '2-digit', month: 'short', year: 'numeric' })

  const changeWeek = async (delta: number) => {
    if (!(await register.flush())) return
    const next = new URLSearchParams(params)
    next.set('week_start', addDays(weekStart, delta * 7))
    setParams(next)
  }

  const goToday = async () => {
    if (!(await register.flush())) return
    const next = new URLSearchParams(params)
    next.set('week_start', startOfWeek(localDateString()))
    setParams(next)
  }

  const selectClass = async (classId: string) => {
    if (!(await register.flush())) return
    const next = new URLSearchParams(params)
    next.set('class_id', classId)
    setParams(next)
  }

  if (classes.data === null) {
    return (
      <AsyncStateFeedback
        state={classes}
        loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
        refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
        errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
        genericError={t(TRANSLATION_KEYS.system.genericError)}
        staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
        reloadLabel={t(TRANSLATION_KEYS.system.reload)}
        onRetry={() => void classes.reload()}
      />
    )
  }
  if (classes.classes.length === 0) {
    return <EmptyState title={t(TRANSLATION_KEYS.attendance.selectClass)} description={t(TRANSLATION_KEYS.teacher.noClasses)} />
  }

  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.attendance.title)}</h1>
        <p className="max-w-3xl text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.attendance.description)}</p>
      </header>

      <AsyncStateFeedback
        state={classes}
        loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
        refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
        errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
        genericError={t(TRANSLATION_KEYS.system.genericError)}
        staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
        reloadLabel={t(TRANSLATION_KEYS.system.reload)}
        onRetry={() => void classes.reload()}
      />

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="block text-sm font-medium" htmlFor="attendance-class">
          {t(TRANSLATION_KEYS.attendance.selectClass)}
          <Select id="attendance-class" className="mt-2" value={selectedClassId ? String(selectedClassId) : ''} onChange={(event) => void selectClass(event.target.value)}>
            {!selectedClassId && <option value="">{t(TRANSLATION_KEYS.attendance.selectClass)}</option>}
            {classes.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        </label>
        <div className="flex flex-wrap items-center justify-center gap-2 md:justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => void changeWeek(-1)} aria-label={t(TRANSLATION_KEYS.attendance.previousWeek)}>←</Button>
          <div className="min-w-36 text-center text-sm font-medium" aria-live="polite">{weekLabel}</div>
          <Button type="button" variant="secondary" size="sm" onClick={() => void changeWeek(1)} aria-label={t(TRANSLATION_KEYS.attendance.nextWeek)}>→</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void goToday()}>{t(TRANSLATION_KEYS.attendance.today)}</Button>
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[var(--sams-border)] py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm" role="group" aria-label={t(TRANSLATION_KEYS.attendance.status)}>
              <span>{t(TRANSLATION_KEYS.attendance.present)}: <strong>{currentPeriodCounts.present}</strong></span>
              <span>{t(TRANSLATION_KEYS.attendance.absent)}: <strong>{currentPeriodCounts.absent}</strong></span>
              <span>{t(TRANSLATION_KEYS.attendance.late)}: <strong>{currentPeriodCounts.late}</strong></span>
              <span>{t(TRANSLATION_KEYS.attendance.excused)}: <strong>{currentPeriodCounts.excused}</strong></span>
              <span className="text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.attendance.unmarked)}: <strong>{currentPeriodCounts.unmarked}</strong></span>
            </div>
            <Button type="button" size="sm" loading={register.mutationState === 'saving'} disabled={!register.isDirty || register.mutationState === 'saving'} onClick={() => void register.flush()}>
              {t(TRANSLATION_KEYS.attendance.saveNow)}
            </Button>
          </div>
          {register.mutationState === 'failed' && register.mutationError && (
            <StatusMessage variant="danger" title={t(TRANSLATION_KEYS.attendance.saveFailed)}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{register.mutationError}</span>
                <Button type="button" size="sm" variant="secondary" onClick={() => void register.retry()}>
                  {t(TRANSLATION_KEYS.attendance.retry)}
                </Button>
              </div>
            </StatusMessage>
          )}
          {register.mutationState === 'saving' && (
            <StatusMessage>{t(TRANSLATION_KEYS.attendance.saving)} {register.dirtyCount > 0 ? `${register.dirtyCount}` : ''}</StatusMessage>
          )}
          {register.mutationState === 'retrying' && (
            <StatusMessage>{t(TRANSLATION_KEYS.attendance.retrying)} {register.dirtyCount > 0 ? `${register.dirtyCount}` : ''}</StatusMessage>
          )}
          {register.mutationState === 'blocked' && (
            <StatusMessage variant="warning" title={t(TRANSLATION_KEYS.attendance.blocked)}>
              {t(TRANSLATION_KEYS.attendance.blockedHint)}
            </StatusMessage>
          )}
          {register.mutationState === 'saved' && !register.isDirty && (
            <StatusMessage variant="success">{t(TRANSLATION_KEYS.attendance.saved)}</StatusMessage>
          )}
          {register.isDirty && register.mutationState !== 'saving' && (
            <StatusMessage variant="warning" title={t(TRANSLATION_KEYS.attendance.unsavedChanges)}>
              {register.dirtyCount}
            </StatusMessage>
          )}

          {signed && signoff && (
            <StatusMessage variant="success" title={t(TRANSLATION_KEYS.attendance.signedLesson)}>
              {t(TRANSLATION_KEYS.attendance.signedBy)} {signoff.teacher_name}. {t(TRANSLATION_KEYS.attendance.protectedHint)}
            </StatusMessage>
          )}
          {needsResign && (
            <StatusMessage variant="warning" title={t(TRANSLATION_KEYS.attendance.needsResign)}>
              {t(TRANSLATION_KEYS.attendance.protectedHint)}
            </StatusMessage>
          )}

          <div className="space-y-3" aria-label={t(TRANSLATION_KEYS.attendance.period)}>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t(TRANSLATION_KEYS.attendance.title)}>
              {days.map((day) => (
                <button
                  key={day}
                  type="button"
                  aria-pressed={day === activeDay}
                  onClick={() => setSelectedDay(day)}
                  className={day === activeDay
                    ? 'min-h-10 rounded-md bg-[var(--sams-action)] px-3 py-2 text-sm font-medium text-[var(--sams-action-foreground)]'
                    : 'min-h-10 rounded-md border border-[var(--sams-border)] bg-[var(--sams-surface)] px-3 py-2 text-sm text-[var(--sams-text)] hover:bg-[var(--sams-muted-surface)]'}
                >
                  <span className="block font-medium">{formatDate(day, locale, { weekday: 'short' })}</span>
                  <span className="block text-xs opacity-80">{formatDate(day, locale, { day: '2-digit', month: '2-digit' })}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible xl:grid-cols-8">
              {PERIODS.map((period, index) => {
                const number = index + 1
                return (
                  <button
                    key={period}
                    type="button"
                    aria-pressed={selectedPeriod === number}
                    onClick={() => setSelectedPeriod(number)}
                    className={selectedPeriod === number
                      ? 'rounded-md bg-[var(--sams-muted-surface)] px-2 py-2 text-sm font-semibold ring-1 ring-[var(--sams-text)]'
                      : 'rounded-md border border-[var(--sams-border)] bg-[var(--sams-surface)] px-2 py-2 text-sm hover:bg-[var(--sams-muted-surface)]'}
                  >
                    <span className="block">{t(TRANSLATION_KEYS.attendance.period)} {number}</span>
                    <span className="block text-xs text-[var(--sams-muted)]">{period}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
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
                return <Button key={item} type="button" size="sm" variant={filter === item ? 'primary' : 'secondary'} aria-pressed={filter === item} onClick={() => setFilter(item)}>{label}</Button>
              })}
            </div>
          </div>

          <p className="text-sm text-[var(--sams-muted)]">
            {selectedClass?.name ?? ''} · {filteredStudents.length} / {students.length} {t(TRANSLATION_KEYS.attendance.studentsShown)}
          </p>

          {students.length === 0 ? (
            <EmptyState title={t(TRANSLATION_KEYS.attendance.noStudents)} />
          ) : filteredStudents.length === 0 ? (
            <EmptyState title={t(TRANSLATION_KEYS.attendance.noMatches)} />
          ) : (
            <>
              <div className="hidden md:block">
                <Table caption={t(TRANSLATION_KEYS.attendance.title)} headers={['#', t(TRANSLATION_KEYS.teacher.studentName), t(TRANSLATION_KEYS.attendance.status), 'Absences']}>
                  {filteredStudents.map((student, index) => {
                    const status = getStatus(student.id, activeDay, selectedPeriod)
                    return (
                      <tr key={student.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                        <td className="px-3 py-3 text-[var(--sams-muted)]">{index + 1}</td>
                        <td className="px-3 py-3 font-medium"><span dir="auto">{displayName(student.first_name, student.last_name)}</span></td>
                        <td className="w-56 px-3 py-2">
                          <Select
                            aria-label={`${displayName(student.first_name, student.last_name)} — ${t(TRANSLATION_KEYS.attendance.status)}`}
                            value={status}
                            disabled={signed}
                            onChange={(event) => register.changeStatus(student.id, activeDay, selectedPeriod, event.target.value as AttendanceViewStatus)}
                          >
                            <option value="clear">{t(TRANSLATION_KEYS.attendance.clear)}</option>
                            <option value="present">{t(TRANSLATION_KEYS.attendance.present)}</option>
                            <option value="absent">{t(TRANSLATION_KEYS.attendance.absent)}</option>
                            <option value="late">{t(TRANSLATION_KEYS.attendance.late)}</option>
                            <option value="excused">{t(TRANSLATION_KEYS.attendance.excused)}</option>
                          </Select>
                        </td>
                        <td className="px-3 py-3 tabular-nums">{absenceCounts.get(student.id) ?? 0}</td>
                      </tr>
                    )
                  })}
                </Table>
              </div>
              <div className="space-y-2 md:hidden">
                {filteredStudents.map((student, index) => {
                  const status = getStatus(student.id, activeDay, selectedPeriod)
                  return (
                    <article key={student.id} className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium"><span aria-hidden="true">{index + 1}. </span><span dir="auto">{displayName(student.first_name, student.last_name)}</span></p>
                          <p className="mt-1 text-xs text-[var(--sams-muted)]">
                            {t(TRANSLATION_KEYS.attendance.withAbsences)}: {absenceCounts.get(student.id) ?? 0}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--sams-muted)]">{formatDate(activeDay, locale, { weekday: 'short' })}</span>
                      </div>
                      <label className="mt-3 block text-sm font-medium">
                        {t(TRANSLATION_KEYS.attendance.status)}
                        <Select
                          className="mt-1"
                          value={status}
                          disabled={signed}
                          onChange={(event) => register.changeStatus(student.id, activeDay, selectedPeriod, event.target.value as AttendanceViewStatus)}
                        >
                          <option value="clear">{t(TRANSLATION_KEYS.attendance.clear)}</option>
                          <option value="present">{t(TRANSLATION_KEYS.attendance.present)}</option>
                          <option value="absent">{t(TRANSLATION_KEYS.attendance.absent)}</option>
                          <option value="late">{t(TRANSLATION_KEYS.attendance.late)}</option>
                          <option value="excused">{t(TRANSLATION_KEYS.attendance.excused)}</option>
                        </Select>
                      </label>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </section>
  )
}

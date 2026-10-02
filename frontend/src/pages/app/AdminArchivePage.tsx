import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { archiveApi } from '../../features/archive/api.ts'
import { useArchive } from '../../features/archive/useArchive.ts'
import type { ArchiveData } from '../../features/archive/types.ts'
import { asNumber, isActive } from '../../features/admin/helpers.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS, type TranslationKey } from '../../features/i18n/types.ts'
import { AsyncStateFeedback, Badge, Button, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table } from '../../components/ui/index.ts'

type ArchiveView = 'days' | 'month' | 'day' | 'student'

const attendanceStatus = (
  status: string | null | undefined,
  t: (key: TranslationKey) => string,
) => {
  switch (status) {
    case 'present': return t(TRANSLATION_KEYS.attendance.present)
    case 'absent': return t(TRANSLATION_KEYS.attendance.absent)
    case 'late': return t(TRANSLATION_KEYS.attendance.late)
    case 'excused': return t(TRANSLATION_KEYS.attendance.excused)
    default: return t(TRANSLATION_KEYS.attendance.unmarked)
  }
}

const attendanceStatusVariant = (status: string | null | undefined) => {
  if (status === 'absent') return 'danger' as const
  if (status === 'present') return 'success' as const
  if (status === 'late') return 'warning' as const
  return 'neutral' as const
}

const currentMonth = () => {
  const date = new Date()
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
}

const today = () => new Date().toISOString().slice(0, 10)

export function AdminArchivePage() {
  const { t, formatNumber, formatDate } = useI18n()
  const [params, setParams] = useSearchParams()
  const loadClasses = useCallback(() => adminApi.classes(), [])
  const classes = useAdminResource(loadClasses)
  const view = (params.get('view') as ArchiveView | null) ?? 'days'
  const classId = Number(params.get('class_id') ?? 0) || null
  const month = params.get('month') ?? currentMonth()
  const date = params.get('date') ?? today()
  const studentId = Number(params.get('student_id') ?? 0) || null

  const archiveParams = useMemo<Parameters<typeof archiveApi.read>[0] | null>(
    () => classId === null ? null : {
      view,
      classId,
      ...(view === 'days' || view === 'month' ? { month } : {}),
      ...(view === 'day' ? { date } : {}),
      ...(view === 'student' && studentId !== null ? { studentId } : {}),
    },
    [classId, date, month, studentId, view],
  )

  const archive = useArchive(archiveParams)
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'view') {
      next.delete('student_id')
      next.delete('date')
    }
    if (key === 'class_id') {
      next.delete('student_id')
      next.delete('date')
    }
    setParams(next)
  }

  if (classes.status === 'idle' || classes.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }
  if (classes.status === 'error' || classes.data === null) {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={classes.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={<Button type="button" variant="secondary" onClick={() => void classes.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />
    )
  }

  const data = classes.data

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.archive)}
        description={t(TRANSLATION_KEYS.archive.readOnlyHint)}
      />

      <section className="sams-admin-toolbar grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
        <FormField label={t(TRANSLATION_KEYS.archive.class)}>
          {({ id, ...aria }) => (
            <Select id={id} {...aria} value={classId ? String(classId) : ''} onChange={(event) => setParam('class_id', event.target.value)}>
              <option value="">{t(TRANSLATION_KEYS.archive.selectClass)}</option>
              {data.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.academic_year_name}{isActive(item.is_active) ? '' : ' · ' + t(TRANSLATION_KEYS.archive.historical)}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label={t(TRANSLATION_KEYS.archive.view)}>
          {({ id, ...aria }) => (
            <Select id={id} {...aria} value={view} onChange={(event) => setParam('view', event.target.value)}>
              <option value="days">{t(TRANSLATION_KEYS.archive.days)}</option>
              <option value="month">{t(TRANSLATION_KEYS.archive.month)}</option>
              <option value="day">{t(TRANSLATION_KEYS.archive.day)}</option>
              <option value="student">{t(TRANSLATION_KEYS.archive.studentHistory)}</option>
            </Select>
          )}
        </FormField>

        {(view === 'days' || view === 'month') && (
          <FormField label={t(TRANSLATION_KEYS.archive.month)}>
            {({ id, ...aria }) => <Input id={id} {...aria} type="month" value={month} onChange={(event) => setParam('month', event.target.value)} />}
          </FormField>
        )}

        {view === 'day' && (
          <FormField label={t(TRANSLATION_KEYS.archive.date)}>
            {({ id, ...aria }) => <Input id={id} {...aria} type="date" value={date} onChange={(event) => setParam('date', event.target.value)} />}
          </FormField>
        )}

        {view === 'student' && (
          <FormField label={t(TRANSLATION_KEYS.archive.student)}>
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                type="number"
                min="1"
                inputMode="numeric"
                value={studentId ? String(studentId) : ''}
                placeholder={t(TRANSLATION_KEYS.archive.studentId)}
                onChange={(event) => setParam('student_id', event.target.value)}
              />
            )}
          </FormField>
        )}
      </section>

      {classId === null ? (
        <EmptyState title={t(TRANSLATION_KEYS.archive.selectClass)} />
      ) : view === 'student' && studentId === null ? (
        <EmptyState title={t(TRANSLATION_KEYS.archive.selectStudent)} description={t(TRANSLATION_KEYS.archive.studentSelectionHint)} />
      ) : archive.data === null ? (
        <AsyncStateFeedback
          state={archive}
          loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
          refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
          errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
          genericError={t(TRANSLATION_KEYS.system.genericError)}
          staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
          reloadLabel={t(TRANSLATION_KEYS.system.reload)}
          onRetry={() => void archive.reload()}
        />
      ) : (
        <>
          <AsyncStateFeedback
            state={archive}
            loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
            refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
            errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
            genericError={t(TRANSLATION_KEYS.system.genericError)}
            staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
            reloadLabel={t(TRANSLATION_KEYS.system.reload)}
            onRetry={() => void archive.reload()}
          />
          <ArchiveResult data={archive.data} formatNumber={formatNumber} formatDate={formatDate} t={t} />
        </>
      )}
    </section>
  )
}

function ArchiveResult({
  data,
  formatNumber,
  formatDate,
  t,
}: {
  data: ArchiveData
  formatNumber: (value: number) => string
  formatDate: (value: string) => string
  t: (key: TranslationKey) => string
}) {
  const heading = data.class.name + ' · ' + data.class.academic_year_name
  return (
    <section className="space-y-4">
      <div className="sams-card p-5">
        <h2 className="text-lg font-semibold">{heading}</h2>
        <p className="mt-1 text-sm text-[var(--sams-muted)]">
          {formatDate(data.class.academic_year_starts_on)} → {formatDate(data.class.academic_year_ends_on)}
        </p>
      </div>

      {data.view === 'days' && (
        data.days.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.archive.days)} description={t(TRANSLATION_KEYS.archive.noRecords)} /> : (
          <Table caption={t(TRANSLATION_KEYS.archive.days)} headers={[
            t(TRANSLATION_KEYS.archive.date),
            t(TRANSLATION_KEYS.archive.records),
            t(TRANSLATION_KEYS.archive.present),
            t(TRANSLATION_KEYS.archive.absent),
            t(TRANSLATION_KEYS.archive.late),
            t(TRANSLATION_KEYS.archive.excused),
          ]}>
            {data.days.map((item) => (
              <tr key={item.attendance_date} className="border-b border-[var(--sams-border)] last:border-b-0">
                <td className="px-3 py-2 font-medium">{formatDate(item.attendance_date)}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.recorded_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.present_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.absent_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.late_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.excused_count))}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {data.view === 'month' && (
        data.students.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.archive.month)} description={t(TRANSLATION_KEYS.archive.noRecords)} /> : (
          <Table caption={t(TRANSLATION_KEYS.archive.month)} headers={[
            t(TRANSLATION_KEYS.archive.student),
            t(TRANSLATION_KEYS.archive.enrollment),
            t(TRANSLATION_KEYS.archive.present),
            t(TRANSLATION_KEYS.archive.absent),
            t(TRANSLATION_KEYS.archive.late),
            t(TRANSLATION_KEYS.archive.excused),
            t(TRANSLATION_KEYS.archive.records),
          ]}>
            {data.students.map((item) => (
              <tr key={item.id + '-' + item.enrollment_starts_on} className="border-b border-[var(--sams-border)] last:border-b-0">
                <td className="px-3 py-2 font-medium">{item.first_name} {item.last_name}</td>
                <td className="px-3 py-2 text-sm">
                  {formatDate(item.enrollment_starts_on)}
                  {item.enrollment_ends_on ? ' → ' + formatDate(item.enrollment_ends_on) : ''}
                </td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.present_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.absent_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.late_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.excused_count))}</td>
                <td className="px-3 py-2">{formatNumber(asNumber(item.recorded_count))}</td>
              </tr>
            ))}
          </Table>
        )
      )}

      {data.view === 'day' && (
        <Table caption={t(TRANSLATION_KEYS.archive.day)} headers={[
          t(TRANSLATION_KEYS.archive.student),
          t(TRANSLATION_KEYS.archive.period),
          t(TRANSLATION_KEYS.archive.status),
          t(TRANSLATION_KEYS.archive.enrollment),
        ]}>
          {data.records.map((item) => (
            <tr key={item.student_id + '-' + String(item.attendance_id ?? 'none') + '-' + String(item.period ?? 'none')} className="border-b border-[var(--sams-border)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{item.first_name} {item.last_name}</td>
              <td className="px-3 py-2">{item.period ?? '—'}</td>
              <td className="px-3 py-2">
                <Badge variant={attendanceStatusVariant(item.status)}>
                  {attendanceStatus(item.status, t)}
                </Badge>
              </td>
              <td className="px-3 py-2">{formatDate(item.enrollment_starts_on)}{item.enrollment_ends_on ? ' → ' + formatDate(item.enrollment_ends_on) : ''}</td>
            </tr>
          ))}
        </Table>
      )}

      {data.view === 'student' && (
        data.history.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.archive.studentHistory)} description={t(TRANSLATION_KEYS.archive.noRecords)} /> : (
          <Table caption={t(TRANSLATION_KEYS.archive.studentHistory)} headers={[
            t(TRANSLATION_KEYS.archive.date),
            t(TRANSLATION_KEYS.archive.class),
            t(TRANSLATION_KEYS.archive.academicYear),
            t(TRANSLATION_KEYS.archive.period),
            t(TRANSLATION_KEYS.archive.status),
            t(TRANSLATION_KEYS.archive.enrollment),
          ]}>
            {data.history.map((item) => (
              <tr key={item.enrollment_id + '-' + String(item.attendance_id ?? 'none') + '-' + String(item.period ?? 'none') + '-' + String(item.attendance_date ?? 'none')} className="border-b border-[var(--sams-border)] last:border-b-0">
                <td className="px-3 py-2">{item.attendance_date ? formatDate(item.attendance_date) : '—'}</td>
                <td className="px-3 py-2">{item.class_name}</td>
                <td className="px-3 py-2">{item.academic_year_name}</td>
                <td className="px-3 py-2">{item.period ?? '—'}</td>
                <td className="px-3 py-2">{attendanceStatus(item.status, t)}</td>
                <td className="px-3 py-2">{formatDate(item.starts_on)}{item.ends_on ? ' → ' + formatDate(item.ends_on) : ''}</td>
              </tr>
            ))}
          </Table>
        )
      )}
    </section>
  )
}

import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS, type TranslationKey } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { useMonthlyReport } from '../../features/reports/useMonthlyReport.ts'
import { AsyncStateFeedback, Button, EmptyState, ErrorState, FormField, Loading, PageHeader, Select, Table } from '../../components/ui/index.ts'

function currentMonth() {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}`
}

export function TeacherReportsPage() {
  const { t, formatNumber } = useI18n()
  const [params, setParams] = useSearchParams()
  const classes = useTeacherClasses()
  const selectedClassId = Number(params.get('class_id') ?? 0) || null
  const month = params.get('month') ?? currentMonth()
  const report = useMonthlyReport(selectedClassId, month)

  const reportData = report.data
  const totals = useMemo(() => {
    if (reportData === null) return null
    return reportData.students.reduce(
      (sum, student) => ({
        present: sum.present + student.present_count,
        absent: sum.absent + student.absent_count,
        late: sum.late + student.late_count,
        excused: sum.excused + student.excused_count,
        recorded: sum.recorded + student.recorded_count,
      }),
      { present: 0, absent: 0, late: 0, excused: 0, recorded: 0 },
    )
  }, [reportData])

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  if (classes.status === 'idle' || classes.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }

  if (classes.status === 'error') {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={classes.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={
          <Button type="button" variant="secondary" onClick={() => void classes.reload()}>
            {t(TRANSLATION_KEYS.system.reload)}
          </Button>
        }
      />
    )
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={t(TRANSLATION_KEYS.teacher.statistics)}
        description={t(TRANSLATION_KEYS.teacher.reportMonth)}
        actions={
          <Button
            type="button"
            variant="secondary"
            className="print:hidden"
            onClick={() => window.print()}
            disabled={selectedClassId === null || report.status !== 'success' || report.data === null}
          >
            {t(TRANSLATION_KEYS.teacher.printReport)}
          </Button>
        }
      />

      {classes.classes.length === 0 ? (
        <EmptyState title={t(TRANSLATION_KEYS.teacher.classes)} description={t(TRANSLATION_KEYS.teacher.noClasses)} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t(TRANSLATION_KEYS.teacher.selectClass)}>
              {({ id }) => (
                <Select
                  id={id}
                  value={selectedClassId ? String(selectedClassId) : ''}
                  onChange={(event) => updateParam('class_id', event.target.value)}
                >
                  <option value="">{t(TRANSLATION_KEYS.teacher.selectClass)}</option>
                  {classes.classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.teacher.reportMonth)}>
              {({ id }) => (
                <input
                  id={id}
                  type="month"
                  value={month}
                  onChange={(event) => updateParam('month', event.target.value)}
                  className="block min-h-11 w-full rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] px-3.5 py-2.5 shadow-sm focus-visible:outline-none focus-visible:border-[var(--sams-focus)] focus-visible:ring-4 focus-visible:ring-[var(--sams-action-soft)]"
                />
              )}
            </FormField>
          </div>

          {selectedClassId === null ? (
            <EmptyState title={t(TRANSLATION_KEYS.teacher.selectClass)} />
          ) : reportData === null ? (
            <AsyncStateFeedback
              state={report}
              loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
              refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
              errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
              genericError={t(TRANSLATION_KEYS.system.genericError)}
              staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
              reloadLabel={t(TRANSLATION_KEYS.system.reload)}
              onRetry={() => void report.reload()}
            />
          ) : (
            <div className="space-y-5">
              <AsyncStateFeedback
                state={report}
                loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
                refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
                errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
                genericError={t(TRANSLATION_KEYS.system.genericError)}
                staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
                reloadLabel={t(TRANSLATION_KEYS.system.reload)}
                onRetry={() => void report.reload()}
              />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {([
                  [TRANSLATION_KEYS.teacher.present, totals?.present ?? 0],
                  [TRANSLATION_KEYS.teacher.absent, totals?.absent ?? 0],
                  [TRANSLATION_KEYS.teacher.late, totals?.late ?? 0],
                  [TRANSLATION_KEYS.teacher.excused, totals?.excused ?? 0],
                  [TRANSLATION_KEYS.teacher.totalRecorded, totals?.recorded ?? 0],
                ] as Array<[TranslationKey, number]>).map(([key, value]) => (
                  <article key={key} className="sams-card p-4">
                    <p className="text-sm text-[var(--sams-muted)]">{t(key)}</p>
                    <p className="mt-1 text-2xl font-semibold">{formatNumber(value as number)}</p>
                  </article>
                ))}
              </div>

              {reportData.students.length === 0 ? (
                <EmptyState title={t(TRANSLATION_KEYS.teacher.noStudents)} />
              ) : (
                <Table
                  caption={t(TRANSLATION_KEYS.teacher.statistics)}
                  headers={[
                    t(TRANSLATION_KEYS.teacher.studentName),
                    t(TRANSLATION_KEYS.teacher.present),
                    t(TRANSLATION_KEYS.teacher.absent),
                    t(TRANSLATION_KEYS.teacher.late),
                    t(TRANSLATION_KEYS.teacher.excused),
                    t(TRANSLATION_KEYS.teacher.totalRecorded),
                  ]}
                >
                  {reportData.students.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-3 py-2 font-medium">{student.first_name} {student.last_name}</td>
                      <td className="px-3 py-2">{formatNumber(student.present_count)}</td>
                      <td className="px-3 py-2">{formatNumber(student.absent_count)}</td>
                      <td className="px-3 py-2">{formatNumber(student.late_count)}</td>
                      <td className="px-3 py-2">{formatNumber(student.excused_count)}</td>
                      <td className="px-3 py-2">{formatNumber(student.recorded_count)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

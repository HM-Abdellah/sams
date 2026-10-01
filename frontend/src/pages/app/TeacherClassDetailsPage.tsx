import { Link, useParams } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { useClassStudents } from '../../features/students/useClassStudents.ts'
import { AsyncStateFeedback, Badge, EmptyState, PageHeader } from '../../components/ui/index.ts'

export function TeacherClassDetailsPage() {
  const { t, formatDate } = useI18n()
  const { classId } = useParams()
  const classes = useTeacherClasses()
  const selectedId = Number(classId ?? 0) || null
  const classInfo = classes.classes.find((item) => item.id === selectedId) ?? null
  const students = useClassStudents(selectedId)
  const studentsState = {
    status: students.status,
    data: students.students.length > 0 ? students.students : null,
    error: students.error,
  } as const

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

  if (classInfo === null) {
    return <EmptyState title={t(TRANSLATION_KEYS.teacher.classDetails)} description={t(TRANSLATION_KEYS.system.notFound)} />
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow={t(TRANSLATION_KEYS.navigation.classes)}
        title={classInfo.name}
        actions={
          <>
            <Link
              to={'/app/students?class_id=' + classInfo.id}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--sams-action)] px-4 text-sm font-semibold text-[var(--sams-action-foreground)] shadow-sm transition hover:bg-[var(--sams-action-hover)]"
            >
              {t(TRANSLATION_KEYS.teacher.openStudents)}
            </Link>
            <Link
              to={'/app/attendance?class_id=' + classInfo.id}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 text-sm font-semibold text-[var(--sams-text)] shadow-sm transition hover:bg-[var(--sams-action-soft)]"
            >
              {t(TRANSLATION_KEYS.teacher.openAttendance)}
            </Link>
          </>
        }
      />

      <section className="sams-card p-5">
        <h2 className="font-semibold">{t(TRANSLATION_KEYS.teacher.classSummary)}</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label={t(TRANSLATION_KEYS.teacher.classLevel)} value={classInfo.level ?? '—'} />
          <Detail label={t(TRANSLATION_KEYS.teacher.classBranch)} value={classInfo.branch ?? '—'} />
          <Detail label={t(TRANSLATION_KEYS.teacher.academicYear)} value={classInfo.academic_year_name ?? '—'} />
          <Detail
            label={t(TRANSLATION_KEYS.teacher.academicYearRange)}
            value={classInfo.academic_year_starts_on && classInfo.academic_year_ends_on
              ? formatDate(classInfo.academic_year_starts_on) + ' → ' + formatDate(classInfo.academic_year_ends_on)
              : '—'}
          />
        </dl>
        <p className="mt-4 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.teachingContext)}</p>
      </section>

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

      {students.students.length === 0 && students.status === 'success' ? (
        <section className="sams-card p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">{t(TRANSLATION_KEYS.teacher.classRoster)}</h2>
            <Badge variant="info">0</Badge>
          </div>
          <p className="mt-4 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.noStudents)}</p>
        </section>
      ) : students.students.length === 0 ? (
        <AsyncStateFeedback
          state={studentsState}
          loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
          refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
          errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
          genericError={t(TRANSLATION_KEYS.system.genericError)}
          staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
          reloadLabel={t(TRANSLATION_KEYS.system.reload)}
          onRetry={() => void students.reload()}
        />
      ) : (
        <>
          <AsyncStateFeedback
            state={studentsState}
            loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
            refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
            errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
            genericError={t(TRANSLATION_KEYS.system.genericError)}
            staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
            reloadLabel={t(TRANSLATION_KEYS.system.reload)}
            onRetry={() => void students.reload()}
          />
          <section className="sams-card p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold">{t(TRANSLATION_KEYS.teacher.classRoster)}</h2>
            <Badge variant="info">{students.students.length}</Badge>
          </div>
          {students.students.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.noStudents)}</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--sams-border)]">
              {students.students.slice(0, 8).map((student) => (
                <li key={student.id} className="flex items-center justify-between gap-4 py-3">
                  <span className="font-medium">{student.first_name} {student.last_name}</span>
                  <span className="text-sm text-[var(--sams-muted)]">{student.student_number ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
          {students.students.length > 8 && (
            <p className="mt-4 text-sm text-[var(--sams-muted)]">{students.students.length - 8} more…</p>
          )}
          </section>
        </>
      )}
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--sams-muted)]">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

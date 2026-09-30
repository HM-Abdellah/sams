import { Link } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { AsyncStateFeedback, EmptyState } from '../../components/ui/index.ts'

export function TeacherClassesPage() {
  const { t, formatDate } = useI18n()
  const classes = useTeacherClasses()

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
    return <EmptyState title={t(TRANSLATION_KEYS.teacher.classes)} description={t(TRANSLATION_KEYS.teacher.noClasses)} />
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t(TRANSLATION_KEYS.navigation.classes)}</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.teachingContext)}</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        {classes.classes.map((item) => (
          <article key={item.id} className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{item.name}</h2>
                <p className="mt-1 text-sm text-[var(--sams-muted)]">
                  {[item.level, item.branch].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Detail label={t(TRANSLATION_KEYS.teacher.academicYear)} value={item.academic_year_name ?? '—'} />
              <Detail
                label={t(TRANSLATION_KEYS.teacher.academicYearRange)}
                value={item.academic_year_starts_on && item.academic_year_ends_on
                  ? formatDate(item.academic_year_starts_on) + ' → ' + formatDate(item.academic_year_ends_on)
                  : '—'}
              />
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={'/app/classes/' + item.id}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--sams-border)] px-4 text-sm font-medium text-[var(--sams-text)]"
              >
                {t(TRANSLATION_KEYS.teacher.viewDetails)}
              </Link>
              <Link
                to={'/app/students?class_id=' + item.id}
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-[var(--sams-border)] px-4 text-sm font-medium text-[var(--sams-text)]"
              >
                {t(TRANSLATION_KEYS.teacher.openStudents)}
              </Link>
              <Link
                to={'/app/attendance?class_id=' + item.id}
                className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--sams-action)] px-4 text-sm font-medium text-[var(--sams-action-foreground)]"
              >
                {t(TRANSLATION_KEYS.teacher.openAttendance)}
              </Link>
            </div>
          </article>
        ))}
      </div>
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

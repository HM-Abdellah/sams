import { Link } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { AsyncStateFeedback, EmptyState, PageHeader } from '../../components/ui/index.ts'

export function TeacherDashboardPage() {
  const { t } = useI18n()
  const classes = useTeacherClasses()
  const firstClass = classes.classes[0]!

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

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="SAMS"
        title={t(TRANSLATION_KEYS.teacher.dashboard)}
        description={t(TRANSLATION_KEYS.teacher.welcome)}
      />

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

      {classes.classes.length === 0 ? (
        <EmptyState
          title={t(TRANSLATION_KEYS.teacher.classes)}
          description={t(TRANSLATION_KEYS.teacher.noClasses)}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Link to="/app/classes" className="sams-card p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.classes)}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{classes.classes.length}</p>
              <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.classesAssigned)}</p>
            </Link>
            <Link to={'/app/attendance?class_id=' + firstClass.id} className="sams-card p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.navigation.attendance)}</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">{t(TRANSLATION_KEYS.teacher.openAttendance)}</p>
              <p className="mt-1 text-sm text-[var(--sams-muted)]">{firstClass.name}</p>
            </Link>
            <Link to={'/app/students?class_id=' + firstClass.id} className="sams-card p-5 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.navigation.students)}</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">{t(TRANSLATION_KEYS.teacher.openStudents)}</p>
              <p className="mt-1 text-sm text-[var(--sams-muted)]">{firstClass.name}</p>
            </Link>
          </div>

          <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t(TRANSLATION_KEYS.teacher.classes)}</h2>
            <p className="text-sm text-[var(--sams-muted)]">
              {classes.classes.length} {t(TRANSLATION_KEYS.teacher.classesAssigned)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {classes.classes.map((item) => (
              <article
                key={item.id}
                className="sams-card overflow-hidden p-5"
              >
                <h3 className="text-lg font-semibold tracking-tight">{item.name}</h3>
                {(item.level || item.branch) && (
                  <p className="mt-1 text-sm text-[var(--sams-muted)]">
                    {[item.level, item.branch].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/app/attendance?class_id=${item.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--sams-action)] px-4 text-sm font-semibold text-[var(--sams-action-foreground)] shadow-sm transition hover:bg-[var(--sams-action-hover)]"
                  >
                    {t(TRANSLATION_KEYS.teacher.openAttendance)}
                  </Link>
                  <Link
                    to={`/app/students?class_id=${item.id}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 text-sm font-semibold text-[var(--sams-text)] shadow-sm transition hover:bg-[var(--sams-action-soft)]"
                  >
                    {t(TRANSLATION_KEYS.teacher.openStudents)}
                  </Link>
                </div>
              </article>
            ))}
          </div>
          </div>
        </div>
      )}
    </section>
  )
}
import { Link } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { Button, EmptyState, ErrorState, Loading } from '../../components/ui/index.ts'

export function TeacherDashboardPage() {
  const { t } = useI18n()
  const classes = useTeacherClasses()

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
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--sams-muted)]">SAMS</p>
        <h1 className="mt-1 text-2xl font-semibold">{t(TRANSLATION_KEYS.teacher.dashboard)}</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.welcome)}</p>
      </header>

      {classes.classes.length === 0 ? (
        <EmptyState
          title={t(TRANSLATION_KEYS.teacher.classes)}
          description={t(TRANSLATION_KEYS.teacher.noClasses)}
        />
      ) : (
        <div className="space-y-3">
          <div>
            <h2 className="font-semibold">{t(TRANSLATION_KEYS.teacher.classes)}</h2>
            <p className="text-sm text-[var(--sams-muted)]">
              {classes.classes.length} {t(TRANSLATION_KEYS.teacher.classesAssigned)}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {classes.classes.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-4"
              >
                <h3 className="font-semibold">{item.name}</h3>
                {(item.level || item.branch) && (
                  <p className="mt-1 text-sm text-[var(--sams-muted)]">
                    {[item.level, item.branch].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/app/attendance?class_id=${item.id}`}
                    className="inline-flex min-h-9 items-center justify-center rounded-md bg-[var(--sams-action)] px-3 text-sm font-medium text-[var(--sams-action-foreground)]"
                  >
                    {t(TRANSLATION_KEYS.teacher.openAttendance)}
                  </Link>
                  <Link
                    to={`/app/students?class_id=${item.id}`}
                    className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--sams-border)] px-3 text-sm font-medium text-[var(--sams-text)]"
                  >
                    {t(TRANSLATION_KEYS.teacher.openStudents)}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { AsyncStateFeedback, EmptyState } from '../../components/ui/index.ts'

export function CounselorDashboardPage() {
  const { t } = useI18n()
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

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-[var(--sams-muted)]">SAMS</p>
        <h1 className="mt-1 text-2xl font-semibold">{t(TRANSLATION_KEYS.counselor.dashboard)}</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.counselor.welcome)}</p>
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

      {classes.classes.length === 0 ? (
        <EmptyState title={t(TRANSLATION_KEYS.counselor.classes)} description={t(TRANSLATION_KEYS.counselor.noClasses)} />
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold">{t(TRANSLATION_KEYS.counselor.classes)}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {classes.classes.map((item) => (
              <article key={item.id} className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-4">
                <h3 className="font-semibold">{item.name}</h3>
                {(item.level || item.branch) && <p className="mt-1 text-sm text-[var(--sams-muted)]">{[item.level, item.branch].filter(Boolean).join(' · ')}</p>}
                {item.academic_year_name && <p className="mt-2 text-sm text-[var(--sams-muted)]">{item.academic_year_name}</p>}
              </article>
            ))}
          </div>
        </div>
      )}

      <p className="rounded-lg border border-dashed border-[var(--sams-border)] p-4 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.counselor.readOnly)}</p>
    </section>
  )
}

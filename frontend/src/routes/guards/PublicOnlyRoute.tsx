import { Navigate, Outlet } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'

export function PublicOnlyRoute() {
  const session = useSession()
  const { t } = useI18n()

  if (session.status === 'loading') {
    return <div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]">{t('auth.loading')}</div>
  }

  if (session.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]">
        <section className="w-full max-w-md rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{t('auth.sessionUnavailable')}</h1>
          <p className="mt-2 text-sm text-[var(--sams-muted)]">{session.error}</p>
          <button type="button" className="mt-4 rounded-md border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 py-2 text-sm" onClick={() => void session.refresh()}>
            {t('system.reload')}
          </button>
        </section>
      </main>
    )
  }

  if (session.status === 'authenticated') {
    return <Navigate to="/app" replace />
  }

  return <Outlet />
}

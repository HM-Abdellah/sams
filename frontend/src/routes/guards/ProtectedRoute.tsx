import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'

export function ProtectedRoute() {
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') {
    return <div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]">Loading…</div>
  }

  if (session.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]">
        <section className="w-full max-w-md rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Session unavailable</h1>
          <p className="mt-2 text-sm text-[var(--sams-muted)]">{session.error}</p>
          <button type="button" className="mt-4 rounded-md border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 py-2 text-sm" onClick={() => void session.refresh()}>
            Retry
          </button>
        </section>
      </main>
    )
  }

  if (session.status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

import { Navigate, Outlet } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'

export function PublicOnlyRoute() {
  const session = useSession()

  if (session.status === 'loading') {
    return <div role="status" aria-live="polite" className="grid min-h-screen place-items-center p-6">Loading…</div>
  }

  if (session.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <section className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Session unavailable</h1>
          <p className="mt-2 text-sm text-neutral-600">{session.error}</p>
          <button type="button" className="mt-4 rounded-md border px-4 py-2 text-sm" onClick={() => void session.refresh()}>
            Retry
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

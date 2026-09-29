import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'

export function AppShell() {
  const session = useSession()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  if (session.user === null) return null

  const links = session.user.role === 'admin'
    ? [{ to: '/app/admin', label: 'Administration' }]
    : session.user.role === 'teacher'
      ? [{ to: '/app/teacher', label: 'Teacher workspace' }]
      : []

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SAMS</p>
            <p className="font-medium">{session.user.full_name}</p>
          </div>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true)
              try {
                await session.logout()
                navigate('/login', { replace: true })
              } finally {
                setLoggingOut(false)
              }
            }}
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>
      <nav aria-label="Application" className="border-b bg-white dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl gap-4 px-6 py-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => isActive ? 'font-medium underline' : 'text-neutral-600'}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

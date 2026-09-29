import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'
import { navigationForRole } from '../../routes/route-config.ts'
import { Button } from '../ui/Button.tsx'

export function AppShell() {
  const session = useSession()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)

  if (session.user === null) return null

  const links = navigationForRole(session.user.role)

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SAMS</p>
            <p className="font-medium">{session.user.full_name}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={loggingOut}
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
            Sign out
          </Button>
        </div>
      </header>
      <nav aria-label="Application" className="border-b bg-white dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl gap-4 px-6 py-3">
          {links.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
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

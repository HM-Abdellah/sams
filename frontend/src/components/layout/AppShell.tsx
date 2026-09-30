import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'
import { navigationForRole } from '../../routes/route-config.ts'
import { Button } from '../ui/Button.tsx'
import { onAttendancePendingWork } from '../../features/attendance/pendingWork.ts'
import { LanguageSelect } from '../ui/LanguageSelect.tsx'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'

export function AppShell() {
  const session = useSession()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loggingOut, setLoggingOut] = useState(false)
  const [attendancePendingWork, setAttendancePendingWork] = useState(false)

  useEffect(() => onAttendancePendingWork(setAttendancePendingWork), [])

  if (session.user === null) return null

  const links = navigationForRole(session.user.role)

  return (
    <div className="min-h-screen bg-[var(--sams-background)]">
      <header className="border-b border-[var(--sams-border)] bg-[var(--sams-surface)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sams-muted)]">SAMS</p>
            <p className="truncate text-sm font-medium text-[var(--sams-text)]">{session.user.full_name}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSelect />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={loggingOut}
              disabled={attendancePendingWork || loggingOut}
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
              {t(TRANSLATION_KEYS.app.signOut)}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b border-[var(--sams-border)] bg-[var(--sams-surface)] md:border-b-0 md:border-e">
          <nav
            aria-label={t(TRANSLATION_KEYS.app.application)}
            className="min-w-0 overflow-x-auto md:sticky md:top-0 md:max-h-screen md:overflow-y-auto md:px-3 md:py-5"
          >
            <div className="flex min-w-max gap-1 px-4 py-3 sm:px-6 md:min-w-0 md:flex-col md:px-0 md:py-0">
              {links.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) => [
                    'rounded-md px-3 py-2 text-sm transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sams-focus)]',
                    isActive
                      ? 'border-s-2 border-[var(--sams-text)] bg-[var(--sams-muted-surface)] ps-2 font-semibold text-[var(--sams-text)]'
                      : 'text-[var(--sams-muted)] hover:bg-[var(--sams-muted-surface)] hover:text-[var(--sams-text)]',
                  ].join(' ')}
                >
                  {t(link.label)}
                </NavLink>
              ))}
            </div>
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )}

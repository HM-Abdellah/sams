import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'
import { navigationForRole } from '../../routes/route-config.ts'
import { Button } from '../ui/Button.tsx'
import { onAttendancePendingWork } from '../../features/attendance/pendingWork.ts'
import { LanguageSelect } from '../ui/LanguageSelect.tsx'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS, type TranslationKey } from '../../features/i18n/types.ts'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

type AdminSection = {
  label: TranslationKey
  paths: string[]
}

const ADMIN_SECTIONS: AdminSection[] = [
  {
    label: TRANSLATION_KEYS.admin.overview,
    paths: ['/app/admin/dashboard'],
  },
  {
    label: TRANSLATION_KEYS.admin.people,
    paths: ['/app/admin/classes', '/app/admin/teachers', '/app/admin/users', '/app/admin/onboarding'],
  },
  {
    label: TRANSLATION_KEYS.admin.operations,
    paths: ['/app/admin/academic-years', '/app/admin/imports', '/app/admin/archive', '/app/admin/audit'],
  },
]

function navIcon(path: string) {
  const common = {
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'size-4 shrink-0',
    'aria-hidden': true,
  }

  if (path.endsWith('/dashboard')) {
    return <svg {...common}><rect x="2.5" y="2.5" width="6" height="6" rx="1" /><rect x="11.5" y="2.5" width="6" height="6" rx="1" /><rect x="2.5" y="11.5" width="6" height="6" rx="1" /><rect x="11.5" y="11.5" width="6" height="6" rx="1" /></svg>
  }
  if (path.endsWith('/classes')) {
    return <svg {...common}><path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" /><path d="m3 10 7 3.5 7-3.5M3 13.5 10 17l7-3.5" /></svg>
  }
  if (path.endsWith('/teachers') || path.endsWith('/users')) {
    return <svg {...common}><circle cx="10" cy="6" r="3" /><path d="M4 17c.6-3.1 2.5-4.7 6-4.7s5.4 1.6 6 4.7" /></svg>
  }
  if (path.endsWith('/onboarding')) {
    return <svg {...common}><path d="M3 6.5h5l1.5 2H17v7H3v-9Z" /><path d="m7.5 12 1.7 1.7 3.3-3.3" /></svg>
  }
  if (path.endsWith('/academic-years')) {
    return <svg {...common}><rect x="3" y="4.5" width="14" height="12" rx="1.5" /><path d="M6 2.5v4M14 2.5v4M3 8h14" /></svg>
  }
  if (path.endsWith('/imports')) {
    return <svg {...common}><path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" /><path d="M4 13.5V16h12v-2.5" /></svg>
  }
  if (path.endsWith('/archive')) {
    return <svg {...common}><path d="M3 5h14v3H3zM4.5 8v8.5h11V8M7 11h6" /></svg>
  }
  if (path.endsWith('/audit')) {
    return <svg {...common}><path d="M10 2.5 16 5v4.2c0 3.9-2.4 6.5-6 8.3-3.6-1.8-6-4.4-6-8.3V5l6-2.5Z" /><path d="M7.5 10h5M10 7.5v5" /></svg>
  }

  return <svg {...common}><circle cx="10" cy="10" r="7" /></svg>
}

function AdminNavigation({ links, t }: { links: ReturnType<typeof navigationForRole>; t: (key: TranslationKey) => string }) {
  const byPath = new Map(links.map((link) => [link.path, link]))
  return (
    <div className="space-y-5">
      {ADMIN_SECTIONS.map((section) => (
        <section key={section.label}>
          <p className="mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--sams-muted)]">
            {t(section.label)}
          </p>
          <div className="space-y-1">
            {section.paths.map((path) => {
              const link = byPath.get(path)
              if (!link) return null
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) => [
                    'group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,transform] duration-150',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]',
                    isActive
                      ? 'bg-[var(--sams-action-soft)] text-[var(--sams-text)] shadow-[inset_3px_0_0_var(--sams-focus)]'
                      : 'text-[var(--sams-muted)] hover:bg-[var(--sams-muted-surface)] hover:text-[var(--sams-text)]',
                  ].join(' ')}
                >
                  {navIcon(path)}
                  <span className="truncate">{t(link.label)}</span>
                </NavLink>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function StandardNavigation({
  links,
  t,
  attendancePendingWork,
}: {
  links: ReturnType<typeof navigationForRole>
  t: (key: TranslationKey) => string
  attendancePendingWork: boolean
}) {
  return (
    <div className="flex min-w-max gap-1 px-4 py-3 sm:px-6 lg:min-w-0 lg:flex-col lg:px-0 lg:py-0">
      {links.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) => [
            'relative rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]',
            isActive
              ? 'bg-[var(--sams-action-soft)] text-[var(--sams-action)]'
              : 'text-[var(--sams-muted)] hover:bg-[var(--sams-muted-surface)] hover:text-[var(--sams-text)]',
          ].join(' ')}
        >
          {link.label === 'navigation.attendance' && attendancePendingWork && (
            <span aria-label={t(TRANSLATION_KEYS.attendance.unsavedChanges)} className="absolute end-2 top-2 size-2 rounded-full bg-[var(--sams-warning)]" />
          )}
          {t(link.label)}
        </NavLink>
      ))}
    </div>
  )
}

export function AppShell() {
  const session = useSession()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loggingOut, setLoggingOut] = useState(false)
  const [attendancePendingWork, setAttendancePendingWork] = useState(false)

  useEffect(() => onAttendancePendingWork(setAttendancePendingWork), [])

  if (session.user === null) return null

  const links = navigationForRole(session.user.role)
  const isAdmin = session.user.role === 'admin'

  return (
    <div className="sams-app-bg min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--sams-border)] bg-[color-mix(in_srgb,var(--sams-surface)_94%,transparent)] backdrop-blur-xl">
        <div className={"mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 " + (isAdmin ? 'lg:px-8' : '')}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--sams-action)] text-sm font-bold text-white shadow-sm">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-[var(--sams-text)]">SAMS</p>
              <p className="truncate text-xs text-[var(--sams-muted)]">{session.user.full_name}</p>
            </div>
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

      <div className={"mx-auto grid max-w-[90rem] " + (isAdmin ? 'lg:grid-cols-[17rem_minmax(0,1fr)]' : 'lg:grid-cols-[16rem_minmax(0,1fr)]')}>
        <aside className="min-w-0 border-b border-[var(--sams-border)] bg-[color-mix(in_srgb,var(--sams-surface)_88%,transparent)] lg:sticky lg:top-[65px] lg:h-[calc(100vh-65px)] lg:border-b-0 lg:border-e">
          <div className="hidden border-b border-[var(--sams-border)] p-4 lg:block">
            <div className="rounded-2xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-3.5 shadow-[0_6px_18px_rgba(22,32,51,0.035)]">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--sams-action-soft)] text-xs font-bold text-[var(--sams-action)]">
                  {initials(session.user.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{session.user.full_name}</p>
                  <p className="text-xs capitalize text-[var(--sams-muted)]">{session.user.role}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="mt-3 border-t border-[var(--sams-border)] pt-3 text-xs text-[var(--sams-muted)]">
                  <span className="font-medium text-[var(--sams-text)]">SAMS</span> · {t(TRANSLATION_KEYS.admin.people)}
                </div>
              )}
            </div>
          </div>

          <nav
            aria-label={t(TRANSLATION_KEYS.app.application)}
            className="sams-scroll-surface overflow-x-auto lg:h-[calc(100vh-154px)] lg:overflow-y-auto lg:px-3 lg:py-4"
          >
            {isAdmin ? (
              <div className="hidden lg:block">
                <AdminNavigation links={links} t={t} />
              </div>
            ) : null}
            <div className={isAdmin ? 'lg:hidden' : undefined}>
              <StandardNavigation
                links={links}
                t={t}
                attendancePendingWork={attendancePendingWork}
              />
            </div>
          </nav>
        </aside>

        <main className={"min-w-0 px-4 py-6 sm:px-6 sm:py-8 " + (isAdmin ? 'lg:px-9 lg:py-9' : 'lg:px-8')}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

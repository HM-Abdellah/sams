import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'
import {
  navigationForRole,
  navigationSectionsForRole,
  type AppRouteDefinition,
} from '../../routes/route-config.ts'
import { Button, Drawer } from '../ui/index.ts'
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

  if (path.endsWith('/dashboard') || path === '/app/teacher' || path === '/app/counselor') {
    return <svg {...common}><rect x="2.5" y="2.5" width="6" height="6" rx="1" /><rect x="11.5" y="2.5" width="6" height="6" rx="1" /><rect x="2.5" y="11.5" width="6" height="6" rx="1" /><rect x="11.5" y="11.5" width="6" height="6" rx="1" /></svg>
  }
  if (path.endsWith('/classes')) {
    return <svg {...common}><path d="M3 6.5 10 3l7 3.5-7 3.5-7-3.5Z" /><path d="m3 10 7 3.5 7-3.5M3 13.5 10 17l7-3.5" /></svg>
  }
  if (path.endsWith('/teachers') || path.endsWith('/users') || path.endsWith('/students')) {
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
  if (path.endsWith('/attendance')) {
    return <svg {...common}><path d="M4 3.5h12v13H4z" /><path d="M7 7h6M7 10h6M7 13h3" /></svg>
  }
  if (path.endsWith('/signatures')) {
    return <svg {...common}><path d="M4 14.5c2.5 0 3.5-5.5 5.5-5.5 1.5 0 0 4.5 1.5 4.5 1.3 0 2.2-2 3.2-2s.4 3 1.8 3c.5 0 1-.2 1.5-.5" /><path d="M4 17h12" /></svg>
  }
  if (path.endsWith('/reports')) {
    return <svg {...common}><path d="M4 16V9M8 16V5M12 16v-3M16 16V3" /></svg>
  }

  return <svg {...common}><circle cx="10" cy="10" r="7" /></svg>
}

function NavigationLink({
  link,
  t,
  attendancePendingWork,
  onNavigate,
}: {
  link: AppRouteDefinition
  t: (key: TranslationKey) => string
  attendancePendingWork: boolean
  onNavigate: (() => void) | undefined
}) {
  return (
    <NavLink
      to={link.path}
      onClick={() => onNavigate?.()}
      className={({ isActive }) => [
        'group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-[background-color,color,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--sams-info-surface)]',
        isActive
          ? 'bg-[var(--sams-action-soft)] text-[var(--sams-text)] shadow-[inset_3px_0_0_var(--sams-focus)]'
          : 'text-[var(--sams-muted)] hover:bg-[var(--sams-muted-surface)] hover:text-[var(--sams-text)]',
      ].join(' ')}
    >
      {navIcon(link.path)}
      <span className="truncate">{t(link.label)}</span>
      {link.label === 'navigation.attendance' && attendancePendingWork && (
        <span
          aria-label={t(TRANSLATION_KEYS.attendance.unsavedChanges)}
          className="ms-auto size-2 shrink-0 rounded-full bg-[var(--sams-warning)]"
        />
      )}
    </NavLink>
  )
}

function RoleNavigation({
  role,
  t,
  attendancePendingWork,
  onNavigate,
}: {
  role: Parameters<typeof navigationSectionsForRole>[0]
  t: (key: TranslationKey) => string
  attendancePendingWork: boolean
  onNavigate?: () => void
}) {
  const sections = navigationSectionsForRole(role)
  const showSectionLabels = sections.length > 1

  return (
    <div className="space-y-5">
      {sections.map((section, index) => (
        <section key={section.label ?? 'section-' + index}>
          {showSectionLabels && section.label && (
            <p className="mb-2 px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[var(--sams-muted)]">
              {t(section.label)}
            </p>
          )}
          <div className="space-y-1">
            {section.routes.map((link) => (
              <NavigationLink
                key={link.path}
                link={link}
                t={t}
                attendancePendingWork={attendancePendingWork}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function currentNavigationLabel(
  pathname: string,
  links: readonly AppRouteDefinition[],
  t: (key: TranslationKey) => string,
) {
  const match = links
    .filter((link) => pathname === link.path || pathname.startsWith(link.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]

  return match ? t(match.label) : t(TRANSLATION_KEYS.app.application)
}

function roleWorkspaceLabel(
  role: 'admin' | 'teacher' | 'counselor',
  t: (key: TranslationKey) => string,
) {
  if (role === 'teacher') return t(TRANSLATION_KEYS.teacher.dashboard)
  if (role === 'counselor') return t(TRANSLATION_KEYS.counselor.dashboard)
  return t(TRANSLATION_KEYS.admin.overview)
}

export function AppShell() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useI18n()
  const [loggingOut, setLoggingOut] = useState(false)
  const [attendancePendingWork, setAttendancePendingWork] = useState(false)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  useEffect(() => onAttendancePendingWork(setAttendancePendingWork), [])
  useEffect(() => setMobileNavigationOpen(false), [location.pathname])

  const links = navigationForRole(session.user?.role ?? 'teacher')
  const currentLabel = useMemo(
    () => currentNavigationLabel(location.pathname, links, t),
    [links, location.pathname, t],
  )

  if (session.user === null) return null

  const workspaceLabel = roleWorkspaceLabel(session.user.role, t)

  return (
    <div className="sams-app-bg min-h-screen">
      <header className="sticky top-0 z-30 min-h-[var(--sams-app-header-height)] border-b border-[var(--sams-border)] bg-[color-mix(in_srgb,var(--sams-surface)_94%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-[var(--sams-app-header-height)] max-w-[var(--sams-app-shell-max)] items-center justify-between gap-3 px-[var(--sams-page-gutter)]">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              aria-label={t(TRANSLATION_KEYS.app.openNavigation)}
              aria-expanded={mobileNavigationOpen}
              aria-controls="sams-mobile-navigation"
              onClick={() => setMobileNavigationOpen(true)}
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" className="size-4">
                <path d="M3 5h14M3 10h14M3 15h14" />
              </svg>
            </Button>
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--sams-action)] text-sm font-bold text-white shadow-sm">
              SA
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-[var(--sams-text)]">SAMS</p>
              <p className="truncate text-xs text-[var(--sams-muted)]">{currentLabel}</p>
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

      <div className="mx-auto grid max-w-[var(--sams-app-shell-max)] lg:grid-cols-[var(--sams-app-sidebar-width)_minmax(0,1fr)]">
        <aside className="hidden min-w-0 flex-col border-e border-[var(--sams-border)] bg-[color-mix(in_srgb,var(--sams-surface)_88%,transparent)] lg:sticky lg:top-[var(--sams-app-header-height)] lg:flex lg:h-[calc(100dvh-var(--sams-app-header-height))]">
          <div className="shrink-0 border-b border-[var(--sams-border)] p-4">
            <div className="rounded-[var(--sams-radius-elevated)] border border-[var(--sams-border)] bg-[var(--sams-surface)] p-3.5 shadow-[0_6px_18px_rgba(22,32,51,0.035)]">
              <div className="flex items-center gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--sams-action-soft)] text-xs font-bold text-[var(--sams-action)]">
                  {initials(session.user.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{session.user.full_name}</p>
                  <p className="truncate text-xs text-[var(--sams-muted)]">{workspaceLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <nav
            aria-label={t(TRANSLATION_KEYS.app.application)}
            className="sams-scroll-surface min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4"
          >
            <RoleNavigation
              role={session.user.role}
              t={t}
              attendancePendingWork={attendancePendingWork}
            />
          </nav>
        </aside>

        <main className="min-w-0 w-full max-w-[var(--sams-content-max)] px-[var(--sams-page-gutter)] py-6 sm:py-8">
          <Outlet />
        </main>
      </div>

      <Drawer
        open={mobileNavigationOpen}
        title="SAMS"
        description={workspaceLabel}
        side="start"
        closeLabel={t(TRANSLATION_KEYS.app.closeNavigation)}
        onClose={() => setMobileNavigationOpen(false)}
      >
        <nav id="sams-mobile-navigation" aria-label={t(TRANSLATION_KEYS.app.application)}>
          <RoleNavigation
            role={session.user.role}
            t={t}
            attendancePendingWork={attendancePendingWork}
            onNavigate={() => setMobileNavigationOpen(false)}
          />
        </nav>
      </Drawer>
    </div>
  )
}
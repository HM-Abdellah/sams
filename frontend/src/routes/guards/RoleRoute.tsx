import { Navigate, Outlet } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import type { UserRole } from '../../services/api/types.ts'

interface RoleRouteProps {
  roles: readonly UserRole[]
}

export function RoleRoute({ roles }: RoleRouteProps) {
  const session = useSession()
  const { t } = useI18n()

  if (session.status === 'loading') {
    return <div role="status" aria-live="polite" className="grid min-h-screen place-items-center p-6">{t('auth.loading')}</div>
  }

  if (session.status === 'anonymous' || session.user === null) {
    return <Navigate to="/login" replace />
  }

  return roles.includes(session.user.role) ? <Outlet /> : <Navigate to="/unauthorized" replace />
}

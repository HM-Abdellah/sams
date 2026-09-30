import { Navigate } from 'react-router'
import { useSession } from '../../features/auth/useSession.ts'

export function WorkspaceLandingPage() {
  const session = useSession()

  if (session.user === null) return null

  if (session.user.role === 'admin') {
    return <Navigate to="/app/admin/dashboard" replace />
  }

  if (session.user.role === 'teacher') {
    return <Navigate to="/app/teacher" replace />
  }

  if (session.user.role === 'counselor') {
    return <Navigate to="/app/counselor" replace />
  }

  return <Navigate to="/unauthorized" replace />
}

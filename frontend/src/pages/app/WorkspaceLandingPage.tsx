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

  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">SAMS</p>
      <h1 className="mt-1 text-2xl font-semibold">Counselor workspace</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Your role is authenticated. Feature modules for this workspace will be connected later.
      </p>
    </section>
  )
}

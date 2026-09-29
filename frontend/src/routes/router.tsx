import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppShell } from '../components/layout/AppShell.tsx'
import { AdminPage } from '../pages/admin/AdminPage.tsx'
import { LoginPage } from '../pages/auth/LoginPage.tsx'
import { OnboardingPage } from '../pages/onboarding/OnboardingPage.tsx'
import { TeacherPage } from '../pages/teacher/TeacherPage.tsx'
import { WorkspaceLandingPage } from '../pages/app/WorkspaceLandingPage.tsx'
import { PublicOnlyRoute } from './guards/PublicOnlyRoute.tsx'
import { ProtectedRoute } from './guards/ProtectedRoute.tsx'
import { RoleRoute } from './guards/RoleRoute.tsx'

const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/app', element: <WorkspaceLandingPage /> },
          {
            element: <RoleRoute roles={['teacher']} />,
            children: [{ path: '/app/teacher', element: <TeacherPage /> }],
          },
          {
            element: <RoleRoute roles={['admin']} />,
            children: [{ path: '/app/admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '*', element: <Navigate to="/app" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

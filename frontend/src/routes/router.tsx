import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppShell } from '../components/layout/AppShell.tsx'
import { LoginPage } from '../pages/auth/LoginPage.tsx'
import { OnboardingPage } from '../pages/onboarding/OnboardingPage.tsx'
import { OnboardingStatusPage } from '../pages/onboarding/OnboardingStatusPage.tsx'
import { OnboardingActivatePage } from '../pages/onboarding/OnboardingActivatePage.tsx'
import { FeaturePlaceholderPage } from '../pages/app/FeaturePlaceholderPage.tsx'
import { TeacherAttendancePage } from '../pages/app/TeacherAttendancePage.tsx'
import { TeacherStudentsPage } from '../pages/app/TeacherStudentsPage.tsx'
import { TeacherSignaturesPage } from '../pages/app/TeacherSignaturesPage.tsx'
import { TeacherReportsPage } from '../pages/app/TeacherReportsPage.tsx'
import { TeacherDashboardPage } from '../pages/app/TeacherDashboardPage.tsx'
import { WorkspaceLandingPage } from '../pages/app/WorkspaceLandingPage.tsx'
import { PublicOnlyRoute } from './guards/PublicOnlyRoute.tsx'
import { ProtectedRoute } from './guards/ProtectedRoute.tsx'
import { RoleRoute } from './guards/RoleRoute.tsx'
import { NotFoundPage } from '../pages/system/NotFoundPage.tsx'
import { UnauthorizedPage } from '../pages/system/UnauthorizedPage.tsx'
import { RouteErrorPage } from '../pages/system/RouteErrorPage.tsx'

const adminPlaceholder = (title: string) => (
  <FeaturePlaceholderPage
    title={title}
    description="Administrative feature implementation is scheduled for a later engineering phase."
  />
)

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '/onboarding/status', element: <OnboardingStatusPage /> },
      { path: '/onboarding/activate', element: <OnboardingActivatePage /> },
    ],
  },
  {
    errorElement: <RouteErrorPage />,
    element: <ProtectedRoute />,
    children: [
      { path: '/unauthorized', element: <UnauthorizedPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/app', element: <WorkspaceLandingPage /> },
          {
            element: <RoleRoute roles={['teacher']} />,
            children: [
              { path: '/app/teacher', element: <TeacherDashboardPage /> },
              { path: '/app/attendance', element: <TeacherAttendancePage /> },
              { path: '/app/students', element: <TeacherStudentsPage /> },
              { path: '/app/signatures', element: <TeacherSignaturesPage /> },
              { path: '/app/reports', element: <TeacherReportsPage /> },
            ],
          },
          {
            element: <RoleRoute roles={['admin']} />,
            children: [
              { path: '/app/admin', element: <Navigate to="/app/admin/dashboard" replace /> },
              { path: '/app/admin/dashboard', element: adminPlaceholder('Dashboard') },
              { path: '/app/admin/classes', element: adminPlaceholder('Classes') },
              { path: '/app/admin/teachers', element: adminPlaceholder('Teachers') },
              { path: '/app/admin/users', element: adminPlaceholder('Users') },
              { path: '/app/admin/onboarding', element: adminPlaceholder('Onboarding') },
              { path: '/app/admin/academic-years', element: adminPlaceholder('Academic years') },
              { path: '/app/admin/imports', element: adminPlaceholder('Imports') },
              { path: '/app/admin/archive', element: adminPlaceholder('Archive') },
              { path: '/app/admin/audit', element: adminPlaceholder('Audit') },
            ],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '*', element: <NotFoundPage /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppShell } from '../components/layout/AppShell.tsx'
import { PublicOnlyRoute } from './guards/PublicOnlyRoute.tsx'
import { ProtectedRoute } from './guards/ProtectedRoute.tsx'
import { RoleRoute } from './guards/RoleRoute.tsx'
import { NotFoundPage } from '../pages/system/NotFoundPage.tsx'
import { UnauthorizedPage } from '../pages/system/UnauthorizedPage.tsx'
import { RouteErrorPage } from '../pages/system/RouteErrorPage.tsx'

const basename = import.meta.env.BASE_URL.replace(/\/+$/, '') || undefined
const routerOptions = basename === undefined ? {} : { basename }

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', lazy: () => import('../pages/auth/LoginPage.tsx').then((module) => ({ Component: module.LoginPage })) },
      { path: '/onboarding', lazy: () => import('../pages/onboarding/OnboardingPage.tsx').then((module) => ({ Component: module.OnboardingPage })) },
      { path: '/onboarding/status', lazy: () => import('../pages/onboarding/OnboardingStatusPage.tsx').then((module) => ({ Component: module.OnboardingStatusPage })) },
      { path: '/onboarding/activate', lazy: () => import('../pages/onboarding/OnboardingActivatePage.tsx').then((module) => ({ Component: module.OnboardingActivatePage })) },
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
          { path: '/app', lazy: () => import('../pages/app/WorkspaceLandingPage.tsx').then((module) => ({ Component: module.WorkspaceLandingPage })) },
          {
            element: <RoleRoute roles={['teacher']} />,
            children: [
              { path: '/app/teacher', lazy: () => import('../pages/app/TeacherDashboardPage.tsx').then((module) => ({ Component: module.TeacherDashboardPage })) },
              { path: '/app/attendance', lazy: () => import('../pages/app/TeacherAttendancePage.tsx').then((module) => ({ Component: module.TeacherAttendancePage })) },
              { path: '/app/classes', lazy: () => import('../pages/app/TeacherClassesPage.tsx').then((module) => ({ Component: module.TeacherClassesPage })) },
              { path: '/app/classes/:classId', lazy: () => import('../pages/app/TeacherClassDetailsPage.tsx').then((module) => ({ Component: module.TeacherClassDetailsPage })) },
              { path: '/app/students', lazy: () => import('../pages/app/TeacherStudentsPage.tsx').then((module) => ({ Component: module.TeacherStudentsPage })) },
              { path: '/app/signatures', lazy: () => import('../pages/app/TeacherSignaturesPage.tsx').then((module) => ({ Component: module.TeacherSignaturesPage })) },
              { path: '/app/reports', lazy: () => import('../pages/app/TeacherReportsPage.tsx').then((module) => ({ Component: module.TeacherReportsPage })) },
            ],
          },
          {
            element: <RoleRoute roles={['counselor']} />,
            children: [
              { path: '/app/counselor', lazy: () => import('../pages/app/CounselorDashboardPage.tsx').then((module) => ({ Component: module.CounselorDashboardPage })) },
            ],
          },
          {
            element: <RoleRoute roles={['admin']} />,
            children: [
              { path: '/app/admin', element: <Navigate to="/app/admin/dashboard" replace /> },
              { path: '/app/admin/dashboard', lazy: () => import('../pages/app/AdminDashboardPage.tsx').then((module) => ({ Component: module.AdminDashboardPage })) },
              { path: '/app/admin/classes', lazy: () => import('../pages/app/AdminClassesPage.tsx').then((module) => ({ Component: module.AdminClassesPage })) },
              { path: '/app/admin/teachers', lazy: () => import('../pages/app/AdminTeachersPage.tsx').then((module) => ({ Component: module.AdminTeachersPage })) },
              { path: '/app/admin/users', lazy: () => import('../pages/app/AdminUsersPage.tsx').then((module) => ({ Component: module.AdminUsersPage })) },
              { path: '/app/admin/onboarding', lazy: () => import('../pages/app/AdminOnboardingPage.tsx').then((module) => ({ Component: module.AdminOnboardingPage })) },
              { path: '/app/admin/academic-years', lazy: () => import('../pages/app/AdminAcademicYearsPage.tsx').then((module) => ({ Component: module.AdminAcademicYearsPage })) },
              { path: '/app/admin/imports', lazy: () => import('../pages/app/AdminImportsPage.tsx').then((module) => ({ Component: module.AdminImportsPage })) },
              { path: '/app/admin/archive', lazy: () => import('../pages/app/AdminArchivePage.tsx').then((module) => ({ Component: module.AdminArchivePage })) },
              { path: '/app/admin/audit', lazy: () => import('../pages/app/AdminAuditPage.tsx').then((module) => ({ Component: module.AdminAuditPage })) },
            ],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/app" replace /> },
  { path: '*', element: <NotFoundPage /> },
], routerOptions)

export function AppRouter() {
  return <RouterProvider router={router} />
}

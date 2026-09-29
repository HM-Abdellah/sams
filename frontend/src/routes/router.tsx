import { createBrowserRouter, Navigate } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { LoginPage } from '../pages/auth/LoginPage.tsx'
import { OnboardingPage } from '../pages/onboarding/OnboardingPage.tsx'
import { AdminPage } from '../pages/admin/AdminPage.tsx'
import { TeacherPage } from '../pages/teacher/TeacherPage.tsx'

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/teacher', element: <TeacherPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '*', element: <Navigate to="/login" replace /> },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}

import type { UserRole } from '../services/api/types.ts'

export interface AppRouteDefinition {
  path: string
  label: string
  roles: readonly UserRole[]
}

export const TEACHER_ROUTES = [
  { path: '/app/attendance', label: 'Attendance', roles: ['teacher'] },
  { path: '/app/students', label: 'Students', roles: ['teacher'] },
  { path: '/app/signatures', label: 'Signatures', roles: ['teacher'] },
  { path: '/app/reports', label: 'Reports', roles: ['teacher'] },
] as const satisfies readonly AppRouteDefinition[]

export const ADMIN_ROUTES = [
  { path: '/app/admin/dashboard', label: 'Dashboard', roles: ['admin'] },
  { path: '/app/admin/classes', label: 'Classes', roles: ['admin'] },
  { path: '/app/admin/teachers', label: 'Teachers', roles: ['admin'] },
  { path: '/app/admin/users', label: 'Users', roles: ['admin'] },
  { path: '/app/admin/onboarding', label: 'Onboarding', roles: ['admin'] },
  { path: '/app/admin/academic-years', label: 'Academic years', roles: ['admin'] },
  { path: '/app/admin/imports', label: 'Imports', roles: ['admin'] },
  { path: '/app/admin/archive', label: 'Archive', roles: ['admin'] },
  { path: '/app/admin/audit', label: 'Audit', roles: ['admin'] },
] as const satisfies readonly AppRouteDefinition[]

export function navigationForRole(role: UserRole): readonly AppRouteDefinition[] {
  if (role === 'teacher') return TEACHER_ROUTES
  if (role === 'admin') return ADMIN_ROUTES
  return []
}

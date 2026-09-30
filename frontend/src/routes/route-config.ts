import type { TranslationKey } from '../features/i18n/types.ts'
import type { UserRole } from '../services/api/types.ts'

export interface AppRouteDefinition {
  path: string
  label: TranslationKey
  roles: readonly UserRole[]
}

export const COUNSELOR_ROUTES = [
  { path: '/app/counselor', label: 'counselor.dashboard', roles: ['counselor'] },
] as const satisfies readonly AppRouteDefinition[]

export const TEACHER_ROUTES = [
  { path: '/app/teacher', label: 'teacher.dashboard', roles: ['teacher'] },
  { path: '/app/classes', label: 'navigation.classes', roles: ['teacher'] },
  { path: '/app/attendance', label: 'navigation.attendance', roles: ['teacher'] },
  { path: '/app/students', label: 'navigation.students', roles: ['teacher'] },
  { path: '/app/signatures', label: 'navigation.signatures', roles: ['teacher'] },
  { path: '/app/reports', label: 'navigation.reports', roles: ['teacher'] },
] as const satisfies readonly AppRouteDefinition[]

export const ADMIN_ROUTES = [
  { path: '/app/admin/dashboard', label: 'navigation.dashboard', roles: ['admin'] },
  { path: '/app/admin/classes', label: 'navigation.classes', roles: ['admin'] },
  { path: '/app/admin/teachers', label: 'navigation.teachers', roles: ['admin'] },
  { path: '/app/admin/users', label: 'navigation.users', roles: ['admin'] },
  { path: '/app/admin/onboarding', label: 'navigation.onboarding', roles: ['admin'] },
  { path: '/app/admin/academic-years', label: 'navigation.academicYears', roles: ['admin'] },
  { path: '/app/admin/imports', label: 'navigation.imports', roles: ['admin'] },
  { path: '/app/admin/archive', label: 'navigation.archive', roles: ['admin'] },
  { path: '/app/admin/audit', label: 'navigation.audit', roles: ['admin'] },
] as const satisfies readonly AppRouteDefinition[]

export function navigationForRole(role: UserRole): readonly AppRouteDefinition[] {
  if (role === 'teacher') return TEACHER_ROUTES
  if (role === 'admin') return ADMIN_ROUTES
  if (role === 'counselor') return COUNSELOR_ROUTES
  return []
}

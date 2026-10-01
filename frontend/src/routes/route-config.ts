import type { TranslationKey } from '../features/i18n/types.ts'
import type { UserRole } from '../services/api/types.ts'

export interface AppRouteDefinition {
  path: string
  label: TranslationKey
  roles: readonly UserRole[]
  section?: TranslationKey
}

export const COUNSELOR_ROUTES = [
  { path: '/app/counselor', label: 'counselor.dashboard', roles: ['counselor'], section: 'navigation.workspace' },
] as const satisfies readonly AppRouteDefinition[]

export const TEACHER_ROUTES = [
  { path: '/app/teacher', label: 'teacher.dashboard', roles: ['teacher'], section: 'navigation.workspace' },
  { path: '/app/classes', label: 'navigation.classes', roles: ['teacher'], section: 'navigation.workspace' },
  { path: '/app/attendance', label: 'navigation.attendance', roles: ['teacher'], section: 'navigation.workspace' },
  { path: '/app/students', label: 'navigation.students', roles: ['teacher'], section: 'navigation.records' },
  { path: '/app/signatures', label: 'navigation.signatures', roles: ['teacher'], section: 'navigation.records' },
  { path: '/app/reports', label: 'navigation.reports', roles: ['teacher'], section: 'navigation.records' },
] as const satisfies readonly AppRouteDefinition[]

export const ADMIN_ROUTES = [
  { path: '/app/admin/dashboard', label: 'navigation.dashboard', roles: ['admin'], section: 'admin.overview' },
  { path: '/app/admin/classes', label: 'navigation.classes', roles: ['admin'], section: 'admin.people' },
  { path: '/app/admin/teachers', label: 'navigation.teachers', roles: ['admin'], section: 'admin.people' },
  { path: '/app/admin/users', label: 'navigation.users', roles: ['admin'], section: 'admin.people' },
  { path: '/app/admin/onboarding', label: 'navigation.onboarding', roles: ['admin'], section: 'admin.people' },
  { path: '/app/admin/academic-years', label: 'navigation.academicYears', roles: ['admin'], section: 'admin.operations' },
  { path: '/app/admin/imports', label: 'navigation.imports', roles: ['admin'], section: 'admin.operations' },
  { path: '/app/admin/archive', label: 'navigation.archive', roles: ['admin'], section: 'admin.operations' },
  { path: '/app/admin/audit', label: 'navigation.audit', roles: ['admin'], section: 'admin.operations' },
] as const satisfies readonly AppRouteDefinition[]

export function navigationForRole(role: UserRole): readonly AppRouteDefinition[] {
  if (role === 'teacher') return TEACHER_ROUTES
  if (role === 'admin') return ADMIN_ROUTES
  if (role === 'counselor') return COUNSELOR_ROUTES
  return []
}

export interface AppNavigationSection {
  label?: TranslationKey
  routes: readonly AppRouteDefinition[]
}

export function navigationSectionsForRole(role: UserRole): readonly AppNavigationSection[] {
  const sections = new Map<TranslationKey | undefined, AppRouteDefinition[]>()
  for (const route of navigationForRole(role)) {
    const items = sections.get(route.section) ?? []
    items.push(route)
    sections.set(route.section, items)
  }

  return [...sections.entries()].map(([label, routes]) => (
    label === undefined ? { routes } : { label, routes }
  ))
}
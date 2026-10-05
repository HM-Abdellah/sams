import { apiClient } from '../../services/api/client.ts'
import type {
  AcademicYear, AdminClass, AdminDashboard, AdminSubject, AdminTeacher,
  AdminTeaching, AdminUser, AuditSearch, ImportPreview, OnboardingRequest,
  ChangedResult, IdResult, ImportWorkflowResult, OnboardingCodeResult, SamsCodeResult, SessionVersionResult,
} from './types.ts'

const get = <T>(path: string) => apiClient.request<T>(path)
const post = <T>(path: string, body: unknown) =>
  apiClient.request<T>(path, { method: 'POST', body })

export const adminApi = {
  dashboard: () => get<AdminDashboard>('/admin/dashboard'),
  classes: () => get<{ classes: AdminClass[] }>('/admin/classes'),
  teachers: () => get<{
    teachers: AdminTeacher[]
    subjects: AdminSubject[]
    teachings: AdminTeaching[]
    online_window_seconds: number
  }>('/admin/teachers'),
  users: () => get<{ users: AdminUser[] }>('/admin/users'),
  academicYears: () => get<{ academic_years: AcademicYear[] }>('/admin/academic-years'),
  onboardingRequests: (status?: string) =>
    get<{ requests: OnboardingRequest[] }>(
      '/admin/onboarding/requests' + (status ? '?status=' + encodeURIComponent(status) : ''),
    ),  createClass: (body: { name: string; level?: string | undefined; branch?: string | undefined }) =>
    post<IdResult>('/admin/classes', { action: 'create', ...body }),
  updateClass: (body: { id: number; name: string; level?: string | undefined; branch?: string | undefined }) =>
    post<IdResult>('/admin/classes', { action: 'update', ...body }),
  setClassActive: (id: number, active: boolean) =>
    post<ChangedResult>('/admin/classes', {
      action: active ? 'activate' : 'deactivate',
      id,
    }),
  assignTeaching: (body: { teacher_id: number; subject_id: number; class_id: number }) =>
    post<IdResult>('/admin/teachers', { action: 'assign', ...body }),
  unassignTeaching: (id: number) =>
    post<ChangedResult>('/admin/teachers', { action: 'unassign', id }),
  createSubject: (body: {
    code: string
    name_fr: string
    name_ar: string
    name_en: string
  }) => post<IdResult>('/admin/teachers', { action: 'create_subject', ...body }),
  updateSubject: (body: {
    id: number
    code: string
    name_fr: string
    name_ar: string
    name_en: string
    is_active: boolean
  }) => post<IdResult>('/admin/teachers', { action: 'update_subject', ...body }),  createUser: (body: {
    username: string
    full_name: string
    role: 'admin' | 'teacher' | 'counselor'
    password: string
    employee_id?: string | undefined
    phone?: string | undefined
  }) => post<IdResult>('/admin/users', { action: 'create', ...body }),
  updateUser: (body: {
    id: number
    full_name: string
    role: 'admin' | 'teacher' | 'counselor'
    is_active: boolean
    employee_id?: string | undefined
    phone?: string | undefined
  }) => post<IdResult>('/admin/users', { action: 'update', ...body }),
  resetPassword: (id: number, password: string) =>
    post<null>('/admin/users', { action: 'reset_password', id, password }),
  unlockUser: (id: number) =>
    post<IdResult>('/admin/users', { action: 'unlock', id }),
  setUserStatus: (id: number, status: AdminUser['account_status']) =>
    post<SessionVersionResult>('/admin/users', { action: 'set_status', id, status }),
  revokeSessions: (id: number) =>
    post<SessionVersionResult>('/admin/users', { action: 'revoke_sessions', id }),
  generateSamsCode: (id: number) =>
    post<SamsCodeResult>('/admin/users', { action: 'generate_sams_code', id }),  createAcademicYear: (body: {
    name: string
    starts_on: string
    ends_on: string
    activate: boolean
  }) => post<IdResult>('/admin/academic-years', { action: 'create', ...body }),
  activateAcademicYear: (id: number) =>
    post<IdResult>('/admin/academic-years', { action: 'activate', id }),
  rotateOnboardingCode: () =>
    post<OnboardingCodeResult>('/admin/onboarding/code', {}),
  reviewOnboarding: (id: number, decision: 'approve' | 'reject', reason?: string | undefined) =>
    post<{
      request_id: number
      user_id: number
      reused: boolean
      status: string
    }>('/admin/onboarding/' + id + '/review', {
      decision,
      ...(reason ? { reason } : {}),
    }),
  audit: (params: {
    user_id?: number | undefined
    action?: string
    entity_type?: string
    from?: string
    to?: string
    page?: number
    per_page?: number
  }) => {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value))
    }
    return get<AuditSearch>('/admin/audit' + (search.size ? '?' + search.toString() : ''))
  },  uploadSchoolImport: async (file: File, targetAcademicYearId?: number) => {
    const form = new FormData()
    form.append('file', file)
    if (targetAcademicYearId !== undefined) {
      form.append('target_academic_year_id', String(targetAcademicYearId))
    }
    return apiClient.request<{ id: number; status: string }>('/imports/school', {
      method: 'POST',
      body: form,
    })
  },
  importPreview: (id: number, classId?: number, page = 1, perPage = 50) => {
    const search = new URLSearchParams()
    if (classId !== undefined) search.set('class_id', String(classId))
    search.set('page', String(page))
    search.set('per_page', String(perPage))
    return get<ImportPreview>('/imports/school/' + id + '?' + search.toString())
  },
  reconcileImport: (id: number) =>
    post<ImportWorkflowResult>('/imports/school/' + id + '/reconcile', {}),
  commitImport: (id: number) =>
    post<ImportWorkflowResult>('/imports/school/' + id + '/commit', {}),
}

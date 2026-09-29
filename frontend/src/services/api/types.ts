export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = { success: false; error: string }
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export type UserRole = 'admin' | 'teacher' | 'counselor'
export type AccountStatus = 'active' | 'suspended' | 'deactivated'

export interface AuthUser {
  id: number
  school_id: number | null
  employee_id: string
  full_name: string
  role: UserRole
  account_status: AccountStatus
}

export interface AuthSessionData {
  authenticated: boolean
  user: AuthUser | null
  csrf: string
}

export interface LoginData {
  user: AuthUser
  csrf: string
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type AttendanceMutation = 'upsert' | 'delete'

export interface AttendanceEntry {
  student_id: number
  attendance_date: string
  period: number
  action: AttendanceMutation
  status?: AttendanceStatus
}

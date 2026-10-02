import type { AttendanceEntry, AttendanceStatus } from '../../services/api/types.ts'

export type AttendanceViewStatus = AttendanceStatus | 'clear'
export type AttendanceRegisterStatus = 'idle' | 'loading' | 'success' | 'error'
export type AttendanceMutationState = 'idle' | 'saving' | 'saved' | 'failed' | 'retrying' | 'blocked' | 'conflict'
export type AttendanceFilter = 'all' | 'with_absences' | 'eight_plus_absences'

export interface AttendanceSignoff {
  id: number
  class_id: number
  teacher_id: number
  teacher_name: string
  employee_id: string | null
  attendance_date: string
  period: number
  status: 'signed' | 'needs_resign'
  signed_at: string | null
  invalidated_at: string | null
}

export interface AttendanceDraft {
  entry: AttendanceEntry
  previousStatus: AttendanceViewStatus
  expectedRevision: number
  version: number
}

export interface AttendanceDateParts {
  date: string
  weekday: string
  shortDate: string
}
export interface AttendanceSummary {
  present: number
  absent: number
  late: number
  excused: number
  unmarked: number
}

export type AttendanceMutationEntry = AttendanceDraft & {
  key: string
}

import type { AdminClass } from '../admin/types.ts'

export interface ArchiveDay {
  attendance_date: string
  recorded_count: number | string
  present_count: number | string
  absent_count: number | string
  late_count: number | string
  excused_count: number | string
  students_with_records: number | string
  presence_rate: number | null
}

export interface ArchiveMonthStudent {
  id: number
  student_number: string | null
  massar_code: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  enrollment_starts_on: string
  enrollment_ends_on: string | null
  present_count: number | string
  absent_count: number | string
  late_count: number | string
  excused_count: number | string
  recorded_count: number | string
  recorded_days: number | string
  presence_rate: number | null
}

export interface ArchiveDailyRecord {
  student_id: number
  student_number: string | null
  massar_code: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  enrollment_id: number
  enrollment_starts_on: string
  enrollment_ends_on: string | null
  attendance_id: number | null
  attendance_date: string | null
  period: string | number | null
  status: string | null
  recorded_by: number | null
  created_at: string | null
  updated_at: string | null
}

export interface ArchiveHistoryRecord {
  student_id: number
  student_number: string | null
  massar_code: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  enrollment_id: number
  class_id: number
  class_name: string
  academic_year_id: number
  academic_year_name: string
  starts_on: string
  ends_on: string | null
  attendance_id: number | null
  attendance_date: string | null
  period: string | number | null
  status: string | null
  recorded_by: number | null
  created_at: string | null
  updated_at: string | null
}

export interface ArchiveBaseData {
  class: AdminClass & {
    academic_year_starts_on: string
    academic_year_ends_on: string
    school_id?: number
  }
}

export interface ArchiveDaysData extends ArchiveBaseData {
  view: 'days'
  month: string
  start: string
  end: string
  days: ArchiveDay[]
}

export interface ArchiveMonthSummary {
  present_count: number | string
  absent_count: number | string
  late_count: number | string
  excused_count: number | string
  recorded_count: number | string
  presence_rate: number | null
}

export interface ArchiveMonthData extends ArchiveBaseData {
  view: 'month'
  month: string
  start: string
  end: string
  summary: ArchiveMonthSummary
  students: ArchiveMonthStudent[]
}

export interface ArchiveDayData extends ArchiveBaseData {
  view: 'day'
  date: string
  records: ArchiveDailyRecord[]
}

export interface ArchiveStudentData extends ArchiveBaseData {
  view: 'student'
  student_id: number
  history: ArchiveHistoryRecord[]
}

export type ArchiveData =
  | ArchiveDaysData
  | ArchiveMonthData
  | ArchiveDayData
  | ArchiveStudentData

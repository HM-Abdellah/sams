import { apiClient } from '../../services/api/client.ts'
import type {
  AttendanceEntry,
  AttendanceStatus,
} from '../../services/api/types.ts'
import type { AttendanceSignoff } from './types.ts'

export interface AttendanceStudent {
  id: number
  first_name: string
  last_name: string
}

export interface AttendanceRecord {
  id: number
  student_id: number
  enrollment_id: number
  attendance_date: string
  period: number
  status: AttendanceStatus
}

export interface WeeklyRegisterData {
  class_id: number
  week_start: string
  week_end: string
  students: AttendanceStudent[]
  attendance: AttendanceRecord[]
  period_signoffs: AttendanceSignoff[]
}

export interface SaveBulkData {
  changed: number
  unchanged: number
  total: number
}

export const attendanceApi = {
  weeklyRegister(classId: number, weekStart: string): Promise<WeeklyRegisterData> {
    const query = new URLSearchParams({ week_start: weekStart })
    return apiClient.request<WeeklyRegisterData>(
      `/classes/${classId}/attendance?${query}`,
    )
  },

  saveBulk(classId: number, entries: AttendanceEntry[]): Promise<SaveBulkData> {
    return apiClient.request<SaveBulkData>(`/classes/${classId}/attendance/bulk`, {
      method: 'POST',
      body: { entries },
    })
  },
}

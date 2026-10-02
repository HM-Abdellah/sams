[Reading 80 lines from start (total: 80 lines, 0 remaining)]

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

export interface AttendanceRevision {
  attendance_date: string
  period: number
  revision: number
}

export interface WeeklyRegisterData {
  class_id: number
  week_start: string
  week_end: string
  students: AttendanceStudent[]
  attendance: AttendanceRecord[]
  attendance_revisions: AttendanceRevision[]
  period_signoffs: AttendanceSignoff[]
}

export interface SaveBulkData {
  changed: number
  unchanged: number
  total: number
  revisions: AttendanceRevision[]
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

  signPeriod(
    classId: number,
    weekStart: string,
    attendanceDate: string,
    period: number,
  ): Promise<{ signed: boolean }> {
    return apiClient.request<{ signed: boolean }>(
      `/attendance-signoffs.php?class_id=${encodeURIComponent(classId)}`,
      {
        method: 'POST',
        body: {
          action: 'sign_period',
          week_start: weekStart,
          attendance_date: attendanceDate,
          period,
        },
      },
    )
  },
}

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]
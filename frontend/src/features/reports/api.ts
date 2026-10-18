import { apiClient } from '../../services/api/client.ts'

export interface ReportStudentTotals {
  id: number
  student_number: string | null
  massar_code: string | null
  first_name: string
  last_name: string
  birth_date: string | null
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  other_count: number
  recorded_count: number
  presence_rate: number | null
}

export interface MonthlyReportSummary {
  present_count: number
  absent_count: number
  late_count: number
  excused_count: number
  recorded_count: number
  presence_rate: number | null
}

export interface MonthlyReportData {
  class: Record<string, unknown>
  month: string
  start: string
  end: string
  summary: MonthlyReportSummary
  students: ReportStudentTotals[]
}

export const reportsApi = {
  monthly(classId: number, month: string): Promise<MonthlyReportData> {
    const query = new URLSearchParams({ month })
    return apiClient.request<MonthlyReportData>(
      `/classes/${classId}/report?${query}`,
    )
  },
}

import { apiClient } from '../../services/api/client.ts'

export interface ReportStudentTotals {
  [key: string]: unknown
}

export interface MonthlyReportData {
  class: Record<string, unknown>
  month: string
  start: string
  end: string
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

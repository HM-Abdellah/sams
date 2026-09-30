import { apiClient } from '../../services/api/client.ts'
import type { ArchiveData } from './types.ts'

export const archiveApi = {
  read(params: {
    view: 'days' | 'month' | 'day' | 'student'
    classId: number
    month?: string
    date?: string
    studentId?: number
  }): Promise<ArchiveData> {
    const query = new URLSearchParams({
      view: params.view,
      class_id: String(params.classId),
    })
    if (params.month) query.set('month', params.month)
    if (params.date) query.set('date', params.date)
    if (params.studentId !== undefined) query.set('student_id', String(params.studentId))
    return apiClient.request<ArchiveData>('/admin/archive?' + query.toString())
  },
}

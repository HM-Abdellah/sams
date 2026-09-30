import { legacyApiClient } from '../../services/api/client.ts'
import type { ClassStudentsData, StudentMutationInput, StudentMutationResult } from './types.ts'

export const studentsApi = {
  forClass(classId: number, signal?: AbortSignal): Promise<ClassStudentsData> {
    const query = new URLSearchParams({ class_id: String(classId) })
    return legacyApiClient.request<ClassStudentsData>(
      `students.php?${query}`,
      signal === undefined ? {} : { signal },
    )
  },

  create(classId: number, input: StudentMutationInput): Promise<StudentMutationResult> {
    const query = new URLSearchParams({ class_id: String(classId) })
    return legacyApiClient.request<StudentMutationResult>(`students.php?${query}`, {
      method: 'POST',
      body: { action: 'create', ...input },
    })
  },

  update(classId: number, studentId: number, input: StudentMutationInput): Promise<StudentMutationResult> {
    const query = new URLSearchParams({ class_id: String(classId) })
    return legacyApiClient.request<StudentMutationResult>(`students.php?${query}`, {
      method: 'POST',
      body: { action: 'update', id: studentId, ...input },
    })
  },
}

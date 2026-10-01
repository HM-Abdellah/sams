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

  deactivate(classId: number, studentId: number): Promise<{ changed: boolean }> {
    const query = new URLSearchParams({ class_id: String(classId) })
    return legacyApiClient.request<{ changed: boolean }>(`students.php?${query}`, {
      method: 'POST',
      body: { action: 'delete', id: studentId },
    })
  },

  transfer(
    classId: number,
    studentId: number,
    targetClassId: number,
    effectiveDate: string,
  ): Promise<StudentMutationResult & { class_id: number; enrollment_id: number; effective_date: string }> {
    const query = new URLSearchParams({ class_id: String(classId) })
    return legacyApiClient.request<StudentMutationResult & { class_id: number; enrollment_id: number; effective_date: string }>(
      `students.php?${query}`,
      {
        method: 'POST',
        body: {
          action: 'transfer',
          id: studentId,
          target_class_id: targetClassId,
          effective_date: effectiveDate,
        },
      },
    )
  },
}

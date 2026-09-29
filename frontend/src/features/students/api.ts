import { legacyApiClient } from '../../services/api/client.ts'
import type { ClassStudentsData } from './types.ts'

export const studentsApi = {
  forClass(classId: number, signal?: AbortSignal): Promise<ClassStudentsData> {
    const query = new URLSearchParams({ class_id: String(classId) })
    return legacyApiClient.request<ClassStudentsData>(
      `students.php?${query}`,
      signal === undefined ? {} : { signal },
    )
  },
}

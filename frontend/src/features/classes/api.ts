import { legacyApiClient } from '../../services/api/client.ts'
import type { TeacherClassesData } from './types.ts'

export const classesApi = {
  forCurrentUser(signal?: AbortSignal): Promise<TeacherClassesData> {
    return legacyApiClient.request<TeacherClassesData>(
      'classes.php',
      signal === undefined ? {} : { signal },
    )
  },
}

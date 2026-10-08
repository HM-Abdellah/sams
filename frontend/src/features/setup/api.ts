import { apiClient } from '../../services/api/client.ts'

export interface SetupStatus {
  available: boolean
  configured: boolean
  initialized: boolean
}

export interface SetupResult {
  school_id: number
  admin_id: number
  username: string
  initialized: boolean
}

export const setupApi = {
  status(): Promise<SetupStatus> {
    return apiClient.request<SetupStatus>('/setup/status')
  },

  initialize(input: {
    setupKey: string
    schoolCode: string
    schoolName: string
    username: string
    fullName: string
    password: string
  }): Promise<SetupResult> {
    return apiClient.request<SetupResult>('/setup', {
      method: 'POST',
      body: {
        setup_key: input.setupKey,
        school_code: input.schoolCode,
        school_name: input.schoolName,
        username: input.username,
        full_name: input.fullName,
        password: input.password,
      },
    })
  },
}


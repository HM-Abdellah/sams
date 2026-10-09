import { apiClient } from '../../services/api/client.ts'
import type { AuthSessionData, LoginData } from '../../services/api/types.ts'

export interface LoginInput {
  identifier: string
  password: string
}

export const authApi = {
  session(): Promise<AuthSessionData> {
    return apiClient.initializeSession()
  },

  async login(input: LoginInput): Promise<LoginData> {
    // The backend requires CSRF for login; initialize the session first.
    await apiClient.initializeSession()
    return apiClient.request<LoginData>('/auth/login', {
      method: 'POST',
      body: input,
    })
  },

  logout(): Promise<null> {
    return apiClient.request<null>('/auth/logout', { method: 'POST' })
  },
}


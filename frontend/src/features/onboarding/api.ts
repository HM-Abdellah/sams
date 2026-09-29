import { apiClient } from '../../services/api/client.ts'

export interface OnboardingRequestInput {
  onboarding_code: string
  full_name: string
  employee_id?: string
  phone?: string
}

export interface OnboardingRequestData {
  request_id: number
  request_token: string
  status: 'pending'
  expires_at: string
}

export interface OnboardingStatusData {
  request_id: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expires_at: string
  activated: boolean
}

export interface OnboardingActivationData {
  request_id: number
  user_id: number
  sams_code: string
  session_version: number
}

export const onboardingApi = {
  request(input: OnboardingRequestInput): Promise<OnboardingRequestData> {
    // Current public onboarding endpoints do not require an authenticated
    // session or CSRF token; transport behavior follows the frozen backend.
    return apiClient.request<OnboardingRequestData>('/onboarding/request', {
      method: 'POST',
      body: input,
      csrf: 'omit',
    })
  },

  status(requestToken: string): Promise<OnboardingStatusData> {
    const query = new URLSearchParams({ request_token: requestToken })
    return apiClient.request<OnboardingStatusData>(`/onboarding/status?${query}`)
  },

  activate(requestToken: string, password: string): Promise<OnboardingActivationData> {
    return apiClient.request<OnboardingActivationData>('/onboarding/activate', {
      method: 'POST',
      body: { request_token: requestToken, password },
      csrf: 'omit',
    })
  },
}

import { apiClient } from '../../services/api/client.ts'
import type { ProfileData } from '../../services/api/types.ts'

export const profileApi = {
  get(): Promise<ProfileData> {
    return apiClient.request<ProfileData>('/profile')
  },

  update(input: {
    username: string
    full_name: string
    avatar?: File
    remove_avatar?: boolean
  }): Promise<ProfileData & { csrf?: string }> {
    const form = new FormData()
    form.append('username', input.username)
    form.append('full_name', input.full_name)
    if (input.avatar) form.append('avatar', input.avatar)
    if (input.remove_avatar) form.append('remove_avatar', '1')
    return apiClient.request<ProfileData & { csrf?: string }>('/profile', {
      method: 'POST',
      body: form,
    })
  },
}
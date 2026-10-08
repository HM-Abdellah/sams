import { env } from '../../lib/env.ts'

export function profileAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null
  if (avatarUrl.startsWith('/api/v1/')) {
    return env.apiBaseUrl + avatarUrl.slice('/api/v1'.length)
  }
  return avatarUrl
}


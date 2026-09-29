const DEFAULT_API_BASE_URL = '/api/v1'

function normalizeApiBaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '')

  if (normalized.startsWith('/')) {
    return normalized || '/api/v1'
  }

  try {
    new URL(normalized)
    return normalized
  } catch {
    throw new Error('Invalid VITE_API_BASE_URL configuration.')
  }
}

export const env = Object.freeze({
  apiBaseUrl: normalizeApiBaseUrl(
    import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
  ),
})

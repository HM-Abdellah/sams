export function safeReturnTo(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string' || value.length === 0 || !value.startsWith('/')) {
    return fallback
  }

  if (value.startsWith('//') || value.startsWith('/\\')) {
    return fallback
  }

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return fallback
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}

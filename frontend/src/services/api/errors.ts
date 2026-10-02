[Reading 36 lines from start (total: 36 lines, 0 remaining)]

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code ?? statusCode(status)
  }
}

function statusCode(status: number): string {
  switch (status) {
    case 401:
      return 'AUTHENTICATION_REQUIRED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    case 405:
      return 'METHOD_NOT_ALLOWED'
    case 409:
      return 'CONFLICT'
    case 419:
      return 'CSRF_INVALID'
    case 422:
      return 'VALIDATION'
    case 429:
      return 'RATE_LIMITED'
    case 413:
      return 'PAYLOAD_TOO_LARGE'
    default:
      return status >= 500 ? 'SERVER_ERROR' : 'API_ERROR'
  }
}

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]
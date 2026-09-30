import { describe, expect, test } from 'vitest'
import { ApiError } from './errors.ts'

describe('ApiError', () => {
  test.each([
    [400, 'API_ERROR'], [401, 'AUTHENTICATION_REQUIRED'], [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'], [405, 'METHOD_NOT_ALLOWED'], [409, 'CONFLICT'],
    [413, 'PAYLOAD_TOO_LARGE'], [419, 'CSRF_INVALID'], [422, 'VALIDATION'],
    [429, 'RATE_LIMITED'], [500, 'SERVER_ERROR'], [503, 'SERVER_ERROR'],
  ])('maps HTTP %i to %s', (status, code) => {
    const error = new ApiError(status, 'failure')
    expect(error.name).toBe('ApiError')
    expect(error.status).toBe(status)
    expect(error.code).toBe(code)
    expect(error.message).toBe('failure')
  })
})

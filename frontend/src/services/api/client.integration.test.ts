import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ApiClient } from './client.ts'
import { ApiError } from './errors.ts'

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

describe('ApiClient transport boundary', () => {
  const client = new ApiClient('/api/v1')
  const fetchMock = vi.fn()

  beforeEach(() => {
    client.clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  test('sends same-origin credentials and omits CSRF for GET', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { ok: true } }))
    await client.request('/health')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.credentials).toBe('include')
    expect(new Headers(init.headers).get('Accept')).toBe('application/json')
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBeNull()
  })
  test('requires and sends CSRF for JSON mutations', async () => {
    client.setCsrfToken('csrf-123')
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 7 } }))
    await client.request('/students', { method: 'POST', body: { name: 'Ada' } })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRF-Token')).toBe('csrf-123')
    expect(init.body).toBe(JSON.stringify({ name: 'Ada' }))
  })

  test('fails closed when a protected request has no CSRF token', async () => {
    await expect(client.request('/students', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 419, code: 'CSRF_INVALID' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('captures a server-provided CSRF token for later mutations', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: { csrf: 'fresh-token' } }))
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, data: null }))
    await client.request('/auth/session')
    await client.request('/auth/logout', { method: 'POST' })
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(new Headers(init.headers).get('X-CSRF-Token')).toBe('fresh-token')
  })
  test('does not set JSON content type for FormData', async () => {
    client.setCsrfToken('csrf-form')
    const form = new FormData()
    form.set('file', new Blob(['data']), 'fixture.txt')
    fetchMock.mockResolvedValue(jsonResponse({ success: true, data: { id: 9 } }))
    await client.request('/imports', { method: 'POST', body: form })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = new Headers(init.headers)
    expect(headers.get('Content-Type')).toBeNull()
    expect(headers.get('X-CSRF-Token')).toBe('csrf-form')
    expect(init.body).toBe(form)
  })

  test('maps API failures and malformed responses to ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: false, error: 'Forbidden' }, 403))
    const failure = client.request('/admin')
    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  test('rejects non-JSON and invalid-envelope responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', {
      status: 500,
      headers: { 'content-type': 'text/html' },
    }))
    await expect(client.request('/broken')).rejects.toMatchObject({ status: 500 })
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: 'yes' }, 200))
    await expect(client.request('/broken')).rejects.toMatchObject({ status: 200 })
  })
})

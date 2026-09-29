import { env } from '../../lib/env.ts'
import { ApiError } from './errors.ts'
import type { ApiEnvelope, AuthSessionData } from './types.ts'

export type HttpMethod = 'GET' | 'POST' | 'DELETE'
export type CsrfMode = 'required' | 'omit'

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  csrf?: CsrfMode
  signal?: AbortSignal
}

export class ApiClient {
  private csrfToken: string | null = null

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const csrf = options.csrf ?? (method === 'GET' ? 'omit' : 'required')
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')

    if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
    }

    if (csrf === 'required') {
      if (this.csrfToken === null) {
        throw new ApiError(419, 'CSRF token is not initialized.')
      }
      headers.set('X-CSRF-Token', this.csrfToken)
    }

    const requestInit: RequestInit = {
      method,
      credentials: 'include',
      headers,
    }

    if (options.body !== undefined) {
      requestInit.body = JSON.stringify(options.body)
    }
    if (options.signal !== undefined) {
      requestInit.signal = options.signal
    }

    const response = await fetch(this.url(path), requestInit)

    const payload = await this.readEnvelope<T>(response)
    if (!payload.success) {
      throw new ApiError(response.status, payload.error)
    }

    this.captureCsrf(payload.data)
    return payload.data
  }

  async initializeSession(): Promise<AuthSessionData> {
    return this.request<AuthSessionData>('/auth/session')
  }
  setCsrfToken(token: string): void {
    this.csrfToken = token
  }

  clearCsrfToken(): void {
    this.csrfToken = null
  }

  private url(path: string): string {
    return `${env.apiBaseUrl}/${path.replace(/^\/+/, '')}`
  }

  private async readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json')) {
      throw new ApiError(response.status, 'The API returned an invalid response.')
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw new ApiError(response.status, 'The API returned invalid JSON.')
    }

    if (!body || typeof body !== 'object' || !('success' in body)) {
      throw new ApiError(response.status, 'The API returned an invalid envelope.')
    }

    if ((body as { success: unknown }).success === true && 'data' in body) {
      return body as ApiEnvelope<T>
    }

    if (
      (body as { success: unknown }).success === false
      && 'error' in body
      && typeof (body as { error: unknown }).error === 'string'
    ) {
      return body as ApiEnvelope<T>
    }

    throw new ApiError(response.status, 'The API returned an invalid envelope.')
  }

  private captureCsrf(data: unknown): void {
    if (!data || typeof data !== 'object' || !('csrf' in data)) return
    const csrf = (data as { csrf?: unknown }).csrf
    if (typeof csrf === 'string' && csrf !== '') {
      this.csrfToken = csrf
    }
  }
}

export const apiClient = new ApiClient()

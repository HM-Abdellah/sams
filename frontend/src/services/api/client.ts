[Reading 131 lines from start (total: 131 lines, 0 remaining)]

import { env } from '../../lib/env.ts'
import { ApiError } from './errors.ts'
import type { ApiEnvelope, AuthSessionData } from './types.ts'

export type HttpMethod = 'GET' | 'POST' | 'DELETE'
export type CsrfMode = 'required' | 'omit'

let sharedCsrfToken: string | null = null

export interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  headers?: Record<string, string>
  csrf?: CsrfMode
  signal?: AbortSignal
}

export class ApiClient {
  private readonly baseUrl: string

  constructor(baseUrl = env.apiBaseUrl) {
    this.baseUrl = baseUrl
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? 'GET'
    const csrf = options.csrf ?? (method === 'GET' ? 'omit' : 'required')
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')

    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
    if (options.body !== undefined && !isFormData) {
      headers.set('Content-Type', 'application/json')
    }

    if (csrf === 'required') {
      if (sharedCsrfToken === null) {
        throw new ApiError(419, 'CSRF token is not initialized.')
      }
      headers.set('X-CSRF-Token', sharedCsrfToken)
    }

    const requestInit: RequestInit = {
      method,
      credentials: 'include',
      headers,
    }

    if (options.body !== undefined) {
      requestInit.body = isFormData ? (options.body as FormData) : JSON.stringify(options.body)
    }
    if (options.signal !== undefined) {
      requestInit.signal = options.signal
    }

    const response = await fetch(this.url(path), requestInit)

    const payload = await this.readEnvelope<T>(response)
    if (!payload.success) {
      throw new ApiError(
        response.status,
        payload.error,
        response.headers.get('X-SAMS-Error-Code') ?? undefined,
      )
    }

    this.captureCsrf(payload.data)
    return payload.data
  }

  async initializeSession(): Promise<AuthSessionData> {
    return this.request<AuthSessionData>('/auth/session')
  }
  setCsrfToken(token: string): void {
    sharedCsrfToken = token
  }

  clearCsrfToken(): void {
    sharedCsrfToken = null
  }

  private url(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`
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
      sharedCsrfToken = csrf
    }
  }
}

const configuredBasePath = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '')
const legacyApiBaseUrl = `${configuredBasePath}/api`

export const apiClient = new ApiClient()
export const legacyApiClient = new ApiClient(legacyApiBaseUrl)

[executed on device: codespaces-052ecf (81686ebc-c2a3-4f3f-931c-1c91ab9990de)]
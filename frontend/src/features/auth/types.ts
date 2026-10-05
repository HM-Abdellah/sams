import type { AuthUser } from '../../services/api/types.ts'

export interface SessionState {
  status: 'loading' | 'authenticated' | 'anonymous' | 'error'
  user: AuthUser | null
  error: string | null
}

export interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>
  login: (identifier: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

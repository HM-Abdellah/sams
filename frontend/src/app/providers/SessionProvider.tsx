import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ApiError } from '../../services/api/errors.ts'
import { apiClient } from '../../services/api/client.ts'
import { authApi } from '../../features/auth/api.ts'
import type { AuthUser } from '../../services/api/types.ts'
import type { SessionContextValue, SessionState } from '../../features/auth/types.ts'
import { SessionContext } from '../../features/auth/SessionContext.ts'

function stateFromUser(user: AuthUser | null): SessionState {
  return user === null
    ? { status: 'anonymous', user: null, error: null }
    : { status: 'authenticated', user, error: null }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    status: 'loading',
    user: null,
    error: null,
  })

  const refresh = useCallback(async () => {
    try {
      const session = await authApi.session()
      setState(stateFromUser(session.authenticated ? session.user : null))
      if (!session.authenticated) apiClient.clearCsrfToken()
    } catch (cause) {
      apiClient.clearCsrfToken()
      setState({
        status: 'error',
        user: null,
        error: cause instanceof ApiError
          ? cause.message
          : 'Unable to initialize the session.',
      })
    }
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const result = await authApi.login({ identifier, password })
    setState(stateFromUser(result.user))
    return result.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      if (!(error instanceof ApiError) || ![401, 419].includes(error.status)) {
        throw error
      }
    } finally {
      apiClient.clearCsrfToken()
      setState({ status: 'anonymous', user: null, error: null })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (state.status !== 'authenticated') return undefined

    const intervalId = window.setInterval(() => {
      void refresh()
    }, 45_000)

    return () => window.clearInterval(intervalId)
  }, [refresh, state.status])

  const value = useMemo<SessionContextValue>(
    () => ({ ...state, refresh, login, logout }),
    [state, refresh, login, logout],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}


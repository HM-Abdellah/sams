import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SessionProvider } from './SessionProvider.tsx'
import { apiClient } from '../../services/api/client.ts'
import { useSession } from '../../features/auth/useSession.ts'

const user = {
  id: 10, school_id: 20, employee_id: 'T010', full_name: 'E2E Teacher',
  role: 'teacher' as const, account_status: 'active' as const,
}
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
})

function Probe() {
  const session = useSession()
  return <div>
    <output data-testid="status">{session.status}</output>
    <output data-testid="name">{session.user?.full_name ?? ''}</output>
    <output data-testid="error">{session.error ?? ''}</output>
    <button onClick={() => void session.logout()}>Logout</button>
    <button onClick={() => void session.login('T010', 'secret')}>Login</button>
  </div>
}
describe('SessionProvider integration', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    apiClient.clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  test('restores an authenticated server session and captures CSRF', async () => {
    fetchMock.mockResolvedValue(response({ success: true, data: { authenticated: true, user, csrf: 'session-token' } }))
    render(<SessionProvider><Probe /></SessionProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('name')).toHaveTextContent('E2E Teacher')
  })

  test('logout clears local session state after server confirmation', async () => {
    fetchMock
      .mockResolvedValueOnce(response({ success: true, data: { authenticated: true, user, csrf: 'session-token' } }))
      .mockResolvedValueOnce(response({ success: true, data: null }))
    render(<SessionProvider><Probe /></SessionProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(new Headers((fetchMock.mock.calls[1] as [string, RequestInit])[1].headers).get('X-CSRF-Token')).toBe('session-token')
  })
  test('exposes a session error without leaving a stale authenticated user', async () => {
    fetchMock.mockResolvedValue(response({ success: false, error: 'Session unavailable.' }, 503))
    render(<SessionProvider><Probe /></SessionProvider>)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(screen.getByTestId('name')).toHaveTextContent('')
    expect(screen.getByTestId('error')).toHaveTextContent('Session unavailable.')
  })
})

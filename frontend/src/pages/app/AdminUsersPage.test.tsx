import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminUser } from '../../features/admin/types.ts'
import { AdminUsersPage } from './AdminUsersPage.tsx'

vi.mock('../../features/auth/useSession.ts', () => ({
  useSession: () => ({
    status: 'authenticated',
    user: { id: 1, school_id: 1, username: 'admin.current', full_name: 'Current Administrator', role: 'admin', account_status: 'active', avatar_url: null },
    error: null,
    refresh: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

const makeAdmin = (id: number | string, username: string, fullName: string): AdminUser => ({
  id: id as number,
  school_id: 1,
  username,
  employee_id: null,
  full_name: fullName,
  phone: null,
  phone_verified: false,
  role: 'admin',
  account_status: 'active',
  is_active: 1,
  failed_login_attempts: 0,
  locked_until: null,
  last_login_at: null,
  last_seen_at: null,
  is_online: 0,
  created_at: '2026-10-01 09:00:00',
  updated_at: '2026-10-01 09:00:00',
})

describe('AdminUsersPage', () => {
  afterEach(() => vi.restoreAllMocks())

  test('requires the backend minimum password length before enabling administrator creation', async () => {
    vi.spyOn(adminApi, 'users').mockResolvedValue({ users: [makeAdmin(1, 'admin.current', 'Current Administrator')] })
    const createSpy = vi.spyOn(adminApi, 'createAdministrator').mockResolvedValue({ id: 3 })
    render(
      <MemoryRouter initialEntries={['/app/admin/users']}>
        <I18nProvider><AdminUsersPage /></I18nProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByLabelText('Full name')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Administrator' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'new.admin' } })
    const password = screen.getByLabelText('Password')
    fireEvent.change(password, { target: { value: 'short' } })
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    fireEvent.change(password, { target: { value: 'long-enough-password' } })
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    expect(createSpy).not.toHaveBeenCalled()
  })

  test('shows account status separately from online presence', async () => {
    const suspended: AdminUser = { ...makeAdmin(2, 'admin.suspended', 'Suspended Administrator'), account_status: 'suspended', is_active: 0, is_online: 0 }
    vi.spyOn(adminApi, 'users').mockResolvedValue({ users: [makeAdmin(1, 'admin.current', 'Current Administrator'), suspended] })
    render(
      <MemoryRouter initialEntries={['/app/admin/users']}>
        <I18nProvider><AdminUsersPage /></I18nProvider>
      </MemoryRouter>,
    )
    const row = await screen.findByRole('row', { name: /Suspended Administrator admin\.suspended/ })
    expect(within(row).getByText('Suspended')).toBeInTheDocument()
    expect(within(row).getByText('Offline')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Presence' })).toBeInTheDocument()
  })

  test('keeps self-delete unavailable even when the API returns the current ID as a string', async () => {
    vi.spyOn(adminApi, 'users').mockResolvedValue({
      users: [
        makeAdmin('1', 'admin.current', 'Current Administrator'),
        makeAdmin(2, 'admin.other', 'Other Administrator'),
      ],
    })

    render(
      <MemoryRouter initialEntries={['/app/admin/users']}>
        <I18nProvider>
          <AdminUsersPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Actions' })).toHaveLength(2)
    })

    const currentAdminActionButton = screen.getAllByRole('button', { name: 'Actions' }).at(0)
    if (!currentAdminActionButton) throw new Error('Current administrator actions button was not rendered.')
    fireEvent.click(currentAdminActionButton)
    const selfDialog = await screen.findByRole('dialog', { name: 'Actions' })
    expect(within(selfDialog).getByText(/You cannot delete the administrator account you are currently signed in with/)).toBeInTheDocument()
    expect(within(selfDialog).queryByRole('button', { name: 'Delete account' })).not.toBeInTheDocument()

    fireEvent.click(within(selfDialog).getByRole('button', { name: 'Cancel' }))
    const otherAdminActionButton = screen.getAllByRole('button', { name: 'Actions' }).at(1)
    if (!otherAdminActionButton) throw new Error('Other administrator actions button was not rendered.')
    fireEvent.click(otherAdminActionButton)

    const otherDialog = await screen.findByRole('dialog', { name: 'Actions' })
    expect(within(otherDialog).getByRole('button', { name: 'Delete account' })).toBeInTheDocument()
    expect(within(otherDialog).queryByText(/You cannot delete the administrator account you are currently signed in with/)).not.toBeInTheDocument()
  })
})

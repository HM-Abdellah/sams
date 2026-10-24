import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import { AdminAuditPage } from './AdminAuditPage.tsx'

describe('AdminAuditPage', () => {
  test('rejects a reversed date range before issuing another API request', async () => {
    const audit = vi.spyOn(adminApi, 'audit').mockResolvedValue({
      items: [], total: 0, page: 1, per_page: 50, total_pages: 0,
    })
    vi.spyOn(adminApi, 'users').mockResolvedValue({ users: [] })
    render(<MemoryRouter><I18nProvider><AdminAuditPage /></I18nProvider></MemoryRouter>)
    await waitFor(() => expect(audit).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-12' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-01' } })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The start date must be on or before the end date.')
    expect(audit).toHaveBeenCalledTimes(1)
  })

  test('renders audit events and applies validated filter values through the API client', async () => {
    const audit = vi.spyOn(adminApi, 'audit').mockResolvedValue({
      items: [{
        id: 10,
        user_id: 1,
        username: 'admin',
        full_name: 'School Admin',
        action: 'student.update',
        entity_type: 'student',
        entity_id: 25,
        ip_address: null,
        user_agent: null,
        metadata: { changed: 'name' },
        created_at: '2026-10-12 10:30:00',
      }],
      total: 1,
      page: 1,
      per_page: 50,
      total_pages: 1,
    })
    vi.spyOn(adminApi, 'users').mockResolvedValue({
      users: [{
        id: 1,
        school_id: 1,
        username: 'admin',
        employee_id: null,
        full_name: 'School Admin',
        phone: null,
        phone_verified: 1,
        role: 'admin',
        account_status: 'active',
        is_active: 1,
        failed_login_attempts: 0,
        locked_until: null,
        last_login_at: null,
        last_seen_at: null,
        is_online: 1,
        created_at: '2026-01-01 00:00:00',
        updated_at: '2026-01-01 00:00:00',
      }],
    })

    render(
      <MemoryRouter>
        <I18nProvider>
          <AdminAuditPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('student.update')).toBeInTheDocument())
    expect(screen.getByText('student#25')).toBeInTheDocument()

    const actionInput = screen.getByPlaceholderText('user.create')
    fireEvent.change(actionInput, { target: { value: 'student.delete' } })
    fireEvent.click(screen.getByRole('button', { name: /apply filters/i }))

    await waitFor(() => {
      expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({
        action: 'student.delete',
        page: 1,
        per_page: 50,
      }))
    })
  })
})

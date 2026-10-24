import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import type { OnboardingRequest } from '../../features/admin/types.ts'
import { AdminOnboardingPage } from './AdminOnboardingPage.tsx'

const request: OnboardingRequest = {
  id: 17,
  school_id: 1,
  full_name: 'Sara Teacher',
  employee_id: 'EMP-017',
  phone: '+212600000017',
  status: 'pending',
  expires_at: '2026-10-03 00:00:00',
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  created_user_id: null,
  created_at: '2026-10-02 00:00:00',
  updated_at: '2026-10-02 00:00:00',
}

describe('AdminOnboardingPage', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'onboardingRequests').mockResolvedValue({ requests: [request] })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('disables all request actions while one review is in progress', async () => {
    const otherRequest: OnboardingRequest = {
      ...request,
      id: 18,
      full_name: 'Youssef Teacher',
      employee_id: 'EMP-018',
    }
    vi.spyOn(adminApi, 'onboardingRequests').mockResolvedValue({ requests: [request, otherRequest] })
    let finishReview!: (result: { request_id: number; user_id: number; reused: boolean; status: string }) => void
    const pendingReview = new Promise<{ request_id: number; user_id: number; reused: boolean; status: string }>((resolve) => {
      finishReview = resolve
    })
    const reviewSpy = vi.spyOn(adminApi, 'reviewOnboarding').mockReturnValue(pendingReview)

    render(
      <MemoryRouter initialEntries={['/app/admin/onboarding']}>
        <I18nProvider>
          <AdminOnboardingPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const approveButtons = await screen.findAllByRole('button', { name: 'Approve' })
    expect(approveButtons).toHaveLength(2)
    fireEvent.click(approveButtons[0]!)

    await waitFor(() => expect(reviewSpy).toHaveBeenCalledWith(17, 'approve', undefined))
    expect(approveButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Reject' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true)

    finishReview({ request_id: 17, user_id: 101, reused: false, status: 'approved' })
    await waitFor(() => expect(adminApi.onboardingRequests).toHaveBeenCalledTimes(2))
  })

  test('uses a focused confirmation dialog before rejecting a request', async () => {
    const reviewSpy = vi.spyOn(adminApi, 'reviewOnboarding').mockResolvedValue({
      request_id: 17,
      user_id: 0,
      reused: false,
      status: 'rejected',
    })

    render(
      <MemoryRouter initialEntries={['/app/admin/onboarding']}>
        <I18nProvider>
          <AdminOnboardingPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Sara Teacher')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Confirm rejecting this request' })
    expect(within(dialog).getByText('Rejecting this request closes the teacher onboarding request. The request remains available in history.')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Rejection reason' }), {
      target: { value: 'Missing employee verification' },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith(17, 'reject', 'Missing employee verification')
    })
  })
})
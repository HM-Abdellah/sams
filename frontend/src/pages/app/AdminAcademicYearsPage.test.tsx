import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import { AdminAcademicYearsPage } from './AdminAcademicYearsPage.tsx'

const years = {
  academic_years: [
    { id: 1, school_id: 1, name: '2025/2026', starts_on: '2025-09-01', ends_on: '2026-07-31', is_active: 0, created_at: '2025-08-01' },
  ],
}

describe('AdminAcademicYearsPage', () => {
  beforeEach(() => vi.spyOn(adminApi, 'academicYears').mockResolvedValue(years))
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('blocks creating an academic year when the end date is not after the start date', async () => {
    const createSpy = vi.spyOn(adminApi, 'createAcademicYear').mockResolvedValue({ id: 2 })
    render(
      <MemoryRouter initialEntries={['/app/admin/academic-years']}>
        <I18nProvider><AdminAcademicYearsPage /></I18nProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByLabelText('Name')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '2026/2027' } })
    fireEvent.change(screen.getByLabelText('Starts on'), { target: { value: '2027-07-01' } })
    fireEvent.change(screen.getByLabelText('Ends on'), { target: { value: '2026-09-01' } })
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(createSpy).not.toHaveBeenCalled()
  })

  test('allows deleting an inactive dependency-free academic year', async () => {
    const deleteSpy = vi.spyOn(adminApi, 'deleteAcademicYear').mockResolvedValue(null)
    const reloadSpy = vi.spyOn(adminApi, 'academicYears')
      .mockResolvedValueOnce(years)
      .mockResolvedValueOnce({ academic_years: [] })
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))

    render(
      <MemoryRouter initialEntries={['/app/admin/academic-years']}>
        <I18nProvider><AdminAcademicYearsPage /></I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByText('2025/2026', { exact: true })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Delete year' }))

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith(1))
    await waitFor(() => expect(reloadSpy).toHaveBeenCalledTimes(2))
  })
})


import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import type { ImportPreview } from '../../features/admin/types.ts'
import { AdminImportsPage } from './AdminImportsPage.tsx'

const years = {
  academic_years: [
    {
      id: 1,
      school_id: 1,
      name: '2026/2027',
      starts_on: '2026-09-01',
      ends_on: '2027-07-31',
      is_active: 1,
      created_at: '2026-09-01 08:00:00',
    },
  ],
}

const basePreview: ImportPreview = {
  batch: {
    id: 41,
    created_by: 2,
    created_by_name: 'Admin',
    target_academic_year_id: 1,
    target_academic_year_name: '2026/2027',
    source_academic_year: '2026/2027',
    original_filename: 'students.xlsx',
    file_sha256: 'abc',
    file_size: 2048,
    status: 'staged',
    total_classes: 1,
    valid_classes: 1,
    warning_classes: 0,
    error_classes: 0,
    total_rows: 1,
    valid_rows: 1,
    warning_rows: 0,
    error_rows: 0,
    imported_at: null,
    created_at: '2026-10-02 00:00:00',
    updated_at: '2026-10-02 00:00:00',
  },
  classes: [
    {
      id: 501,
      batch_id: 41,
      source_sheet: 'Classes',
      source_block_start_row: 1,
      source_block_end_row: 4,
      source_class_name: '2BAC SP A',
      source_level: '2BAC',
      source_academic_year: '2026/2027',
      target_class_id: null,
      status: 'valid',
      student_count: 1,
      issues: [],
    },
  ],
}

const classPreview: ImportPreview = {
  ...basePreview,
  rows: {
    items: [
      {
        id: 9001,
        import_class_id: 501,
        source_row: 4,
        roster_number: 1,
        first_name: 'Aya',
        last_name: 'Test',
        massar_code: 'AA123456',
        birth_date: '2008-01-01',
        sex: 'F',
        birth_place: null,
        status: 'warning',
        match_status: 'not_checked',
        issues: ['duplicate_roster_number_in_class'],
        matched_student_id: null,
        target_enrollment_id: null,
      },
    ],
    total: 1,
    page: 1,
    per_page: 50,
    total_pages: 1,
  },
}

describe('AdminImportsPage', () => {
  beforeEach(() => {
    vi.spyOn(adminApi, 'academicYears').mockResolvedValue(years)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('lets an admin inspect class rows and translates detected issues', async () => {
    const previewSpy = vi.spyOn(adminApi, 'importPreview')
      .mockResolvedValueOnce(basePreview)
      .mockResolvedValueOnce(classPreview)

    render(
      <MemoryRouter initialEntries={['/app/admin/imports']}>
        <I18nProvider>
          <AdminImportsPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Batch ID' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: 'Batch ID' }), { target: { value: '41' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load batch' }))

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Imported classes' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Select a class to inspect its rows.' }))

    await waitFor(() => {
      expect(screen.getByText('Aya Test')).toBeInTheDocument()
    })

    expect(screen.getByText('The roster number appears more than once in the class.')).toBeInTheDocument()
    expect(previewSpy).toHaveBeenLastCalledWith(41, 501, 1)
  })

  test('uses the accessible confirmation flow before reconciliation', async () => {
    const previewSpy = vi.spyOn(adminApi, 'importPreview').mockResolvedValue(basePreview)
    const reconcileSpy = vi.spyOn(adminApi, 'reconcileImport').mockResolvedValue({
      batch_id: 41,
      ready_to_import: true,
      already_imported: false,
      summary: { matched_rows: 1 },
    })

    render(
      <MemoryRouter initialEntries={['/app/admin/imports']}>
        <I18nProvider>
          <AdminImportsPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Batch ID' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('textbox', { name: 'Batch ID' }), { target: { value: '41' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load batch' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reconcile' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Reconcile' }))

    const dialog = screen.getByRole('alertdialog', { name: 'Confirm reconciliation' })
    expect(dialog).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reconcile' }))

    await waitFor(() => {
      expect(reconcileSpy).toHaveBeenCalledWith(41)
    })

    expect(previewSpy).toHaveBeenCalledTimes(2)
  })
})

import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import { archiveApi } from '../../features/archive/api.ts'
import type { ArchiveData } from '../../features/archive/types.ts'
import { AdminArchivePage } from './AdminArchivePage.tsx'

const classItem = {
  id: 3,
  name: '2BAC SP A',
  level: '2BAC',
  branch: 'SP',
  academic_year_id: 2,
  is_active: 1,
  academic_year_name: '2027/2028',
  academic_year_active: 1,
  student_count: 34,
  teacher_count: 8,
}

const archive: ArchiveData = {
  view: 'days',
  class: {
    ...classItem,
    academic_year_starts_on: '2027-09-01',
    academic_year_ends_on: '2028-07-31',
  },
  month: '2027-10',
  start: '2027-10-01',
  end: '2027-10-31',
  days: [],
}

describe('AdminArchivePage', () => {
  test('falls back to a supported view when the URL contains an invalid view', async () => {
    vi.spyOn(adminApi, 'classes').mockResolvedValueOnce({ classes: [classItem] })
    const read = vi.spyOn(archiveApi, 'read').mockResolvedValueOnce(archive)

    render(
      <MemoryRouter initialEntries={['/app/admin/archive?view=not-a-view&class_id=3&month=2027-10']}>
        <I18nProvider>
          <AdminArchivePage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(read).toHaveBeenCalledWith({ view: 'days', classId: 3, month: '2027-10' })
    })
  })
})

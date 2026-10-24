import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass } from '../../features/admin/types.ts'
import { AdminClassesPage } from './AdminClassesPage.tsx'

const activeYear = '2027/2028'
const previousYear = '2026/2027'

const importedClasses: AdminClass[] = [
  {
    id: 10,
    name: 'TCSF-1',
    level: 'الجذع المشترك العلمي – خيار فرنسية',
    branch: null,
    academic_year_id: 8,
    is_active: 1,
    academic_year_name: activeYear,
    academic_year_active: 1,
    student_count: 40,
    teacher_count: 0,
  },
  {
    id: 11,
    name: '1BACSEF-1',
    level: 'الأولى باكالوريا العلوم التجريبية – خيار فرنسية',
    branch: null,
    academic_year_id: 8,
    is_active: 1,
    academic_year_name: activeYear,
    academic_year_active: 1,
    student_count: 39,
    teacher_count: 0,
  },
  {
    id: 12,
    name: '2BACSPF-1',
    level: 'الثانية باكالوريا العلوم الفيزيائية – خ. فرنسية',
    branch: null,
    academic_year_id: 8,
    is_active: 1,
    academic_year_name: activeYear,
    academic_year_active: 1,
    student_count: 32,
    teacher_count: 0,
  },
  {
    id: 13,
    name: 'DEMO-2BAC-A',
    level: '2BAC',
    branch: 'SP',
    academic_year_id: 1,
    is_active: 1,
    academic_year_name: previousYear,
    academic_year_active: 0,
    student_count: 2,
    teacher_count: 0,
  },
]

describe('AdminClassesPage', () => {
  afterEach(() => vi.restoreAllMocks())

  test('defaults to active academic year, groups imported level codes, and shows real relationship counts', async () => {
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: importedClasses })

    render(
      <MemoryRouter initialEntries={['/app/admin/classes']}>
        <I18nProvider>
          <AdminClassesPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const yearSelect = await screen.findByRole('combobox', { name: 'Academic year' })
    expect(yearSelect).toHaveValue('active')
    expect(screen.getByText('TCSF-1')).toBeInTheDocument()
    expect(screen.getByText('1BACSEF-1')).toBeInTheDocument()
    expect(screen.getByText('2BACSPF-1')).toBeInTheDocument()
    expect(screen.queryByText('DEMO-2BAC-A')).not.toBeInTheDocument()

    const levelSelect = screen.getByRole('combobox', { name: 'Level' })
    fireEvent.change(levelSelect, { target: { value: '1BAC' } })
    expect(screen.getByText('1BACSEF-1')).toBeInTheDocument()
    expect(screen.queryByText('TCSF-1')).not.toBeInTheDocument()
    expect(screen.queryByText('2BACSPF-1')).not.toBeInTheDocument()

    fireEvent.change(levelSelect, { target: { value: 'all' } })
    const classRow = screen.getByRole('row', { name: /TCSF-1/ })
    expect(within(classRow).getByText('40')).toBeInTheDocument()
    expect(within(classRow).getByText('0')).toBeInTheDocument()
  })

  test('opens class editing in a visible accessible dialog and submits changes', async () => {
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: importedClasses })
    const updateSpy = vi.spyOn(adminApi, 'updateClass').mockResolvedValue({ id: 11 })

    render(
      <MemoryRouter initialEntries={['/app/admin/classes']}>
        <I18nProvider>
          <AdminClassesPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const classRow = await screen.findByRole('row', { name: /1BACSEF-1/ })
    fireEvent.click(within(classRow).getByRole('button', { name: 'Edit' }))

    const dialog = screen.getByRole('dialog', { name: 'Edit class' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'Class' })).toHaveValue('1BACSEF-1')

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Class' }), {
      target: { value: '1BACSEF-1-Updated' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        id: 11,
        name: '1BACSEF-1-Updated',
        level: importedClasses[1]!.level,
        branch: undefined,
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit class' })).not.toBeInTheDocument()
    })
  })
})

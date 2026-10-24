import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass } from '../../features/admin/types.ts'
import { studentsApi } from '../../features/students/api.ts'
import type { Student } from '../../features/students/types.ts'
import { AdminStudentsPage } from './AdminStudentsPage.tsx'

const classes: AdminClass[] = [
  {
    id: 1,
    name: '2BAC SP A',
    level: '2BAC',
    branch: 'SP',
    academic_year_id: 1,
    is_active: 1,
    academic_year_name: '2026/2027',
    academic_year_active: 1,
    student_count: 1,
    teacher_count: 1,
  },
  {
    id: 3,
    name: '2BAC SP A',
    level: '2BAC',
    branch: 'SP',
    academic_year_id: 3,
    is_active: 1,
    academic_year_name: '2027/2028',
    academic_year_active: 0,
    student_count: 1,
    teacher_count: 0,
  },
]

const futureStudent: Student = {
  id: 52,
  student_number: null,
  roster_number: '1',
  massar_code: 'STUDENT-E2E',
  birth_date: '2009-01-02',
  first_name: 'Future',
  last_name: 'Student',
  status: 'active',
  created_at: '2026-10-12 00:00:00',
  updated_at: '2026-10-12 00:00:00',
}

describe('AdminStudentsPage', () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  test('defaults to a class in the active academic year instead of an older demo class', async () => {
    const classesWithActiveYearLast: AdminClass[] = [
      { ...classes[0]!, academic_year_active: 0 },
      { ...classes[1]!, academic_year_active: 1 },
    ]
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: classesWithActiveYearLast })
    const rosterSpy = vi.spyOn(studentsApi, 'forClass').mockImplementation(async (classId) => ({
      students: classId === 3 ? [futureStudent] : [],
    }))

    render(
      <MemoryRouter initialEntries={['/app/admin/students']}>
        <I18nProvider>
          <AdminStudentsPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const selector = await screen.findByRole('combobox', { name: 'Select class' })
    await waitFor(() => {
      expect(selector).toHaveValue('3')
      expect(rosterSpy).toHaveBeenCalledWith(3, expect.any(AbortSignal))
      expect(screen.getByText('Future Student')).toBeInTheDocument()
    })
  })

  test('groups imported class codes by study level and preserves roster-number ordering', async () => {
    const importedClasses: AdminClass[] = [
      {
        ...classes[0]!,
        id: 10,
        name: 'TCSF-1',
        level: 'الجذع المشترك العلمي – خيار فرنسية',
        academic_year_id: 8,
        academic_year_name: '2027/2028',
        academic_year_active: 1,
      },
      {
        ...classes[0]!,
        id: 11,
        name: '1BACSEF-1',
        level: 'الأولى باكالوريا العلوم التجريبية – خيار فرنسية',
        academic_year_id: 8,
        academic_year_name: '2027/2028',
        academic_year_active: 1,
      },
      {
        ...classes[0]!,
        id: 12,
        name: '2BACSPF-1',
        level: 'الثانية باكالوريا العلوم الفيزيائية – خيار فرنسية',
        academic_year_id: 8,
        academic_year_name: '2027/2028',
        academic_year_active: 1,
      },
      {
        ...classes[0]!,
        id: 13,
        name: 'DEMO-2BAC-A',
        level: '2BAC',
        academic_year_id: 1,
        academic_year_name: '2026/2027',
        academic_year_active: 0,
      },
    ]
    const roster: Student[] = [
      { ...futureStudent, id: 202, first_name: 'Amina', last_name: 'Alpha', roster_number: '2', massar_code: 'M-2' },
      { ...futureStudent, id: 201, first_name: 'Youssef', last_name: 'Zed', roster_number: '1', massar_code: 'M-1' },
    ]
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: importedClasses })
    vi.spyOn(studentsApi, 'forClass').mockImplementation(async (classId) => ({
      students: classId === 12 ? roster : [],
    }))

    render(
      <MemoryRouter initialEntries={['/app/admin/students']}>
        <I18nProvider>
          <AdminStudentsPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const selector = await screen.findByRole('combobox', { name: 'Select class' })
    expect(selector).toHaveValue('12')
    expect(screen.queryByRole('option', { name: 'DEMO-2BAC-A · 2026/2027' })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'TC' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '1BAC' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '2BAC' })).toBeInTheDocument()
    expect([...selector.querySelectorAll('optgroup')].map((group) => group.label)).toEqual([
      '2BAC',
      '1BAC',
      'TC',
    ])

    const table = await screen.findByRole('table', { name: 'Students' })
    const dataRows = within(table).getAllByRole('row').slice(1)
    expect(within(dataRows[0]!).getAllByRole('cell')[0]).toHaveTextContent('1')
    expect(within(dataRows[0]!).getByText('Youssef Zed')).toBeInTheDocument()
    expect(within(dataRows[1]!).getAllByRole('cell')[0]).toHaveTextContent('2')
    expect(within(dataRows[1]!).getByText('Amina Alpha')).toBeInTheDocument()
  })

  test('defaults transfer effective date to the local calendar day', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T12:30:00.000Z'))
    const transferClasses: AdminClass[] = [
      { ...classes[0]!, id: 1, name: '2BAC SP A' },
      { ...classes[0]!, id: 2, name: '2BAC SP B' },
    ]
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: transferClasses })
    vi.spyOn(studentsApi, 'forClass').mockResolvedValue({ students: [futureStudent] })

    render(
      <MemoryRouter initialEntries={['/app/admin/students']} >
        <I18nProvider>
          <AdminStudentsPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await screen.findByText('Future Student')
    fireEvent.click(screen.getByRole('button', { name: 'Transfer student' }))

    const localDate = new Date()
    const expected = localDate.getFullYear()
      + '-' + String(localDate.getMonth() + 1).padStart(2, '0')
      + '-' + String(localDate.getDate()).padStart(2, '0')
    expect(screen.getByLabelText('Effective date')).toHaveValue(expected)
    vi.useRealTimers()
  })

  test('shows students enrolled in an inactive future year as a read-only roster', async () => {
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes })
    const rosterSpy = vi.spyOn(studentsApi, 'forClass').mockImplementation(async (classId) => ({
      students: classId === 3 ? [futureStudent] : [],
    }))

    render(
      <MemoryRouter initialEntries={['/app/admin/students?class_id=3']}>
        <I18nProvider>
          <AdminStudentsPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    const selector = await screen.findByRole('combobox', { name: 'Select class' })
    expect(screen.getByRole('option', { name: '2BAC SP A · 2027/2028' })).toBeInTheDocument()

    fireEvent.change(selector, { target: { value: '3' } })

    await waitFor(() => {
      expect(rosterSpy).toHaveBeenCalledWith(3, expect.any(AbortSignal))
      expect(screen.getByText('Future Student')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Transfer student' })).toBeDisabled()
  })
})

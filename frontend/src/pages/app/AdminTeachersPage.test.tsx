import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass, AdminSubject, AdminTeacher, AdminTeaching } from '../../features/admin/types.ts'
import { AdminTeachersPage } from './AdminTeachersPage.tsx'

const teacher = (id: number, online: boolean, fullName = 'Teacher One'): AdminTeacher => ({
  id,
  username: `teacher.${id}`,
  employee_id: `T00${id}`,
  full_name: fullName,
  phone: null,
  phone_verified: 1,
  is_active: 1,
  failed_login_attempts: 0,
  locked_until: null,
  last_login_at: null,
  last_seen_at: online ? '2026-10-23 10:00:00' : null,
  is_online: online ? 1 : 0,
})

const subject: AdminSubject = {
  id: 2,
  code: 'MATH',
  name_fr: 'Mathématiques',
  name_ar: 'الرياضيات',
  name_en: 'Mathematics',
  is_active: 1,
}

const schoolClass: AdminClass = {
  id: 3,
  name: '2BAC PC 1',
  level: '2BAC',
  branch: 'PC',
  academic_year_id: 4,
  is_active: 1,
  academic_year_active: 1,
  academic_year_name: '2026-2027',
  student_count: 24,
  teacher_count: 1,
}

const previousYearTeaching: AdminTeaching = {
  id: 19,
  teacher_id: 1,
  subject_id: 2,
  subject_code: 'MATH',
  subject_name_fr: 'Mathématiques',
  subject_name_ar: 'الرياضيات',
  subject_name_en: 'Mathematics',
  class_id: 8,
  class_name: '2BAC PC OLD',
  class_level: '2BAC',
  class_branch: 'PC',
  academic_year_id: 2,
  academic_year_name: '2025-2026',
  class_is_active: 1,
  academic_year_active: 0,
  status: 'active',
  assigned_at: '2026-01-01 09:00:00',
}

function mockWorkspace(
  teachers: AdminTeacher[] = [teacher(1, true)],
  teachings: AdminTeaching[] = [],
) {
  vi.spyOn(adminApi, 'teachers').mockResolvedValue({
    teachers,
    subjects: [subject],
    teachings,
    online_window_seconds: 90,
  })
  vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: [schoolClass] })
  vi.spyOn(adminApi, 'teacherPresence').mockResolvedValue({
    teachers: teachers.map((item) => ({
      id: item.id,
      full_name: item.full_name,
      employee_id: item.employee_id,
      is_active: item.is_active,
      last_seen_at: item.last_seen_at,
      is_online: item.is_online,
    })),
    online_window_seconds: 90,
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <AdminTeachersPage />
      </I18nProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminTeachersPage', () => {
  test('shows the teacher directory and filters by teacher identity', async () => {
    mockWorkspace([teacher(1, true, 'Teacher One'), teacher(2, false, 'Teacher Two')])

    renderPage()

    await waitFor(() => expect(screen.getAllByText('Teacher One').length).toBeGreaterThan(0))
    expect(screen.getAllByText('Teacher Two').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByPlaceholderText(/search teachers/i), { target: { value: 'T002' } })

    expect(screen.queryByText('Teacher One')).not.toBeInTheDocument()
    expect(screen.getAllByText('Teacher Two').length).toBeGreaterThan(0)
  })

  test('does not count an inactive account as online even if its last presence flag is stale', async () => {
    mockWorkspace([{ ...teacher(1, true), is_active: 0 }])

    renderPage()

    await waitFor(() => expect(screen.getAllByText('Teacher One').length).toBeGreaterThan(0))
    const row = screen.getAllByText('Teacher One')[0]?.closest('tr')
    expect(row).toHaveTextContent('Offline')
    expect(row).toHaveTextContent('Inactive')
    expect(screen.getByText('Online teachers', { exact: true }).closest('article')).toHaveTextContent('0')
  })

  test('refreshes presence on the live interval without replacing the workspace with a loading screen', async () => {
    vi.spyOn(adminApi, 'teachers').mockResolvedValue({ teachers: [teacher(1, false)], subjects: [subject], teachings: [], online_window_seconds: 90 })
    vi.spyOn(adminApi, 'teacherPresence').mockResolvedValue({
      teachers: [{ id: 1, full_name: 'Teacher One', employee_id: 'T001', is_active: 1, last_seen_at: '2026-10-23 10:00:00', is_online: 1 }],
      online_window_seconds: 90,
    })
    vi.spyOn(adminApi, 'classes').mockResolvedValue({ classes: [schoolClass] })
    const intervalSpy = vi.spyOn(window, 'setInterval')

    renderPage()
    await waitFor(() => expect(screen.getAllByText('Teacher One').length).toBeGreaterThan(0))

    const presenceTimer = intervalSpy.mock.calls.find(([, delay]) => delay === 30_000)?.[0]
    expect(typeof presenceTimer).toBe('function')
    await act(async () => {
      if (typeof presenceTimer === 'function') presenceTimer()
    })

    await waitFor(() => {
      const row = screen.getAllByText('Teacher One')[0]?.closest('tr')
      expect(row).toHaveTextContent('Online')
    })
    expect(screen.getAllByText('Teacher One').length).toBeGreaterThan(0)
    expect(adminApi.teacherPresence).toHaveBeenCalledTimes(2)
  })

  test('keeps a previous-year teaching assignment visible and marks it inactive', async () => {
    mockWorkspace([teacher(1, true)], [previousYearTeaching])

    renderPage()

    await waitFor(() => expect(screen.getAllByText('2BAC PC OLD').length).toBeGreaterThan(0))
    const classLabels = screen.getAllByText('2BAC PC OLD')
    const teachingRow = classLabels[0]?.closest('tr') ?? classLabels[0]?.closest('article')
    expect(teachingRow).toHaveTextContent('2025-2026')
    expect(teachingRow).toHaveTextContent('Inactive')
    expect(within(teachingRow as HTMLElement).getByRole('button', { name: 'Unassign' })).toBeInTheDocument()
  })

  test('creates a teacher-to-subject-to-class assignment through the admin API', async () => {
    mockWorkspace()
    const assignSpy = vi.spyOn(adminApi, 'assignTeaching').mockResolvedValue({ id: 71 })

    renderPage()
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Teacher' })).toBeInTheDocument())

    fireEvent.change(screen.getByRole('combobox', { name: 'Teacher' }), { target: { value: '1' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Subject' }), { target: { value: '2' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'Class' }), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))

    await waitFor(() => expect(assignSpy).toHaveBeenCalledWith({
      teacher_id: 1,
      subject_id: 2,
      class_id: 3,
    }))
  })

  test('supports creating a subject with the three localized names', async () => {
    mockWorkspace()
    const createSubjectSpy = vi.spyOn(adminApi, 'createSubject').mockResolvedValue({ id: 8 })

    renderPage()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create subject' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Create subject' }))

    fireEvent.change(screen.getByRole('textbox', { name: 'Subject code' }), { target: { value: 'SCI' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject name · FR' }), { target: { value: 'Sciences' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject name · AR' }), { target: { value: 'العلوم' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject name · EN' }), { target: { value: 'Science' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(createSubjectSpy).toHaveBeenCalledWith({
      code: 'SCI',
      name_fr: 'Sciences',
      name_ar: 'العلوم',
      name_en: 'Science',
    }))
  })
})

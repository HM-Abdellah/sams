import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '../../app/providers/I18nProvider.tsx'
import type { AdminDashboard } from '../../features/admin/types.ts'
import { adminApi } from '../../features/admin/api.ts'
import { AdminDashboardPage } from './AdminDashboardPage.tsx'

const dashboard: AdminDashboard = {
  date: '2026-10-01',
  academic_year: {
    id: 1,
    name: '2026-2027',
    starts_on: '2026-09-01',
    ends_on: '2027-07-31',
  },
  absence_alert_threshold: 5,
  summary: {
    active_classes: 2,
    active_students: 42,
    active_teachers: 8,
    online_teachers: 2,
    unverified_teachers: 1,
    locked_teachers: 1,
    today_records: 32,
    today_present: 24,
    today_absent: 5,
    today_late: 2,
    today_excused: 1,
    today_presence_rate: 75,
  },
  attendance_trend: [
    {
      date: '2026-09-28',
      record_count: 30,
      present_count: 21,
      absent_count: 6,
      late_count: 2,
      excused_count: 1,
      presence_rate: 70,
    },
    {
      date: '2026-09-29',
      record_count: 31,
      present_count: 23,
      absent_count: 5,
      late_count: 2,
      excused_count: 1,
      presence_rate: 74.2,
    },
    {
      date: '2026-09-30',
      record_count: 0,
      present_count: 0,
      absent_count: 0,
      late_count: 0,
      excused_count: 0,
      presence_rate: null,
    },
    {
      date: '2026-10-01',
      record_count: 32,
      present_count: 24,
      absent_count: 5,
      late_count: 2,
      excused_count: 1,
      presence_rate: 75,
    },
  ],
  online_teachers: [
    {
      id: 7,
      full_name: 'Teacher One',
      employee_id: 'T001',
      last_seen_at: '2026-10-01 20:00:00',
    },
  ],
  class_stats: [
    {
      id: 1,
      name: '2BAC SP A',
      level: '2BAC',
      branch: 'SP',
      academic_year_id: 1,
      academic_year_name: '2026-2027',
      student_count: 20,
      today_records: 16,
      present_count: 12,
      absent_count: 3,
      late_count: 1,
      excused_count: 0,
    },
  ],
  attention_students: [
    {
      id: 11,
      first_name: 'Student',
      last_name: 'One',
      class_id: 1,
      class_name: '2BAC SP A',
      class_level: '2BAC',
      class_branch: 'SP',
      absent_count: 5,
      late_count: 1,
    },
  ],
  classes_without_today_records: [
    {
      id: 2,
      name: '2BAC SP B',
      level: '2BAC',
      branch: 'SP',
      academic_year_name: '2026-2027',
    },
  ],
  recent_audit: [],
}

describe('AdminDashboardPage', () => {
  test('renders the operational dashboard from the canonical snapshot', async () => {
    vi.spyOn(adminApi, 'dashboard').mockResolvedValueOnce(dashboard)

    render(
      <MemoryRouter initialEntries={['/app/admin/dashboard']}>
        <I18nProvider>
          <AdminDashboardPage />
        </I18nProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Attendance today')).toBeInTheDocument()
    })

    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Teacher One')).toBeInTheDocument()
    expect(screen.getByText('Student One')).toBeInTheDocument()
    expect(screen.getByText('2BAC SP B')).toBeInTheDocument()
    expect(screen.getByText('Attendance trend')).toBeInTheDocument()
    expect(screen.getByText('Needs attention')).toBeInTheDocument()
    expect(screen.getByText('Quick actions')).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Class statistics' })).toBeInTheDocument()
  })
})

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const base = 'http://127.0.0.1:8080/'
const out = '/workspaces/sams/artifacts/admin-dashboard-review'
mkdirSync(out, { recursive: true })

const dashboard = {
  date: '2026-10-01',
  academic_year: { id: 1, name: '2026/2027', starts_on: '2026-09-01', ends_on: '2027-07-31' },
  absence_alert_threshold: 5,
  summary: {
    active_classes: 8, active_students: 312, active_teachers: 19, online_teachers: 7,
    unverified_teachers: 0, locked_teachers: 1, today_records: 1860,
    today_present: 1620, today_absent: 150, today_late: 62, today_excused: 28, today_presence_rate: 87.1
  },
  attendance_trend: [
    { date: '2026-09-22', record_count: 1700, present_count: 1490, absent_count: 140, late_count: 48, excused_count: 22, presence_rate: 87.6 },
    { date: '2026-09-23', record_count: 1760, present_count: 1538, absent_count: 148, late_count: 52, excused_count: 22, presence_rate: 87.4 },
    { date: '2026-09-24', record_count: 0, present_count: 0, absent_count: 0, late_count: 0, excused_count: 0, presence_rate: null },
    { date: '2026-09-25', record_count: 1810, present_count: 1580, absent_count: 146, late_count: 58, excused_count: 26, presence_rate: 87.3 },
    { date: '2026-09-28', record_count: 1840, present_count: 1600, absent_count: 151, late_count: 61, excused_count: 28, presence_rate: 87.0 },
    { date: '2026-09-29', record_count: 1830, present_count: 1597, absent_count: 149, late_count: 58, excused_count: 26, presence_rate: 87.3 },
    { date: '2026-09-30', record_count: 0, present_count: 0, absent_count: 0, late_count: 0, excused_count: 0, presence_rate: null },
    { date: '2026-10-01', record_count: 1860, present_count: 1620, absent_count: 150, late_count: 62, excused_count: 28, presence_rate: 87.1 }
  ],
  online_teachers: [
    { id: 1, full_name: 'SAMS Demo Teacher', employee_id: 'T001', last_seen_at: '2026-10-01 09:42:11' },
    { id: 2, full_name: 'Amine El Idrissi', employee_id: 'T014', last_seen_at: '2026-10-01 09:41:52' },
    { id: 3, full_name: 'Sara Bennani', employee_id: 'T022', last_seen_at: '2026-10-01 09:41:31' },
    { id: 4, full_name: 'Yassine Alaoui', employee_id: 'T009', last_seen_at: '2026-10-01 09:40:58' }
  ],
  class_stats: [
    { id: 1, name: '2BACSPF-A', level: '2BAC', branch: 'Sciences Physiques', academic_year_id: 1, academic_year_name: '2026/2027', student_count: 38, today_records: 228, present_count: 202, absent_count: 18, late_count: 6, excused_count: 2, presence_rate: 88.6 },
    { id: 2, name: '2BACSPF-B', level: '2BAC', branch: 'Sciences Physiques', academic_year_id: 1, academic_year_name: '2026/2027', student_count: 39, today_records: 230, present_count: 201, absent_count: 21, late_count: 5, excused_count: 3, presence_rate: 87.4 },
    { id: 3, name: '1BACSMA-A', level: '1BAC', branch: 'Sciences Mathématiques', academic_year_id: 1, academic_year_name: '2026/2027', student_count: 41, today_records: 236, present_count: 210, absent_count: 17, late_count: 6, excused_count: 3, presence_rate: 89.0 }
  ],
  attention_students: [
    { id: 11, first_name: 'Lina', last_name: 'Demo', class_id: 1, class_name: '2BACSPF-A', class_level: '2BAC', class_branch: 'Sciences Physiques', absent_count: 7, late_count: 2 },
    { id: 12, first_name: 'Youssef', last_name: 'Alaoui', class_id: 2, class_name: '2BACSPF-B', class_level: '2BAC', class_branch: 'Sciences Physiques', absent_count: 6, late_count: 1 }
  ],
  classes_without_today_records: [
    { id: 6, name: '1BACSM-B', level: '1BAC', branch: 'Sciences Mathématiques', academic_year_name: '2026/2027' },
    { id: 8, name: '2BACSVT-A', level: '2BAC', branch: 'Sciences de la Vie et de la Terre', academic_year_name: '2026/2027' }
  ],
  recent_audit: [
    { id: 4, action: 'attendance.updated', entity_type: 'attendance', entity_id: 44, created_at: '2026-10-01 09:43:00', full_name: 'SAMS Demo Teacher', username: 'teacher.demo' },
    { id: 3, action: 'user.login', entity_type: 'user', entity_id: 2, created_at: '2026-10-01 09:41:52', full_name: 'Amine El Idrissi', username: 'amine.elidrissi' },
    { id: 2, action: 'onboarding.approved', entity_type: 'onboarding_request', entity_id: 8, created_at: '2026-10-01 09:37:18', full_name: 'SAMS Demo Administrator', username: 'admin.demo' }
  ]
}

const session = {
  authenticated: true,
  csrf: 'review-token',
  user: {
    id: 99,
    school_id: 1,
    employee_id: 'ADMIN-001',
    full_name: 'SAMS Demo Administrator',
    role: 'admin',
    account_status: 'active'
  }
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US', deviceScaleFactor: 1 })
const page = await context.newPage()

await page.route('**/api/v1/auth/session', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: session }) })
})
await page.route('**/api/v1/admin/dashboard', async (route) => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: dashboard }) })
})

const results = []
for (const size of [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-320x640', width: 320, height: 640 }
]) {
  await page.setViewportSize({ width: size.width, height: size.height })
  await page.goto(base + 'app/admin/dashboard', { waitUntil: 'networkidle' })
  const heading = await page.getByRole('heading', { name: 'Dashboard' }).isVisible().catch(() => false)
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }))
  const screenshot = out + '/' + size.name + '.png'
  await page.screenshot({ path: screenshot, fullPage: true })
  results.push({ name: size.name, heading, overflow: metrics.documentWidth > metrics.viewport || metrics.bodyWidth > metrics.viewport, metrics, screenshot })
}

console.log(JSON.stringify(results, null, 2))
await browser.close()


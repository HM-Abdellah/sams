import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { adminApi } from '../../features/admin/api.ts'
import type { DashboardTrendPoint } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, dateTime } from '../../features/admin/helpers.ts'
import { Badge, Button, EmptyState, ErrorState, Loading, PageHeader, Table } from '../../components/ui/index.ts'

const trendViewBox = '0 0 100 100'

export function AdminDashboardPage() {
  const { t, formatDate, formatNumber } = useI18n()
  const load = useCallback(() => adminApi.dashboard(), [])
  const resource = useAdminResource(load)

  if (resource.status === 'idle' || resource.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }

  if (resource.status === 'error' || resource.data === null) {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />
    )
  }

  const { summary, academic_year, attendance_trend, online_teachers } = resource.data
  const todayTotal = asNumber(summary.today_records)
  const statusTotal = asNumber(summary.today_present)
    + asNumber(summary.today_absent)
    + asNumber(summary.today_late)
    + asNumber(summary.today_excused)

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        eyebrow={academic_year?.name ?? 'SAMS'}
        title={t(TRANSLATION_KEYS.navigation.dashboard)}
        description={`${t(TRANSLATION_KEYS.admin.dashboardDate)}: ${formatDate(resource.data.date)}`}
        actions={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />

      <section className="sams-card grid gap-5 p-5 sm:grid-cols-3" aria-labelledby="admin-dashboard-context">
        <div>
          <p id="admin-dashboard-context" className="sams-section-label">{t(TRANSLATION_KEYS.admin.academicYear)}</p>
          <p className="mt-1 font-semibold text-[var(--sams-text)]">{academic_year?.name ?? '—'}</p>
        </div>
        <div>
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.dashboardDate)}</p>
          <p className="mt-1 font-semibold text-[var(--sams-text)]">{formatDate(resource.data.date, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div>
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.academicYear)}</p>
          <p className="mt-1 text-sm text-[var(--sams-muted)]">
            {academic_year
              ? `${formatDate(academic_year.starts_on)} – ${formatDate(academic_year.ends_on)}`
              : '—'}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={t(TRANSLATION_KEYS.admin.activeStudents)} value={formatNumber(asNumber(summary.active_students))} />
        <Metric label={t(TRANSLATION_KEYS.admin.activeClasses)} value={formatNumber(asNumber(summary.active_classes))} />
        <Metric label={t(TRANSLATION_KEYS.admin.activeTeachers)} value={formatNumber(asNumber(summary.active_teachers))} />
        <Metric label={t(TRANSLATION_KEYS.admin.todayPresenceRate)} value={`${summary.today_presence_rate}%`} />
      </div>

      <section className="sams-card p-5 sm:p-6" aria-labelledby="attendance-today-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.overview)}</p>
            <h2 id="attendance-today-title" className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.admin.attendanceToday)}</h2>
          </div>
          <p className="text-sm text-[var(--sams-muted)]">
            {formatNumber(todayTotal)} · {t(TRANSLATION_KEYS.admin.todayRecords)}
          </p>
        </div>

        {todayTotal > 0 && statusTotal > 0 ? (
          <>
            <div className="mt-6 h-4 overflow-hidden rounded-full bg-[var(--sams-muted-surface)]" role="img" aria-label={attendanceDistributionLabel(t, summary)}>
              {summary.today_present > 0 && <div className="h-full bg-[var(--sams-success)]" style={{ width: percentage(summary.today_present, statusTotal) }} />}
              {summary.today_absent > 0 && <div className="h-full bg-[var(--sams-danger)]" style={{ width: percentage(summary.today_absent, statusTotal) }} />}
              {summary.today_late > 0 && <div className="h-full bg-[var(--sams-warning)]" style={{ width: percentage(summary.today_late, statusTotal) }} />}
              {summary.today_excused > 0 && <div className="h-full bg-[var(--sams-excused)]" style={{ width: percentage(summary.today_excused, statusTotal) }} />}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatusStat label={t(TRANSLATION_KEYS.admin.present)} value={summary.today_present} variant="success" formatNumber={formatNumber} />
              <StatusStat label={t(TRANSLATION_KEYS.admin.absent)} value={summary.today_absent} variant="danger" formatNumber={formatNumber} />
              <StatusStat label={t(TRANSLATION_KEYS.teacher.late)} value={summary.today_late} variant="warning" formatNumber={formatNumber} />
              <StatusStat label={t(TRANSLATION_KEYS.teacher.excused)} value={summary.today_excused} variant="neutral" formatNumber={formatNumber} />
            </div>
          </>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-[var(--sams-border)] p-5 text-sm text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.admin.noTodayAttendance)}
          </p>
        )}
      </section>

      <section className="sams-card p-5 sm:p-6" aria-labelledby="attendance-trend-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.overview)}</p>
            <h2 id="attendance-trend-title" className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.admin.attendanceTrend)}</h2>
          </div>
          <TrendSummary points={attendance_trend} />
        </div>

        <figure className="mt-6">
          <svg
            viewBox={trendViewBox}
            className="h-48 w-full overflow-visible"
            role="img"
            aria-labelledby="attendance-trend-title attendance-trend-description"
            preserveAspectRatio="none"
          >
            <title>{t(TRANSLATION_KEYS.admin.attendanceTrend)}</title>
            <desc id="attendance-trend-description">
              {attendance_trend
                .map((point) => `${formatDate(point.date)}: ${point.presence_rate === null ? '—' : `${point.presence_rate}%`}`)
                .join(' · ')}
            </desc>
            <line x1="0" y1="0" x2="0" y2="100" stroke="var(--sams-border)" strokeWidth="0.6" />
            <line x1="0" y1="100" x2="100" y2="100" stroke="var(--sams-border)" strokeWidth="0.6" />
            <path d={buildTrendPath(attendance_trend)} fill="none" stroke="var(--sams-brand-accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--sams-muted)]">
            <span>{attendance_trend[0] ? formatDate(attendance_trend[0].date) : '—'}</span>
            <span>{attendance_trend[attendance_trend.length - 1] ? formatDate(attendance_trend[attendance_trend.length - 1].date) : '—'}</span>
          </div>
          <figcaption className="mt-4 rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)]/50 p-3 text-sm text-[var(--sams-muted)]">
            {attendanceTrendDataText(attendance_trend, formatDate, formatNumber)}
          </figcaption>
        </figure>
      </section>

      <section className="space-y-4" aria-labelledby="needs-attention-title">
        <div>
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.operations)}</p>
          <h2 id="needs-attention-title" className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.admin.needsAttention)}</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <AttentionPanel
            title={t(TRANSLATION_KEYS.admin.classesWithoutToday)}
            empty={t(TRANSLATION_KEYS.admin.noMissingClasses)}
            count={resource.data.classes_without_today_records.length}
          >
            {resource.data.classes_without_today_records.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b border-[var(--sams-border)] py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-[var(--sams-muted)]">{item.academic_year_name}</p>
                </div>
                <Link className="sams-interactive-target shrink-0 inline-flex items-center rounded-md px-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:underline" to="/app/admin/classes">
                  {t(TRANSLATION_KEYS.admin.classes)}
                </Link>
              </li>
            ))}
          </AttentionPanel>

          <AttentionPanel
            title={t(TRANSLATION_KEYS.admin.attentionStudents)}
            empty={t(TRANSLATION_KEYS.admin.noAttentionStudents)}
            count={resource.data.attention_students.length}
          >
            {resource.data.attention_students.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 border-b border-[var(--sams-border)] py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.first_name} {item.last_name}</p>
                  <p className="truncate text-xs text-[var(--sams-muted)]">{item.class_name}</p>
                </div>
                <Badge variant="danger">{formatNumber(asNumber(item.absent_count))} {t(TRANSLATION_KEYS.admin.absences)}</Badge>
              </li>
            ))}
          </AttentionPanel>

          <section className="sams-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.security)}</p>
                <h3 className="mt-1 text-base font-semibold">{t(TRANSLATION_KEYS.admin.userAdminHint)}</h3>
              </div>
              <Link className="sams-interactive-target inline-flex shrink-0 items-center rounded-md px-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:underline" to="/app/admin/users">
                {t(TRANSLATION_KEYS.admin.users)}
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SecurityStat label={t(TRANSLATION_KEYS.admin.unverifiedTeachers)} value={summary.unverified_teachers} variant="warning" />
              <SecurityStat label={t(TRANSLATION_KEYS.admin.lockedTeachers)} value={summary.locked_teachers} variant="danger" />
            </div>
          </section>
        </div>
      </section>

      <section className="sams-card p-5 sm:p-6" aria-labelledby="online-teachers-title">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.operations)}</p>
            <h2 id="online-teachers-title" className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.admin.onlineTeachers)}</h2>
          </div>
          <Link className="sams-interactive-target inline-flex items-center rounded-md px-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:underline" to="/app/admin/teachers">
            {t(TRANSLATION_KEYS.admin.teacherDirectory)}
          </Link>
        </div>
        {online_teachers.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.noOnlineTeachers)} />
        ) : (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {online_teachers.map((teacher) => (
              <li key={teacher.id} className="rounded-xl border border-[var(--sams-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{teacher.full_name}</p>
                    <p className="mt-1 truncate text-xs text-[var(--sams-muted)]">{teacher.employee_id ?? '—'}</p>
                  </div>
                  <Badge variant="success">{t(TRANSLATION_KEYS.admin.online)}</Badge>
                </div>
                <p className="mt-3 text-xs text-[var(--sams-muted)]">{dateTime(teacher.last_seen_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="class-health-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.overview)}</p>
            <h2 id="class-health-title" className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.admin.classStatistics)}</h2>
          </div>
          <Link className="sams-interactive-target inline-flex items-center rounded-md px-2 text-sm font-medium underline-offset-4 hover:underline focus-visible:underline" to="/app/admin/classes">
            {t(TRANSLATION_KEYS.admin.classes)}
          </Link>
        </div>
        {resource.data.class_stats.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.noClassStats)} />
        ) : (
          <Table
            caption={t(TRANSLATION_KEYS.admin.classStatistics)}
            headers={[
              t(TRANSLATION_KEYS.admin.className),
              t(TRANSLATION_KEYS.admin.students),
              t(TRANSLATION_KEYS.admin.recordsToday),
              t(TRANSLATION_KEYS.admin.todayPresenceRate),
              t(TRANSLATION_KEYS.teacher.late),
              t(TRANSLATION_KEYS.admin.absent),
            ]}
          >
            {resource.data.class_stats.map((item) => {
              const records = asNumber(item.today_records)
              const present = asNumber(item.present_count)
              const rate = records > 0 ? Math.round((present / records) * 1000) / 10 : null
              return (
                <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                  <td className="px-3 py-3 font-medium">{item.name}</td>
                  <td className="px-3 py-3">{formatNumber(asNumber(item.student_count))}</td>
                  <td className="px-3 py-3">{formatNumber(records)}</td>
                  <td className="px-3 py-3">{rate === null ? '—' : `${rate}%`}</td>
                  <td className="px-3 py-3">{formatNumber(asNumber(item.late_count))}</td>
                  <td className="px-3 py-3">{formatNumber(asNumber(item.absent_count))}</td>
                </tr>
              )
            })}
          </Table>
        )}
      </section>

      <section className="sams-card p-5 sm:p-6" aria-labelledby="quick-actions-title">
        <div>
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.operations)}</p>
          <h2 id="quick-actions-title" className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.admin.quickActions)}</h2>
        </div>
        <nav className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={t(TRANSLATION_KEYS.admin.quickActions)}>
          {[
            ['/app/admin/classes', t(TRANSLATION_KEYS.admin.classes)],
            ['/app/admin/teachers', t(TRANSLATION_KEYS.navigation.teachers)],
            ['/app/admin/users', t(TRANSLATION_KEYS.navigation.users)],
            ['/app/admin/onboarding', t(TRANSLATION_KEYS.navigation.onboarding)],
            ['/app/admin/imports', t(TRANSLATION_KEYS.navigation.imports)],
            ['/app/admin/academic-years', t(TRANSLATION_KEYS.navigation.academicYears)],
            ['/app/admin/archive', t(TRANSLATION_KEYS.navigation.archive)],
            ['/app/admin/audit', t(TRANSLATION_KEYS.navigation.audit)],
          ].map(([href, label]) => (
            <Link key={href} to={href} className="sams-interactive-target flex items-center justify-between rounded-xl border border-[var(--sams-border)] px-4 py-3 text-sm font-medium hover:bg-[var(--sams-muted-surface)] focus-visible:bg-[var(--sams-muted-surface)]">
              <span>{label}</span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
      </section>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="sams-card p-5">
      <p className="text-sm text-[var(--sams-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sams-text)]">{value}</p>
    </article>
  )
}

function StatusStat({
  label,
  value,
  variant,
  formatNumber,
}: {
  label: string
  value: number | string
  variant: 'success' | 'danger' | 'warning' | 'neutral'
  formatNumber: (value: number) => string
}) {
  const valueClass = variant === 'success'
    ? 'text-[var(--sams-success)]'
    : variant === 'danger'
      ? 'text-[var(--sams-danger)]'
      : variant === 'warning'
        ? 'text-[var(--sams-warning)]'
        : 'text-[var(--sams-text)]'

  return (
    <div className="rounded-xl border border-[var(--sams-border)] p-4">
      <p className="text-sm text-[var(--sams-muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${valueClass}`}>{formatNumber(asNumber(value))}</p>
    </div>
  )
}

function AttentionPanel({
  title,
  empty,
  count,
  children,
}: {
  title: string
  empty: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="sams-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        <span className="text-sm tabular-nums text-[var(--sams-muted)]">{count}</span>
      </div>
      {count > 0 ? <ul className="mt-3">{children}</ul> : <p className="mt-3 text-sm leading-6 text-[var(--sams-muted)]">{empty}</p>}
    </section>
  )
}

function SecurityStat({
  label,
  value,
  variant,
}: {
  label: string
  value: number | string
  variant: 'warning' | 'danger'
}) {
  return (
    <div className="rounded-xl border border-[var(--sams-border)] p-4">
      <p className="text-sm text-[var(--sams-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${variant === 'danger' ? 'text-[var(--sams-danger)]' : 'text-[var(--sams-warning)]'}`}>
        {asNumber(value)}
      </p>
    </div>
  )
}

function TrendSummary({ points }: { points: DashboardTrendPoint[] }) {
  const recorded = points.filter((point) => point.presence_rate !== null)
  if (recorded.length === 0) return <p className="text-sm text-[var(--sams-muted)]">—</p>

  const first = recorded[0].presence_rate ?? 0
  const latest = recorded.at(-1)?.presence_rate ?? first
  const delta = Math.round((latest - first) * 10) / 10
  return (
    <p className="text-sm tabular-nums text-[var(--sams-muted)]">
      {latest}% · {delta > 0 ? '+' : ''}{delta} pts
    </p>
  )
}

function buildTrendPath(points: DashboardTrendPoint[]): string {
  if (points.length < 1) return ''
  const segments: string[] = []
  let segment = ''

  points.forEach((point, index) => {
    if (point.presence_rate === null) {
      if (segment) segments.push(segment)
      segment = ''
      return
    }

    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100
    const y = 100 - Math.max(0, Math.min(100, point.presence_rate))

    segment += segment ? ` L ${x.toFixed(2)} ${y.toFixed(2)}` : `M ${x.toFixed(2)} ${y.toFixed(2)}`
  })

  if (segment) segments.push(segment)
  return segments.join(' ')
}

function percentage(value: number | string, total: number): string {
  return `${(asNumber(value) / total) * 100}%`
}

function attendanceDistributionLabel(
  t: ReturnType<typeof useI18n>['t'],
  summary: {
    today_present: number | string
    today_absent: number | string
    today_late: number | string
    today_excused: number | string
  },
): string {
  return [
    `${t(TRANSLATION_KEYS.admin.present)} ${asNumber(summary.today_present)}`,
    `${t(TRANSLATION_KEYS.admin.absent)} ${asNumber(summary.today_absent)}`,
    `${t(TRANSLATION_KEYS.teacher.late)} ${asNumber(summary.today_late)}`,
    `${t(TRANSLATION_KEYS.teacher.excused)} ${asNumber(summary.today_excused)}`,
  ].join(', ')
}

function attendanceTrendDataText(
  points: DashboardTrendPoint[],
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string,
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string,
): string {
  return points
    .map((point) => `${formatDate(point.date)} · ${point.presence_rate === null ? '—' : `${point.presence_rate}%`} · ${formatNumber(asNumber(point.record_count))}`)
    .join(' | ')
}

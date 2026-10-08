import { useCallback, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminDashboard, DashboardTrendPoint } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, dateTime } from '../../features/admin/helpers.ts'
import { Badge, Button, EmptyState, ErrorState, Loading, PageHeader, Table } from '../../components/ui/index.ts'

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
        action={
          <Button type="button" variant="secondary" onClick={() => void resource.reload()}>
            {t(TRANSLATION_KEYS.system.reload)}
          </Button>
        }
      />
    )
  }

  const dashboard = resource.data
  const { summary, academic_year, attendance_trend, online_teachers } = dashboard

  return (
    <section className="sams-admin-page space-y-7 sm:space-y-8">
      <PageHeader
        className="sams-admin-page-header"
        eyebrow={academic_year?.name ?? 'SAMS'}
        title={t(TRANSLATION_KEYS.navigation.dashboard)}
        description={
          t(TRANSLATION_KEYS.admin.dashboardDate)
          + ' · '
          + formatDate(dashboard.date, { weekday: 'long', month: 'long', day: 'numeric' })
        }
        actions={
          <Button type="button" variant="secondary" onClick={() => void resource.reload()}>
            {t(TRANSLATION_KEYS.system.reload)}
          </Button>
        }
      />

      <TodayOverview dashboard={dashboard} t={t} formatNumber={formatNumber} />

      <section
        className="overflow-hidden rounded-[var(--sams-radius-surface)] border border-[var(--sams-border)] bg-[var(--sams-surface)]"
        aria-label={t(TRANSLATION_KEYS.admin.overview)}
      >
        <div className="grid bg-[linear-gradient(180deg,var(--sams-brand-surface),var(--sams-surface))] sm:grid-cols-2 lg:grid-cols-4">
          <MetricTile
            label={t(TRANSLATION_KEYS.admin.activeStudents)}
            value={formatNumber(asNumber(summary.active_students))}
          />
          <MetricTile
            label={t(TRANSLATION_KEYS.admin.activeClasses)}
            value={formatNumber(asNumber(summary.active_classes))}
          />
          <MetricTile
            label={t(TRANSLATION_KEYS.admin.activeTeachers)}
            value={formatNumber(asNumber(summary.active_teachers))}
          />
          <MetricTile
            label={t(TRANSLATION_KEYS.admin.onlineTeachers)}
            value={formatNumber(asNumber(summary.online_teachers))}
            {...(asNumber(summary.locked_teachers) > 0
              ? {
                  supporting:
                    formatNumber(asNumber(summary.locked_teachers))
                    + ' '
                    + t(TRANSLATION_KEYS.admin.lockedTeachers).toLowerCase(),
                }
              : {})}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.82fr)]">
        <AttendanceTrend
          points={attendance_trend}
          title={t(TRANSLATION_KEYS.admin.attendanceTrend)}
          formatDate={formatDate}
          formatNumber={formatNumber}
          empty={t(TRANSLATION_KEYS.admin.noTodayAttendance)}
        />
        <AttentionCenter dashboard={dashboard} t={t} formatNumber={formatNumber} />
      </div>

      <section className="space-y-4" aria-labelledby="class-health-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="sams-section-label text-[var(--sams-brand-primary)]">{t(TRANSLATION_KEYS.admin.overview)}</p>
            <h2 id="class-health-title" className="mt-1 text-xl font-semibold tracking-tight">
              {t(TRANSLATION_KEYS.admin.classStatistics)}
            </h2>
          </div>
          <DashboardLink to="/app/admin/classes" label={t(TRANSLATION_KEYS.admin.classes)} />
        </div>

        {dashboard.class_stats.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.noClassStats)} />
        ) : (
          <ClassStatistics dashboard={dashboard} t={t} formatNumber={formatNumber} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <LiveTeachers
          teachers={online_teachers}
          title={t(TRANSLATION_KEYS.admin.onlineTeachers)}
          empty={t(TRANSLATION_KEYS.admin.noOnlineTeachers)}
          directoryLabel={t(TRANSLATION_KEYS.admin.teacherDirectory)}
        />
        <RecentActivity
          items={dashboard.recent_audit}
          title={t(TRANSLATION_KEYS.admin.recentAudit)}
          empty={t(TRANSLATION_KEYS.admin.noAudit)}
          auditLabel={t(TRANSLATION_KEYS.navigation.audit)}
        />
      </div>

      <QuickActions t={t} />
    </section>
  )
}

function TodayOverview({
  dashboard,
  t,
  formatNumber,
}: {
  dashboard: AdminDashboard
  t: ReturnType<typeof useI18n>['t']
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}) {
  const total = asNumber(dashboard.summary.today_records)
  const statusTotal =
    asNumber(dashboard.summary.today_present)
    + asNumber(dashboard.summary.today_absent)

  const items = [
    { label: t(TRANSLATION_KEYS.admin.present), value: asNumber(dashboard.summary.today_present), variant: 'success' as const },
    { label: t(TRANSLATION_KEYS.admin.absent), value: asNumber(dashboard.summary.today_absent), variant: 'danger' as const },
  ]

  return (
    <section
      className="overflow-hidden rounded-[var(--sams-radius-elevated)] border border-[var(--sams-brand-border)] bg-[var(--sams-brand-surface)] shadow-[0_10px_28px_rgba(20,119,173,0.06)]"
      aria-labelledby="admin-today-title"
    >
      <div className="grid lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.55fr)]">
        <div className="border-b border-[var(--sams-brand-border)] bg-[color-mix(in_srgb,var(--sams-brand-canvas)_58%,transparent)] p-5 sm:p-6 lg:border-b-0 lg:border-e">
          <p className="sams-section-label text-[var(--sams-brand-primary)]">{t(TRANSLATION_KEYS.admin.overview)}</p>
          <h2 id="admin-today-title" className="mt-1 text-lg font-semibold tracking-tight">
            {t(TRANSLATION_KEYS.admin.attendanceToday)}
          </h2>
          <div className="mt-5 flex items-end gap-2">
            <strong className="text-4xl font-semibold tracking-[-0.04em] text-[var(--sams-brand-navy)] sm:text-5xl">
              {dashboard.summary.today_presence_rate === null ? '—' : String(dashboard.summary.today_presence_rate) + '%'}
            </strong>
            <span className="pb-1.5 text-sm text-[var(--sams-muted)]">
              {t(TRANSLATION_KEYS.attendance.presenceRate)}
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--sams-muted)]">
            {total > 0
              ? formatNumber(total) + ' ' + t(TRANSLATION_KEYS.admin.todayRecords)
              : t(TRANSLATION_KEYS.admin.noTodayAttendance)}
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--sams-text)]">
                {t(TRANSLATION_KEYS.admin.todayRecords)}
              </p>
              <p className="mt-1 text-xs text-[var(--sams-muted)]">
                {t(TRANSLATION_KEYS.attendance.presenceRateDefinition)}
              </p>
            </div>
            <span className="text-xs font-semibold tabular-nums text-[var(--sams-muted)]">
              {formatNumber(total)}
            </span>
          </div>

          {total > 0 && statusTotal > 0 ? (
            <>
              <div
                className="mt-6 flex h-3 overflow-hidden rounded-full bg-[var(--sams-muted-surface)]"
                role="img"
                aria-label={attendanceDistributionLabel(t, dashboard.summary)}
              >
                {items.map((item) => (
                  item.value > 0 ? (
                    <div
                      key={item.label}
                      className={statusBarClass(item.variant)}
                      style={{ width: String((item.value / statusTotal) * 100) + '%' }}
                    />
                  ) : null
                ))}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--sams-muted-surface)] px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span aria-hidden="true" className={statusDotClass(item.variant)} />
                      <span className="truncate text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="tabular-nums text-sm font-semibold">{formatNumber(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-6 rounded-lg border border-dashed border-[var(--sams-border)] p-4 text-sm text-[var(--sams-muted)]">
              {t(TRANSLATION_KEYS.admin.noTodayAttendance)}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function MetricTile({
  label,
  value,
  supporting,
}: {
  label: string
  value: string | number
  supporting?: string
}) {
  return (
    <article className="min-w-0 border-b border-[var(--sams-border)] p-5 last:border-b-0 lg:border-b-0 lg:border-e lg:last:border-e-0">
      <p className="text-sm font-medium text-[var(--sams-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--sams-text)]">{value}</p>
      {supporting ? <p className="mt-1 text-xs text-[var(--sams-warning)]">{supporting}</p> : null}
    </article>
  )
}

function AttendanceTrend({
  points,
  title,
  formatDate,
  formatNumber,
  empty,
}: {
  points: DashboardTrendPoint[]
  title: string
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  empty: string
}) {
  const recorded = points.filter((point) => point.presence_rate !== null)
  const latest = recorded.at(-1)?.presence_rate ?? null
  const first = recorded.at(0)?.presence_rate ?? null
  const delta = latest !== null && first !== null ? Math.round((latest - first) * 10) / 10 : null

  return (
    <section className="rounded-[var(--sams-radius-surface)] border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5 sm:p-6" aria-labelledby="attendance-trend-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="attendance-trend-heading" className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {latest !== null ? (
              <span className="text-sm font-semibold tabular-nums text-[var(--sams-brand-cobalt)]">
                {String(latest)}%
              </span>
            ) : null}
            {delta !== null ? (
              <span className={delta >= 0 ? 'text-sm font-semibold tabular-nums text-[var(--sams-success)]' : 'text-sm font-semibold tabular-nums text-[var(--sams-danger)]'}>
                {delta > 0 ? '+' : ''}{delta} pts
              </span>
            ) : null}
          </div>
        </div>
        {points.length > 0 ? (
          <p className="text-xs text-[var(--sams-muted)]">
            {formatDate(points.at(0)!.date, { month: 'short', day: 'numeric' })}
            {' – '}
            {formatDate(points.at(-1)!.date, { month: 'short', day: 'numeric' })}
          </p>
        ) : null}
      </div>

      {recorded.length > 0 ? (
        <figure className="mt-5">
          <svg
            viewBox="0 0 100 100"
            className="h-56 w-full overflow-visible"
            role="img"
            aria-labelledby="attendance-trend-heading attendance-trend-description"
            preserveAspectRatio="none"
          >
            <title>{title}</title>
            <desc id="attendance-trend-description">
              {points
                .map((point) =>
                  formatDate(point.date) + ': '
                  + (point.presence_rate === null ? '—' : String(point.presence_rate) + '%')
                )
                .join(' · ')}
            </desc>

            {[25, 50, 75].map((value) => (
              <line
                key={value}
                x1="0"
                y1={100 - value}
                x2="100"
                y2={100 - value}
                stroke="var(--sams-border)"
                strokeWidth="0.4"
                strokeDasharray="1.5 2"
              />
            ))}
            <line x1="0" y1="100" x2="100" y2="100" stroke="var(--sams-border)" strokeWidth="0.6" />

            <path
              d={buildTrendPath(recorded)}
              fill="none"
              stroke="var(--sams-brand-cobalt)"
              strokeWidth="2.2"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {buildTrendPoints(recorded).map((point) => (
              <circle
                key={point.key}
                cx={point.x}
                cy={point.y}
                r="2"
                fill="var(--sams-surface)"
                stroke="var(--sams-brand-cobalt)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          <div className="mt-3 flex items-center justify-between gap-4 text-xs text-[var(--sams-muted)]">
            <span>{formatDate(recorded.at(0)!.date)}</span>
            <span>{formatDate(recorded.at(-1)!.date)}</span>
          </div>
          <figcaption className="sr-only">
            {points
              .map((point) =>
                formatDate(point.date)
                + ' '
                + (point.presence_rate === null ? '—' : String(point.presence_rate) + '%')
                + ' '
                + formatNumber(asNumber(point.record_count))
              )
              .join(' · ')}
          </figcaption>
        </figure>
      ) : (
        <EmptyState title={title} description={empty} />
      )}
    </section>
  )
}

function AttentionCenter({
  dashboard,
  t,
  formatNumber,
}: {
  dashboard: AdminDashboard
  t: ReturnType<typeof useI18n>['t']
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}) {
  const missingClasses = dashboard.classes_without_today_records.length
  const attentionStudents = dashboard.attention_students.length
  const lockedTeachers = asNumber(dashboard.summary.locked_teachers)
  const issueCount = missingClasses + attentionStudents + (lockedTeachers > 0 ? 1 : 0)

  return (
    <section className="rounded-[var(--sams-radius-surface)] border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5 sm:p-6" aria-labelledby="attention-center-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.operations)}</p>
          <h2 id="attention-center-title" className="mt-1 text-xl font-semibold tracking-tight">
            {t(TRANSLATION_KEYS.admin.needsAttention)}
          </h2>
        </div>
        <span className="grid min-w-8 place-items-center rounded-full bg-[var(--sams-warning-surface)] px-2.5 py-1 text-xs font-bold tabular-nums text-[var(--sams-warning)]">
          {issueCount}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <AttentionGroup
          title={t(TRANSLATION_KEYS.admin.classesWithoutToday)}
          count={missingClasses}
          empty={t(TRANSLATION_KEYS.admin.noMissingClasses)}
        >
          {dashboard.classes_without_today_records.slice(0, 4).map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-[var(--sams-border)] py-3 last:border-b-0">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sams-warning)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="truncate text-xs text-[var(--sams-muted)]">{item.academic_year_name}</p>
              </div>
              <Link
                to="/app/admin/classes"
                className="sams-interactive-target grid shrink-0 place-items-center rounded-md px-2 text-[var(--sams-brand-primary)]"
                aria-label={t(TRANSLATION_KEYS.admin.classes) + ': ' + item.name}
              >
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
        </AttentionGroup>

        <AttentionGroup
          title={t(TRANSLATION_KEYS.admin.attentionStudents)}
          count={attentionStudents}
          empty={t(TRANSLATION_KEYS.admin.noAttentionStudents)}
        >
          {dashboard.attention_students.slice(0, 4).map((item) => (
            <li key={item.id} className="flex items-center gap-3 border-b border-[var(--sams-border)] py-3 last:border-b-0">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sams-danger)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.first_name} {item.last_name}</p>
                <p className="truncate text-xs text-[var(--sams-muted)]">{item.class_name}</p>
              </div>
              <Badge variant="danger">{formatNumber(asNumber(item.absent_count))}</Badge>
            </li>
          ))}
        </AttentionGroup>

        {lockedTeachers > 0 ? (
          <Link
            to="/app/admin/users"
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--sams-warning)]/30 bg-[var(--sams-warning-surface)] px-3.5 py-3 text-sm"
          >
            <div>
              <p className="font-semibold">{t(TRANSLATION_KEYS.admin.lockedTeachers)}</p>
              <p className="mt-0.5 text-xs text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.security)}</p>
            </div>
            <strong className="tabular-nums text-[var(--sams-warning)]">{formatNumber(lockedTeachers)}</strong>
          </Link>
        ) : null}
      </div>
    </section>
  )
}

function AttentionGroup({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs font-semibold tabular-nums text-[var(--sams-muted)]">{count}</span>
      </div>
      {count > 0 ? <ul className="mt-2">{children}</ul> : <p className="mt-2 text-sm leading-6 text-[var(--sams-muted)]">{empty}</p>}
    </section>
  )
}

function ClassStatistics({
  dashboard,
  t,
  formatNumber,
}: {
  dashboard: AdminDashboard
  t: ReturnType<typeof useI18n>['t']
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}) {
  return (
    <Table
      caption={t(TRANSLATION_KEYS.admin.classStatistics)}
      headers={[
        t(TRANSLATION_KEYS.admin.className),
        t(TRANSLATION_KEYS.admin.students),
        t(TRANSLATION_KEYS.admin.recordsToday),
        t(TRANSLATION_KEYS.attendance.presenceRate),
        t(TRANSLATION_KEYS.admin.absent),
      ]}
    >
      {dashboard.class_stats.map((item) => (
        <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
          <td className="px-3 py-3.5 font-semibold sm:px-4">{item.name}</td>
          <td className="px-3 py-3.5 tabular-nums sm:px-4">{formatNumber(asNumber(item.student_count))}</td>
          <td className="px-3 py-3.5 tabular-nums sm:px-4">{formatNumber(asNumber(item.today_records))}</td>
          <td className="min-w-[10rem] px-3 py-3.5 sm:px-4">
            {item.presence_rate === null ? (
              '—'
            ) : (
              <div className="flex items-center gap-3">
                <span className="w-12 shrink-0 tabular-nums">{String(item.presence_rate)}%</span>
                <div className="h-1.5 min-w-20 flex-1 rounded-full bg-[var(--sams-muted-surface)]" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-[var(--sams-brand-cobalt)]"
                    style={{ width: String(Math.max(0, Math.min(100, item.presence_rate))) + '%' }}
                  />
                </div>
              </div>
            )}
          </td>
          <td className="px-3 py-3.5 tabular-nums sm:px-4">{formatNumber(asNumber(item.absent_count))}</td>
        </tr>
      ))}
    </Table>
  )
}

function LiveTeachers({
  teachers,
  title,
  empty,
  directoryLabel,
}: {
  teachers: AdminDashboard['online_teachers']
  title: string
  empty: string
  directoryLabel: string
}) {
  return (
    <section className="rounded-[var(--sams-radius-surface)] border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5 sm:p-6" aria-labelledby="online-teachers-title">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="sams-section-label">SAMS</p>
          <h2 id="online-teachers-title" className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <DashboardLink to="/app/admin/teachers" label={directoryLabel} />
      </div>

      {teachers.length === 0 ? (
        <div className="mt-5">
          <EmptyState title={empty} />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--sams-border)]">
          {teachers.slice(0, 6).map((teacher) => (
            <li key={teacher.id} className="flex items-center gap-3 py-3.5 first:pt-1">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-[var(--sams-success)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{teacher.full_name}</p>
                <p className="truncate text-xs text-[var(--sams-muted)]">{teacher.employee_id ?? '—'}</p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-[var(--sams-muted)]">{dateTime(teacher.last_seen_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentActivity({
  items,
  title,
  empty,
  auditLabel,
}: {
  items: AdminDashboard['recent_audit']
  title: string
  empty: string
  auditLabel: string
}) {
  return (
    <section className="rounded-[var(--sams-radius-surface)] border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5 sm:p-6" aria-labelledby="recent-activity-title">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="sams-section-label">SAMS</p>
          <h2 id="recent-activity-title" className="mt-1 text-lg font-semibold tracking-tight">{title}</h2>
        </div>
        <DashboardLink to="/app/admin/audit" label={auditLabel} />
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-[var(--sams-muted)]">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--sams-border)]">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{item.action}</p>
                <p className="truncate text-xs text-[var(--sams-muted)]">
                  {item.entity_type} · {item.full_name ?? item.username ?? '—'}
                </p>
              </div>
              <p className="text-xs tabular-nums text-[var(--sams-muted)]">{dateTime(item.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function QuickActions({ t }: { t: ReturnType<typeof useI18n>['t'] }) {
  const actions = [
    ['/app/admin/teachers', t(TRANSLATION_KEYS.navigation.teachers)],
    ['/app/admin/students', t(TRANSLATION_KEYS.navigation.students)],
    ['/app/admin/classes', t(TRANSLATION_KEYS.navigation.classes)],
    ['/app/admin/onboarding', t(TRANSLATION_KEYS.navigation.onboarding)],
    ['/app/admin/imports', t(TRANSLATION_KEYS.navigation.imports)],
  ] as const

  return (
    <section className="border-t border-[var(--sams-border)] pt-6" aria-labelledby="quick-actions-title">
      <div>
        <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.operations)}</p>
        <h2 id="quick-actions-title" className="mt-1 text-lg font-semibold tracking-tight">
          {t(TRANSLATION_KEYS.admin.quickActions)}
        </h2>
      </div>

      <nav className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label={t(TRANSLATION_KEYS.admin.quickActions)}>
        {actions.map(([href, label]) => (
          <Link
            key={href}
            to={href}
            className="sams-interactive-target flex items-center justify-between gap-3 rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 py-3 text-sm font-semibold transition-[background-color,border-color] duration-150 hover:border-[var(--sams-brand-border)] hover:bg-[var(--sams-brand-surface)] focus-visible:bg-[var(--sams-brand-surface)]"
          >
            <span>{label}</span>
            <span aria-hidden="true" className="text-[var(--sams-brand-primary)]">→</span>
          </Link>
        ))}
      </nav>
    </section>
  )
}

function DashboardLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="sams-interactive-target inline-flex items-center rounded-md px-2 text-sm font-semibold text-[var(--sams-brand-primary)] underline-offset-4 hover:underline focus-visible:underline"
    >
      {label}
      <span className="ms-1" aria-hidden="true">→</span>
    </Link>
  )
}

function buildTrendPath(points: DashboardTrendPoint[]): string {
  if (points.length === 0) return ''
  return points
    .map((point, index) => {
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100
      const y = 100 - Math.max(0, Math.min(100, point.presence_rate ?? 0))
      return (index === 0 ? 'M' : 'L') + ' ' + x.toFixed(2) + ' ' + y.toFixed(2)
    })
    .join(' ')
}

function buildTrendPoints(points: DashboardTrendPoint[]) {
  return points.map((point, index) => ({
    key: point.date + '-' + index,
    x: points.length === 1 ? 50 : (index / (points.length - 1)) * 100,
    y: 100 - Math.max(0, Math.min(100, point.presence_rate ?? 0)),
  }))
}

function statusBarClass(variant: 'success' | 'danger') {
  return variant === 'success'
    ? 'h-full bg-[var(--sams-success)]'
    : 'h-full bg-[var(--sams-danger)]'
}

function statusDotClass(variant: 'success' | 'danger') {
  return variant === 'success'
    ? 'size-2 shrink-0 rounded-full bg-[var(--sams-success)]'
    : 'size-2 shrink-0 rounded-full bg-[var(--sams-danger)]'
}

function attendanceDistributionLabel(
  t: ReturnType<typeof useI18n>['t'],
  summary: AdminDashboard['summary'],
): string {
  return [
    t(TRANSLATION_KEYS.admin.present) + ' ' + asNumber(summary.today_present),
    t(TRANSLATION_KEYS.admin.absent) + ' ' + asNumber(summary.today_absent),
  ].join(', ')
}


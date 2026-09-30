import { useCallback, type ReactNode } from 'react'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, dateTime } from '../../features/admin/helpers.ts'
import { Badge, Button, EmptyState, ErrorState, Loading, PageHeader, Table } from '../../components/ui/index.ts'

export function AdminDashboardPage() {
  const { t, formatDate } = useI18n()
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

  const { summary, class_stats, attention_students, classes_without_today_records, recent_audit } = resource.data
  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="SAMS"
        title={t(TRANSLATION_KEYS.navigation.dashboard)}
        description={`${t(TRANSLATION_KEYS.admin.dashboardDate)}: ${formatDate(resource.data.date)}`}
        actions={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label={t(TRANSLATION_KEYS.admin.activeClasses)} value={asNumber(summary.active_classes)} />
        <Metric label={t(TRANSLATION_KEYS.admin.activeStudents)} value={asNumber(summary.active_students)} />
        <Metric label={t(TRANSLATION_KEYS.admin.activeTeachers)} value={asNumber(summary.active_teachers)} />
        <Metric label={t(TRANSLATION_KEYS.admin.onlineTeachers)} value={asNumber(summary.online_teachers)} />
        <Metric label={t(TRANSLATION_KEYS.admin.todayRecords)} value={asNumber(summary.today_records)} />
        <Metric label={t(TRANSLATION_KEYS.admin.todayPresenceRate)} value={summary.today_presence_rate + '%'} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.classStatistics)}</h2>        {class_stats.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.noClassStats)} />
        ) : (
          <Table
            caption={t(TRANSLATION_KEYS.admin.classStatistics)}
            headers={[
              t(TRANSLATION_KEYS.admin.className),
              t(TRANSLATION_KEYS.admin.academicYear),
              t(TRANSLATION_KEYS.admin.students),
              t(TRANSLATION_KEYS.admin.recordsToday),
              t(TRANSLATION_KEYS.admin.present),
              t(TRANSLATION_KEYS.admin.absent),
            ]}
          >
            {class_stats.map((item) => (
              <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2">{item.academic_year_name}</td>
                <td className="px-3 py-2">{asNumber(item.student_count)}</td>
                <td className="px-3 py-2">{asNumber(item.today_records)}</td>
                <td className="px-3 py-2">{asNumber(item.present_count)}</td>
                <td className="px-3 py-2">{asNumber(item.absent_count)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardList
          title={t(TRANSLATION_KEYS.admin.attentionStudents)}
          empty={t(TRANSLATION_KEYS.admin.noAttentionStudents)}
        >
          {attention_students.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 border-b border-[var(--sams-border)] py-3 last:border-b-0">
              <div>
                <p className="font-medium">{item.first_name} {item.last_name}</p>
                <p className="text-sm text-[var(--sams-muted)]">{item.class_name}</p>
              </div>
              <Badge variant="danger">{asNumber(item.absent_count)} {t(TRANSLATION_KEYS.admin.absences)}</Badge>
            </li>
          ))}
        </DashboardList>

        <DashboardList
          title={t(TRANSLATION_KEYS.admin.classesWithoutToday)}
          empty={t(TRANSLATION_KEYS.admin.noMissingClasses)}
        >
          {classes_without_today_records.map((item) => (
            <li key={item.id} className="border-b border-[var(--sams-border)] py-3 last:border-b-0">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-[var(--sams-muted)]">{item.academic_year_name}</p>
            </li>
          ))}
        </DashboardList>

        <DashboardList
          title={t(TRANSLATION_KEYS.admin.recentAudit)}
          empty={t(TRANSLATION_KEYS.admin.noAudit)}
        >
          {recent_audit.map((item) => (
            <li key={item.id} className="border-b border-[var(--sams-border)] py-3 last:border-b-0">
              <p className="font-medium">{item.action}</p>
              <p className="text-sm text-[var(--sams-muted)]">{item.full_name ?? item.username ?? '—'} · {dateTime(item.created_at)}</p>
            </li>
          ))}
        </DashboardList>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5">
      <p className="text-sm text-[var(--sams-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  )
}

function DashboardList({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? <ul className="mt-3">{children}</ul> : <p className="mt-3 text-sm text-[var(--sams-muted)]">{empty}</p>}
    </section>
  )
}

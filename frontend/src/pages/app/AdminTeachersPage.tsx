import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { dateTime } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS, type TranslationKey } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, ConfirmDialog, EmptyState, ErrorState, FormField, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

const REQUEST_STATUS_KEYS: Record<'pending' | 'approved' | 'rejected' | 'expired', TranslationKey> = {
  pending: TRANSLATION_KEYS.onboarding.pending,
  approved: TRANSLATION_KEYS.onboarding.approved,
  rejected: TRANSLATION_KEYS.onboarding.rejected,
  expired: TRANSLATION_KEYS.onboarding.expired,
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={online ? 'inline-block size-2 rounded-full bg-[var(--sams-success)]' : 'inline-block size-2 rounded-full bg-[var(--sams-border)]'}
    />
  )
}

export function AdminTeachersPage() {
  const { t } = useI18n()
  const load = useCallback(async () => {
    const [teachers, onboarding] = await Promise.all([
      adminApi.teachers(),
      adminApi.onboardingRequests('pending'),
    ])
    return {
      teachers: teachers.teachers,
      requests: onboarding.requests,
      online_window_seconds: teachers.online_window_seconds,
    }
  }, [])
  const resource = useAdminResource(load)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingRejectId, setPendingRejectId] = useState<number | null>(null)

  const reload = async () => {
    await resource.reload()
  }

  const review = async (id: number, decision: 'approve' | 'reject') => {
    setBusy(id)
    setError(null)
    try {
      await adminApi.reviewOnboarding(id, decision)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const filteredTeachers = useMemo(() => {
    const normalized = teacherQuery.trim().toLocaleLowerCase()
    return (resource.data?.teachers ?? [])
      .filter((teacher) => {
        const matchesQuery = normalized === '' || [
          teacher.full_name,
          teacher.username,
          teacher.employee_id,
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
        const online = Boolean(Number(teacher.is_online))
        const matchesPresence = presenceFilter === 'all'
          || (presenceFilter === 'online' ? online : !online)
        return matchesQuery && matchesPresence
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [resource.data?.teachers, teacherQuery, presenceFilter])

  if (resource.status === 'idle' || resource.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }

  if (resource.status === 'error' || resource.data === null) {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={<Button type="button" variant="secondary" onClick={() => void reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />
    )
  }

  const { teachers, requests } = resource.data
  const onlineTeachers = teachers.filter((teacher) => Boolean(Number(teacher.is_online))).length

  return (
    <section className="sams-admin-page space-y-7">
      <PageHeader
        eyebrow={t(TRANSLATION_KEYS.admin.teacherDirectory)}
        title={t(TRANSLATION_KEYS.navigation.teachers)}
        description={t(TRANSLATION_KEYS.admin.teacherAdminHint)}
        actions={(
          <Button type="button" variant="secondary" onClick={() => void reload()}>
            {t(TRANSLATION_KEYS.system.reload)}
          </Button>
        )}
      />

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--sams-danger)]/20 bg-[var(--sams-danger-surface)] px-3 py-2.5 text-sm text-[var(--sams-danger)]">
          {error}
        </p>
      )}

      <section className="sams-card overflow-hidden">
        <div className="grid divide-y divide-[var(--sams-border)] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="border-s-[3px] border-[var(--sams-brand-primary)] p-5">
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.teacherDirectory)}</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{teachers.length}</p>
              <span className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.teacher)}</span>
            </div>
          </div>
          <div className="p-5">
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.onlineTeachers)}</p>
            <div className="mt-2 flex items-center gap-2">
              <PresenceDot online={onlineTeachers > 0} />
              <p className="text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{onlineTeachers}</p>
              <span className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.online)}</span>
            </div>
          </div>
          <div className="p-5">
            <p className="sams-section-label">{t(TRANSLATION_KEYS.onboarding.pending)}</p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <p className="text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{requests.length}</p>
              <Link
                to="/app/admin/onboarding"
                className="sams-interactive-target inline-flex items-center rounded-[var(--sams-radius-control)] border border-[var(--sams-brand-border)] bg-[var(--sams-brand-surface)] px-3 text-xs font-semibold text-[var(--sams-brand-navy)] hover:bg-white"
              >
                {t(TRANSLATION_KEYS.navigation.onboarding)}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.teacherDirectory)}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.navigation.teachers)}</h2>
          </div>
          <p className="text-sm text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.admin.showingResults)}: <span className="font-semibold text-[var(--sams-text)]">{filteredTeachers.length}</span> / {teachers.length}
          </p>
        </div>

        <AdminWorkspaceToolbar
          searchLabel={t(TRANSLATION_KEYS.admin.search)}
          searchPlaceholder={t(TRANSLATION_KEYS.admin.searchTeachers)}
          searchValue={teacherQuery}
          onSearchChange={setTeacherQuery}
        >
          <FormField label={t(TRANSLATION_KEYS.admin.status)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as typeof presenceFilter)}>
                <option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option>
                <option value="online">{t(TRANSLATION_KEYS.admin.online)}</option>
                <option value="offline">{t(TRANSLATION_KEYS.admin.offline)}</option>
              </Select>
            )}
          </FormField>
        </AdminWorkspaceToolbar>

        {filteredTeachers.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.teacherDirectory)} description={t(TRANSLATION_KEYS.admin.noMatchingResults)} />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] md:block">
              <Table
                caption={t(TRANSLATION_KEYS.admin.teacherDirectory)}
                headers={[
                  t(TRANSLATION_KEYS.admin.teacher),
                  t(TRANSLATION_KEYS.admin.employeeId),
                  t(TRANSLATION_KEYS.admin.status),
                  t(TRANSLATION_KEYS.admin.lastSeen),
                ]}
              >
                {filteredTeachers.map((teacher) => {
                  const online = Boolean(Number(teacher.is_online))
                  return (
                    <tr key={teacher.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <PresenceDot online={online} />
                          <div className="min-w-0">
                            <p className="font-semibold">{teacher.full_name}</p>
                            {teacher.username && <p className="mt-0.5 truncate text-xs text-[var(--sams-muted)]">@{teacher.username}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">{teacher.employee_id ?? '—'}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={online ? 'success' : 'neutral'}>
                          {online ? t(TRANSLATION_KEYS.admin.online) : t(TRANSLATION_KEYS.admin.offline)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-[var(--sams-muted)]">{dateTime(teacher.last_seen_at)}</td>
                    </tr>
                  )
                })}
              </Table>
            </div>

            <div className="space-y-2 md:hidden">
              {filteredTeachers.map((teacher) => {
                const online = Boolean(Number(teacher.is_online))
                return (
                  <article key={teacher.id} className="sams-card p-4">
                    <div className="flex items-start gap-3">
                      <PresenceDot online={online} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{teacher.full_name}</p>
                        {teacher.employee_id && <p className="mt-1 text-xs text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.employeeId)} · {teacher.employee_id}</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge variant={online ? 'success' : 'neutral'}>
                            {online ? t(TRANSLATION_KEYS.admin.online) : t(TRANSLATION_KEYS.admin.offline)}
                          </Badge>
                          <span className="text-xs text-[var(--sams-muted)]">{dateTime(teacher.last_seen_at)}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.onboarding.pending)}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{t(TRANSLATION_KEYS.navigation.onboarding)}</h2>
          </div>
          {requests.length > 0 && <Badge variant="warning">{requests.length} {t(TRANSLATION_KEYS.onboarding.pending)}</Badge>}
        </div>

        {requests.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.onboarding.pending)} description={t(TRANSLATION_KEYS.admin.noOnboardingRequests)} />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] md:block">
              <Table
                caption={t(TRANSLATION_KEYS.navigation.onboarding)}
                headers={[
                  t(TRANSLATION_KEYS.admin.fullName),
                  t(TRANSLATION_KEYS.admin.employeeId),
                  t(TRANSLATION_KEYS.admin.phone),
                  t(TRANSLATION_KEYS.admin.status),
                  t(TRANSLATION_KEYS.admin.createdAt),
                  t(TRANSLATION_KEYS.admin.onboardingExpiresAt),
                  t(TRANSLATION_KEYS.admin.actions),
                ]}
              >
                {requests.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                    <td className="px-4 py-3.5 font-semibold">{item.full_name}</td>
                    <td className="px-4 py-3.5">{item.employee_id ?? '—'}</td>
                    <td className="px-4 py-3.5">{item.phone ?? '—'}</td>
                    <td className="px-4 py-3.5"><Badge variant="warning">{t(REQUEST_STATUS_KEYS[item.status])}</Badge></td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--sams-muted)]">{dateTime(item.created_at)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-[var(--sams-muted)]">{dateTime(item.expires_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" disabled={busy === item.id} loading={busy === item.id} onClick={() => void review(item.id, 'approve')}>
                          {t(TRANSLATION_KEYS.admin.approve)}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" disabled={busy === item.id} onClick={() => setPendingRejectId(item.id)}>
                          {t(TRANSLATION_KEYS.admin.reject)}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>

            <div className="space-y-2 md:hidden">
              {requests.map((item) => (
                <article key={item.id} className="sams-card space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.full_name}</p>
                      <p className="mt-1 text-xs text-[var(--sams-muted)]">
                        {item.employee_id ?? t(TRANSLATION_KEYS.admin.employeeId)}
                      </p>
                    </div>
                    <Badge variant="warning">{t(REQUEST_STATUS_KEYS[item.status])}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-[var(--sams-muted)]">
                    <div>
                      <p className="font-semibold text-[var(--sams-text)]">{t(TRANSLATION_KEYS.admin.phone)}</p>
                      <p className="mt-1 truncate">{item.phone ?? '—'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--sams-text)]">{t(TRANSLATION_KEYS.admin.createdAt)}</p>
                      <p className="mt-1">{dateTime(item.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-[var(--sams-border)] pt-3">
                    <Button type="button" size="sm" disabled={busy === item.id} loading={busy === item.id} onClick={() => void review(item.id, 'approve')}>
                      {t(TRANSLATION_KEYS.admin.approve)}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={busy === item.id} onClick={() => setPendingRejectId(item.id)}>
                      {t(TRANSLATION_KEYS.admin.reject)}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={pendingRejectId !== null}
        title={t(TRANSLATION_KEYS.admin.confirmReject)}
        description={t(TRANSLATION_KEYS.admin.onboardingConfirmRejectDescription)}
        cancelLabel={t(TRANSLATION_KEYS.admin.cancel)}
        confirmLabel={t(TRANSLATION_KEYS.admin.reject)}
        destructive
        busy={pendingRejectId !== null && busy === pendingRejectId}
        onCancel={() => setPendingRejectId(null)}
        onConfirm={() => {
          if (pendingRejectId === null) return
          const id = pendingRejectId
          setPendingRejectId(null)
          return review(id, 'reject')
        }}
      />
    </section>
  )
}


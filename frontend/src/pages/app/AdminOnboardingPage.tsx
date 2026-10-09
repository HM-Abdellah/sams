import { useCallback, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { dateTime } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS, type TranslationKey } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Loading,
  PageHeader,
  Select,
  StatusMessage,
  Table,
} from '../../components/ui/index.ts'

const STATUS_KEYS: Record<'pending' | 'approved' | 'rejected' | 'expired', TranslationKey> = {
  pending: TRANSLATION_KEYS.onboarding.pending,
  approved: TRANSLATION_KEYS.onboarding.approved,
  rejected: TRANSLATION_KEYS.onboarding.rejected,
  expired: TRANSLATION_KEYS.onboarding.expired,
}

export function AdminOnboardingPage() {
  const { t } = useI18n()
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending')
  const load = useCallback(() => adminApi.onboardingRequests(statusFilter), [statusFilter])
  const resource = useAdminResource(load)
  const [code, setCode] = useState<string | null>(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | 'code' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Awaited<ReturnType<typeof adminApi.onboardingRequests>>['requests'][number] | null>(null)
  const [reason, setReason] = useState('')

  const rotate = async () => {
    setBusy('code')
    setError(null)
    try {
      const result = await adminApi.rotateOnboardingCode()
      setCode(result.onboarding_code)
      setCodeExpiresAt(result.expires_at)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const review = async (id: number, decision: 'approve' | 'reject', rejectionReason?: string) => {
    setBusy(id)
    setError(null)
    try {
      await adminApi.reviewOnboarding(id, decision, rejectionReason)
      await resource.reload()
      if (decision === 'reject') {
        setRejectTarget(null)
        setReason('')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const openReject = (request: typeof rejectTarget) => {
    setRejectTarget(request)
    setReason('')
    setError(null)
  }

  const confirmReject = async () => {
    if (rejectTarget === null) return
    await review(rejectTarget.id, 'reject', reason.trim() || undefined)
  }

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

  const requests = resource.data.requests

  return (
    <>
      <section className="sams-admin-page space-y-7">
        <PageHeader
          className="sams-admin-page-header"
          eyebrow={t(TRANSLATION_KEYS.admin.operations)}
          title={t(TRANSLATION_KEYS.navigation.onboarding)}
          description={t(TRANSLATION_KEYS.admin.onboardingHint)}
        />

        {error && <StatusMessage variant="danger" role="alert">{error}</StatusMessage>}

        <section className="relative overflow-hidden rounded-[1.4rem] border border-[var(--sams-brand-border)] bg-[var(--sams-brand-surface)] shadow-[0_18px_46px_rgba(18,59,115,0.08)]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(18,59,115,0.09),transparent_48%,rgba(8,127,132,0.09))]" aria-hidden="true" />
          <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
            <div className="p-6 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sams-brand-primary)]">
                    {t(TRANSLATION_KEYS.admin.administrator)}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">
                    {t(TRANSLATION_KEYS.admin.newOnboardingCode)}
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--sams-muted)]">
                    {t(TRANSLATION_KEYS.admin.onboardingHint)}
                  </p>
                </div>
                <Badge variant="info">{t(TRANSLATION_KEYS.onboarding.pending)}</Badge>
              </div>

              <div className="mt-6 rounded-2xl border border-[var(--sams-brand-border)] bg-[var(--sams-surface)] p-5 shadow-[0_8px_22px_rgba(18,59,115,0.05)]">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--sams-muted)]">
                  {t(TRANSLATION_KEYS.onboarding.code)}
                </p>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <code className="rounded-xl bg-[var(--sams-brand-navy)] px-4 py-3 text-xl font-semibold tracking-[0.2em] text-white sm:text-2xl">
                    {code ?? '••••••••••••'}
                  </code>
                  <Button type="button" loading={busy === 'code'} disabled={busy !== null && busy !== 'code'} onClick={() => void rotate()}>
                    {t(TRANSLATION_KEYS.admin.rotateCode)}
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--sams-muted)]">
                  <span>{t(TRANSLATION_KEYS.admin.oneTimeSecret)}</span>
                  {codeExpiresAt && (
                    <span>
                      {t(TRANSLATION_KEYS.admin.onboardingExpiresAt)}: {dateTime(codeExpiresAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--sams-brand-border)] bg-[color-mix(in_srgb,var(--sams-brand-canvas)_54%,transparent)] p-6 sm:p-7 xl:border-t-0 xl:border-s">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--sams-brand-primary)]">
                SAMS
              </p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--sams-brand-navy)]">
                {t(TRANSLATION_KEYS.onboarding.title)}
              </h3>
              <ol className="mt-5 space-y-4">
                {[
                  t(TRANSLATION_KEYS.onboarding.code),
                  t(TRANSLATION_KEYS.onboarding.submitRequest),
                  t(TRANSLATION_KEYS.onboarding.pending),
                  t(TRANSLATION_KEYS.onboarding.activateTitle),
                ].map((label, index) => (
                  <li key={label} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--sams-brand-navy)] text-xs font-bold text-white">{index + 1}</span>
                    <p className="pt-1 text-sm leading-5 text-[var(--sams-text)]">{label}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="sams-card flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.operations)}</p>
              <h2 className="mt-1 text-xl font-semibold">{t(TRANSLATION_KEYS.onboarding.statusTitle)}</h2>
              <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.onboardingHint)}</p>
            </div>
            <div className="w-full sm:w-56">
              <FormField label={t(TRANSLATION_KEYS.admin.status)}>
                {({ id, ...aria }) => (
                  <Select id={id} {...aria} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                    <option value="pending">{t(STATUS_KEYS.pending)}</option>
                    <option value="approved">{t(STATUS_KEYS.approved)}</option>
                    <option value="rejected">{t(STATUS_KEYS.rejected)}</option>
                    <option value="expired">{t(STATUS_KEYS.expired)}</option>
                  </Select>
                )}
              </FormField>
            </div>
          </div>

          {requests.length === 0 ? (
            <EmptyState
              title={t(TRANSLATION_KEYS.admin.noOnboardingRequests)}
              description={t(TRANSLATION_KEYS.admin.onboardingHint)}
            />
          ) : (
            <div className="sams-card overflow-hidden p-0">
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
                    <td className="px-3 py-3 font-medium">{item.full_name}</td>
                    <td className="px-3 py-3">{item.employee_id ?? '—'}</td>
                    <td className="px-3 py-3">{item.phone ?? '—'}</td>
                    <td className="px-3 py-3">
                      <Badge variant={item.status === 'approved' ? 'success' : item.status === 'pending' ? 'warning' : 'neutral'}>
                        {t(STATUS_KEYS[item.status])}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{dateTime(item.created_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{dateTime(item.expires_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.status === 'pending' && (
                          <>
                            <Button type="button" size="sm" disabled={busy === item.id} onClick={() => void review(item.id, 'approve')}>
                              {t(TRANSLATION_KEYS.admin.approve)}
                            </Button>
                            <Button type="button" size="sm" variant="secondary" disabled={busy === item.id} onClick={() => openReject(item)}>
                              {t(TRANSLATION_KEYS.admin.reject)}
                            </Button>
                          </>
                        )}
                        {item.status === 'rejected' && item.rejection_reason && (
                          <span className="max-w-sm text-xs leading-5 text-[var(--sams-muted)]">
                            {t(TRANSLATION_KEYS.admin.onboardingRejectionReason)}: {item.rejection_reason}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            </div>
          )}
        </section>
      </section>

      <Dialog
        open={rejectTarget !== null}
        role="alertdialog"
        title={t(TRANSLATION_KEYS.admin.confirmReject)}
        description={rejectTarget ? rejectTarget.full_name + ' · ' + (rejectTarget.employee_id ?? '—') : ''}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={() => { if (busy === null) setRejectTarget(null) }}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.admin.onboardingConfirmRejectDescription)}
          </p>
          <FormField label={t(TRANSLATION_KEYS.admin.rejectionReason)}>
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t(TRANSLATION_KEYS.admin.optionalReason)}
                autoComplete="off"
              />
            )}
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => setRejectTarget(null)}>
              {t(TRANSLATION_KEYS.admin.cancel)}
            </Button>
            <Button type="button" variant="danger" disabled={busy !== null} loading={rejectTarget !== null && busy === rejectTarget.id} onClick={() => void confirmReject()}>
              {t(TRANSLATION_KEYS.admin.reject)}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}


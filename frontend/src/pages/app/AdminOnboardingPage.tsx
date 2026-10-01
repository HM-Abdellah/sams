import { useCallback, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { dateTime } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { Badge, Button, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table } from '../../components/ui/index.ts'

export function AdminOnboardingPage() {
  const { t } = useI18n()
  const [statusFilter, setStatusFilter] = useState('pending')
  const load = useCallback(() => adminApi.onboardingRequests(statusFilter), [statusFilter])
  const resource = useAdminResource(load)
  const [code, setCode] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<number | 'code' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rotate = async () => {
    setBusy('code'); setError(null)
    try { const result = await adminApi.rotateOnboardingCode(); setCode(result.onboarding_code) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setBusy(null) }
  }
  const review = async (id: number, decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !window.confirm(t(TRANSLATION_KEYS.admin.confirmReject) + '?')) return
    setBusy(id); setError(null)
    try {
      await adminApi.reviewOnboarding(id, decision, decision === 'reject' ? reason : undefined)
      setReason('')
      await resource.reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setBusy(null) }
  }

  if (resource.status === 'idle' || resource.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  if (resource.status === 'error' || resource.data === null) return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.onboarding)}
        description={t(TRANSLATION_KEYS.admin.onboardingHint)}
      />
      {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}
      {code && <section role="status" className="rounded-lg border border-[var(--sams-warning)] bg-[var(--sams-warning-surface)] p-4"><p className="font-semibold">{t(TRANSLATION_KEYS.admin.newOnboardingCode)}</p><code className="mt-2 block text-lg">{code}</code><p className="mt-1 text-sm">{t(TRANSLATION_KEYS.admin.oneTimeSecret)}</p></section>}
      <Button type="button" loading={busy === 'code'} disabled={busy !== null && busy !== 'code'} onClick={() => void rotate()}>{t(TRANSLATION_KEYS.admin.rotateCode)}</Button>

      <section className="sams-admin-toolbar grid gap-4 p-5 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:items-end">
        <FormField label={t(TRANSLATION_KEYS.admin.status)}>
          {({ id, ...aria }) => <Select id={id} {...aria} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="pending">pending</option><option value="approved">approved</option><option value="rejected">rejected</option><option value="expired">expired</option>
          </Select>}
        </FormField>
        <FormField label={t(TRANSLATION_KEYS.admin.rejectionReason)}>
          {({ id, ...aria }) => <Input id={id} {...aria} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t(TRANSLATION_KEYS.admin.optionalReason)} />}
        </FormField>
      </section>

      {resource.data.requests.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.navigation.onboarding)} description={t(TRANSLATION_KEYS.admin.noOnboardingRequests)} /> : (
        <Table caption={t(TRANSLATION_KEYS.navigation.onboarding)} headers={[t(TRANSLATION_KEYS.admin.fullName), t(TRANSLATION_KEYS.admin.employeeId), t(TRANSLATION_KEYS.admin.phone), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.createdAt), t(TRANSLATION_KEYS.admin.actions)]}>
          {resource.data.requests.map((item) => (
            <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{item.full_name}</td>
              <td className="px-3 py-2">{item.employee_id ?? '—'}</td>
              <td className="px-3 py-2">{item.phone ?? '—'}</td>
              <td className="px-3 py-2"><Badge variant={item.status === 'approved' ? 'success' : item.status === 'pending' ? 'warning' : 'neutral'}>{item.status}</Badge></td>
              <td className="px-3 py-2">{dateTime(item.created_at)}</td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-2">
                {item.status === 'pending' && <>
                  <Button type="button" size="sm" disabled={busy === item.id} onClick={() => void review(item.id, 'approve')}>{t(TRANSLATION_KEYS.admin.approve)}</Button>
                  <Button type="button" size="sm" variant="secondary" disabled={busy === item.id} onClick={() => void review(item.id, 'reject')}>{t(TRANSLATION_KEYS.admin.reject)}</Button>
                </>}
              </div></td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  )
}

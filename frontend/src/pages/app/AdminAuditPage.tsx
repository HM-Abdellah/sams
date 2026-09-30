import { useCallback, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { dateTime } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { Badge, Button, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Pagination, Select, Table } from '../../components/ui/index.ts'

export function AdminAuditPage() {
  const { t } = useI18n()
  const [draftUser, setDraftUser] = useState('')
  const [draftAction, setDraftAction] = useState('')
  const [draftEntity, setDraftEntity] = useState('')
  const [draftFrom, setDraftFrom] = useState('')
  const [draftTo, setDraftTo] = useState('')
  const [filters, setFilters] = useState({ user_id: undefined as number | undefined, action: '', entity_type: '', from: '', to: '', page: 1 })
  const load = useCallback(async () => {
    const [audit, users] = await Promise.all([adminApi.audit({ ...filters, per_page: 50 }), adminApi.users()])
    return { audit, users: users.users }
  }, [filters])
  const resource = useAdminResource(load)

  if (resource.status === 'idle' || resource.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  if (resource.status === 'error' || resource.data === null) return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type='button' variant='secondary' onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  const data = resource.data

  const apply = () => setFilters({
    user_id: draftUser ? Number(draftUser) : undefined,
    action: draftAction.trim(), entity_type: draftEntity.trim(), from: draftFrom, to: draftTo, page: 1,
  })
  const changePage = (page: number) => setFilters((current) => ({ ...current, page }))

  return (
    <section className="space-y-6">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.audit)}
        description={t(TRANSLATION_KEYS.admin.auditHint)}
      />
      <section className="grid gap-4 rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5 md:grid-cols-2 lg:grid-cols-3">
        <FormField label={t(TRANSLATION_KEYS.admin.user)}>
          {({ id, ...aria }) => <Select id={id} {...aria} value={draftUser} onChange={(e) => setDraftUser(e.target.value)}><option value="">{t(TRANSLATION_KEYS.admin.allUsers)}</option>{data.users.map((x) => <option key={x.id} value={x.id}>{x.full_name} · {x.username}</option>)}</Select>}
        </FormField>
        <FormField label={t(TRANSLATION_KEYS.admin.action)}>{({ id, ...aria }) => <Input id={id} {...aria} value={draftAction} onChange={(e) => setDraftAction(e.target.value)} placeholder="user.create" />}</FormField>
        <FormField label={t(TRANSLATION_KEYS.admin.entityType)}>{({ id, ...aria }) => <Input id={id} {...aria} value={draftEntity} onChange={(e) => setDraftEntity(e.target.value)} placeholder="user" />}</FormField>
        <FormField label={t(TRANSLATION_KEYS.admin.from)}>{({ id, ...aria }) => <Input id={id} {...aria} type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />}</FormField>
        <FormField label={t(TRANSLATION_KEYS.admin.to)}>{({ id, ...aria }) => <Input id={id} {...aria} type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />}</FormField>
        <div className="flex items-end"><Button type="button" onClick={apply}>{t(TRANSLATION_KEYS.admin.applyFilters)}</Button></div>
      </section>

      {data.audit.items.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.navigation.audit)} description={t(TRANSLATION_KEYS.admin.noAudit)} /> : (
        <Table caption={t(TRANSLATION_KEYS.navigation.audit)} headers={[t(TRANSLATION_KEYS.admin.date), t(TRANSLATION_KEYS.admin.user), t(TRANSLATION_KEYS.admin.action), t(TRANSLATION_KEYS.admin.entityType), t(TRANSLATION_KEYS.admin.metadata)]}>
          {data.audit.items.map((item) => <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
            <td className="px-3 py-2 whitespace-nowrap">{dateTime(item.created_at)}</td>
            <td className="px-3 py-2">{item.full_name ?? item.username ?? '—'}</td>
            <td className="px-3 py-2"><Badge variant="info">{item.action}</Badge></td>
            <td className="px-3 py-2">{item.entity_type}#{item.entity_id ?? '—'}</td>
            <td className="max-w-xs px-3 py-2 text-xs break-all">{item.metadata ? JSON.stringify(item.metadata) : '—'}</td>
          </tr>)}
        </Table>
      )}
      <Pagination
        page={data.audit.page}
        pageCount={data.audit.total_pages}
        previousLabel={t(TRANSLATION_KEYS.admin.previous)}
        nextLabel={t(TRANSLATION_KEYS.admin.next)}
        ariaLabel={t(TRANSLATION_KEYS.admin.pagination)}
        onPageChange={changePage}
      />
    </section>
  )
}

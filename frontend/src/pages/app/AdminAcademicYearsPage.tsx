import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import type { AcademicYear } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { isActive } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { Badge, Button, ErrorState, FormField, Input, Loading, PageHeader, Select, Table } from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

export function AdminAcademicYearsPage() {
  const { t, formatDate } = useI18n()
  const load = useCallback(() => adminApi.academicYears(), [])
  const resource = useAdminResource(load)
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [activateOnCreate, setActivateOnCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const create = async () => {
    setSaving(true); setError(null)
    try { await adminApi.createAcademicYear({ name, starts_on: startsOn, ends_on: endsOn, activate: activateOnCreate }); setName(''); setStartsOn(''); setEndsOn(''); setActivateOnCreate(false); await resource.reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setSaving(false) }
  }
  const activate = async (year: AcademicYear) => {
    if (!window.confirm(t(TRANSLATION_KEYS.admin.confirmActivateYear) + ': ' + year.name + '?')) return
    setSaving(true); setError(null)
    try { await adminApi.activateAcademicYear(year.id); await resource.reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setSaving(false) }
  }

  const filteredYears = useMemo(() => (resource.data?.academic_years ?? []).filter((year) => {
    const active = isActive(year.is_active)
    return statusFilter === 'all' || (statusFilter === 'active' ? active : !active)
  }), [resource.data, statusFilter])

  if (resource.status === 'idle' || resource.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  if (resource.status === 'error' || resource.data === null) return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.academicYears)}
        description={t(TRANSLATION_KEYS.admin.academicYearHint)}
      />
      {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}

      <section className="sams-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.createAcademicYear)}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label={t(TRANSLATION_KEYS.admin.name)}>{({ id, ...aria }) => <Input id={id} {...aria} value={name} onChange={(e) => setName(e.target.value)} />}</FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.startsOn)}>{({ id, ...aria }) => <Input id={id} {...aria} type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />}</FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.endsOn)}>{({ id, ...aria }) => <Input id={id} {...aria} type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />}</FormField>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={activateOnCreate} onChange={(e) => setActivateOnCreate(e.target.checked)} /> {t(TRANSLATION_KEYS.admin.activateImmediately)}</label>
        <Button type="button" disabled={!name || !startsOn || !endsOn || saving} loading={saving} onClick={() => void create()}>{t(TRANSLATION_KEYS.admin.create)}</Button>
      </section>

      <AdminWorkspaceToolbar searchLabel={t(TRANSLATION_KEYS.admin.status)} searchValue="" onSearchChange={() => undefined}>
        <FormField label={t(TRANSLATION_KEYS.admin.status)}>{({ id, ...aria }) => <Select id={id} {...aria} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option><option value="active">{t(TRANSLATION_KEYS.admin.activeOnly)}</option><option value="inactive">{t(TRANSLATION_KEYS.admin.inactiveOnly)}</option></Select>}</FormField>
      </AdminWorkspaceToolbar>
      <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.showingResults)}: {filteredYears.length} / {resource.data.academic_years.length}</p>
      <Table caption={t(TRANSLATION_KEYS.navigation.academicYears)} headers={[t(TRANSLATION_KEYS.admin.name), t(TRANSLATION_KEYS.admin.startsOn), t(TRANSLATION_KEYS.admin.endsOn), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.actions)]}>
        {filteredYears.map((year) => <tr key={year.id} className="border-b border-[var(--sams-border)] last:border-b-0">
          <td className="px-3 py-2 font-medium">{year.name}</td>
          <td className="px-3 py-2">{formatDate(year.starts_on)}</td>
          <td className="px-3 py-2">{formatDate(year.ends_on)}</td>
          <td className="px-3 py-2"><Badge variant={isActive(year.is_active) ? 'success' : 'neutral'}>{isActive(year.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></td>
          <td className="px-3 py-2">{!isActive(year.is_active) && <Button type="button" size="sm" disabled={saving} onClick={() => void activate(year)}>{t(TRANSLATION_KEYS.admin.activate)}</Button>}</td>
        </tr>)}
      </Table>
    </section>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, isActive } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

export function AdminClassesPage() {
  const { t } = useI18n()
  const load = useCallback(() => adminApi.classes(), [])
  const resource = useAdminResource(load)
  const [editing, setEditing] = useState<AdminClass | null>(null)
  const [name, setName] = useState('')
  const [level, setLevel] = useState('')
  const [branch, setBranch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [yearFilter, setYearFilter] = useState('all')

  const startEdit = (item: AdminClass) => {
    setEditing(item); setName(item.name); setLevel(item.level ?? ''); setBranch(item.branch ?? ''); setError(null)
  }
  const clearForm = () => {
    setEditing(null); setName(''); setLevel(''); setBranch(''); setError(null)
  }
  const save = async () => {
    setSaving(true); setError(null)
    try {
      if (editing === null) {
        await adminApi.createClass({ name, level: level || undefined, branch: branch || undefined })
      } else {
        await adminApi.updateClass({ id: editing.id, name, level: level || undefined, branch: branch || undefined })
      }
      clearForm()
      await resource.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSaving(false)
    }
  }

  const setActive = async (item: AdminClass, active: boolean) => {
    const verb = active ? t(TRANSLATION_KEYS.admin.activate) : t(TRANSLATION_KEYS.admin.deactivate)
    if (!window.confirm(verb + ': ' + item.name + '?')) return
    setSaving(true); setError(null)
    try {
      await adminApi.setClassActive(item.id, active)
      await resource.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSaving(false)
    }
  }

  if (resource.status === 'idle' || resource.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  const years = useMemo(() => {
    const seen = new Map<number, string>()
    for (const item of resource.data?.classes ?? []) {
      if (!seen.has(item.academic_year_id)) seen.set(item.academic_year_id, item.academic_year_name)
    }
    return [...seen.entries()]
  }, [resource.data])

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return (resource.data?.classes ?? []).filter((item) => {
      const matchesQuery = normalized === ''
        || [item.name, item.level, item.branch, item.academic_year_name]
          .filter(Boolean)
          .some((value) => String(value).toLocaleLowerCase().includes(normalized))
      const active = isActive(item.is_active)
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? active : !active)
      const matchesYear = yearFilter === 'all' || String(item.academic_year_id) === yearFilter
      return matchesQuery && matchesStatus && matchesYear
    })
  }, [resource.data, query, statusFilter, yearFilter])

  if (resource.status === 'error' || resource.data === null) {
    return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  }

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.classes)}
        description={t(TRANSLATION_KEYS.admin.classAdminHint)}
      />

      <section className="sams-card p-5">
        <h2 className="text-lg font-semibold">{editing ? t(TRANSLATION_KEYS.admin.editClass) : t(TRANSLATION_KEYS.admin.createClass)}</h2>        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <FormField label={t(TRANSLATION_KEYS.admin.className)}>
            {({ id, ...aria }) => <Input id={id} {...aria} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.level)}>
            {({ id, ...aria }) => <Input id={id} {...aria} value={level} onChange={(e) => setLevel(e.target.value)} />}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.branch)}>
            {({ id, ...aria }) => <Input id={id} {...aria} value={branch} onChange={(e) => setBranch(e.target.value)} />}
          </FormField>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-[var(--sams-danger)]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="button" disabled={!name.trim() || saving} loading={saving} onClick={() => void save()}>{t(TRANSLATION_KEYS.admin.save)}</Button>
          {editing && <Button type="button" variant="secondary" disabled={saving} onClick={clearForm}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>}
        </div>
      </section>

      <AdminWorkspaceToolbar
        searchLabel={t(TRANSLATION_KEYS.admin.search)}
        searchPlaceholder={t(TRANSLATION_KEYS.admin.searchClasses)}
        searchValue={query}
        onSearchChange={setQuery}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t(TRANSLATION_KEYS.admin.status)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option>
                <option value="active">{t(TRANSLATION_KEYS.admin.activeOnly)}</option>
                <option value="inactive">{t(TRANSLATION_KEYS.admin.inactiveOnly)}</option>
              </Select>
            )}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.academicYear)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="all">{t(TRANSLATION_KEYS.admin.allAcademicYears)}</option>
                {years.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </Select>
            )}
          </FormField>
        </div>
      </AdminWorkspaceToolbar>

      {resource.data.classes.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.navigation.classes)} description={t(TRANSLATION_KEYS.admin.noClasses)} /> : filteredClasses.length === 0 ? (
        <EmptyState title={t(TRANSLATION_KEYS.admin.searchClasses)} description={t(TRANSLATION_KEYS.admin.noMatchingResults)} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.showingResults)}: {filteredClasses.length} / {resource.data.classes.length}</p>
          <Table caption={t(TRANSLATION_KEYS.navigation.classes)} headers={[t(TRANSLATION_KEYS.admin.className), t(TRANSLATION_KEYS.admin.academicYear), t(TRANSLATION_KEYS.admin.students), t(TRANSLATION_KEYS.navigation.teachers), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.actions)]}>
            {filteredClasses.map((item) => (
            <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{item.name}</td>
              <td className="px-3 py-2">{item.academic_year_name}</td>
              <td className="px-3 py-2 tabular-nums">{asNumber(item.student_count)}</td>
              <td className="px-3 py-2 tabular-nums">{asNumber(item.teacher_count)}</td>
              <td className="px-3 py-2"><Badge variant={isActive(item.is_active) ? 'success' : 'neutral'}>{isActive(item.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></td>
              <td className="px-3 py-2"><div className="flex flex-wrap gap-2">
                <Link className="sams-interactive-target inline-flex items-center rounded-md border border-[var(--sams-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--sams-muted-surface)] focus-visible:bg-[var(--sams-muted-surface)]" to={`/app/admin/students?class_id=${item.id}`}>{t(TRANSLATION_KEYS.admin.openRoster)}</Link>
                <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(item)}>{t(TRANSLATION_KEYS.admin.edit)}</Button>
                <Button type="button" size="sm" disabled={saving} onClick={() => void setActive(item, !isActive(item.is_active))}>{isActive(item.is_active) ? t(TRANSLATION_KEYS.admin.deactivate) : t(TRANSLATION_KEYS.admin.activate)}</Button>
              </div></td>
            </tr>
            ))}
          </Table>
        </div>
      )}
    </section>
  )
}

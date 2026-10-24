import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import {
  asNumber,
  compareClassNames,
  isActive,
  studyLevelCode,
} from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Button, Dialog, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

const EMPTY_ADMIN_CLASSES: AdminClass[] = []

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
  const [yearFilter, setYearFilter] = useState('active')
  const [levelFilter, setLevelFilter] = useState<'all' | 'TC' | '1BAC' | '2BAC'>('all')

  const startEdit = (item: AdminClass) => {
    setEditing(item)
    setName(item.name)
    setLevel(item.level ?? '')
    setBranch(item.branch ?? '')
    setError(null)
  }

  const clearForm = () => {
    setEditing(null)
    setName('')
    setLevel('')
    setBranch('')
    setError(null)
  }

  const save = async () => {
    if (editing === null || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      await adminApi.updateClass({
        id: editing.id,
        name,
        level: level || undefined,
        branch: branch || undefined,
      })
      clearForm()
      await resource.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSaving(false)
    }
  }

  const years = useMemo(() => {
    const seen = new Map<number, string>()
    for (const item of resource.data?.classes ?? []) {
      if (!seen.has(item.academic_year_id)) seen.set(item.academic_year_id, item.academic_year_name)
    }
    return [...seen.entries()].sort((a, b) => b[1].localeCompare(a[1], undefined, { numeric: true, sensitivity: 'base' }))
  }, [resource.data?.classes])

  const classList = resource.data?.classes ?? EMPTY_ADMIN_CLASSES
  const hasActiveAcademicYear = classList.some((item) => isActive(item.academic_year_active))
  const effectiveYearFilter = yearFilter === 'active' && !hasActiveAcademicYear ? 'all' : yearFilter

  const filteredClasses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    const levelOrder = { '2BAC': 0, '1BAC': 1, TC: 2, other: 3 } as const
    return classList
      .filter((item) => {
        const matchesQuery = normalized === '' || [
          item.name,
          item.level,
          item.branch,
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
        const matchesLevel = levelFilter === 'all' || studyLevelCode(item) === levelFilter
        const matchesYear = effectiveYearFilter === 'all'
          || (effectiveYearFilter === 'active' && isActive(item.academic_year_active))
          || String(item.academic_year_id) === effectiveYearFilter
        return matchesQuery && matchesLevel && matchesYear
      })
      .sort((a, b) => (
        b.academic_year_name.localeCompare(a.academic_year_name, undefined, { numeric: true, sensitivity: 'base' })
        || levelOrder[studyLevelCode(a)] - levelOrder[studyLevelCode(b)]
        || compareClassNames(a, b)
      ))
  }, [classList, query, effectiveYearFilter, levelFilter])

  if (resource.status === 'idle' || resource.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }
  if (resource.status === 'error' || resource.data === null) {
    return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void resource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  }

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.classes)}
        description={t(TRANSLATION_KEYS.admin.classAdminHint)}
      />

      <Dialog
        open={editing !== null}
        title={t(TRANSLATION_KEYS.admin.editClass)}
        description={editing?.name ?? ''}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={clearForm}
      >
        {error && <p role="alert" className="mb-4 text-sm text-[var(--sams-danger)]">{error}</p>}
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label={t(TRANSLATION_KEYS.admin.className)}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={name} onChange={(event) => setName(event.target.value)} />}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.level)}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={level} onChange={(event) => setLevel(event.target.value)} />}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.branch)}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={branch} onChange={(event) => setBranch(event.target.value)} />}
            </FormField>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={saving} onClick={clearForm}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>
            <Button type="button" disabled={!name.trim() || saving} loading={saving} onClick={() => void save()}>{t(TRANSLATION_KEYS.admin.save)}</Button>
          </div>
        </div>
      </Dialog>

      <AdminWorkspaceToolbar
        searchLabel={t(TRANSLATION_KEYS.admin.search)}
        searchPlaceholder={t(TRANSLATION_KEYS.admin.searchClasses)}
        searchValue={query}
        onSearchChange={setQuery}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t(TRANSLATION_KEYS.admin.academicYear)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={effectiveYearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="active" disabled={!hasActiveAcademicYear}>{t(TRANSLATION_KEYS.admin.activeAcademicYear)}</option>
                <option value="all">{t(TRANSLATION_KEYS.admin.allAcademicYears)}</option>
                {years.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.level)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as typeof levelFilter)}>
                <option value="all">{t(TRANSLATION_KEYS.admin.allLevels)}</option>
                <option value="TC">TC</option>
                <option value="1BAC">1BAC</option>
                <option value="2BAC">2BAC</option>
              </Select>
            )}
          </FormField>
        </div>
      </AdminWorkspaceToolbar>

      {resource.data.classes.length === 0 ? (
        <EmptyState title={t(TRANSLATION_KEYS.navigation.classes)} description={t(TRANSLATION_KEYS.admin.noClasses)} />
      ) : filteredClasses.length === 0 ? (
        <EmptyState title={t(TRANSLATION_KEYS.admin.searchClasses)} description={t(TRANSLATION_KEYS.admin.noMatchingResults)} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.admin.showingResults)}: {filteredClasses.length} / {resource.data.classes.length}
          </p>
          <Table
            caption={t(TRANSLATION_KEYS.navigation.classes)}
            headers={[
              t(TRANSLATION_KEYS.admin.className),
              t(TRANSLATION_KEYS.admin.academicYear),
              t(TRANSLATION_KEYS.admin.students),
              t(TRANSLATION_KEYS.navigation.teachers),
              t(TRANSLATION_KEYS.admin.actions),
            ]}
          >
            {filteredClasses.map((item) => (
              <tr key={item.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2">{item.academic_year_name}</td>
                <td className="px-3 py-2 tabular-nums">{asNumber(item.student_count)}</td>
                <td className="px-3 py-2 tabular-nums">{asNumber(item.teacher_count)}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      className="sams-interactive-target inline-flex items-center rounded-md border border-[var(--sams-border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--sams-muted-surface)] focus-visible:bg-[var(--sams-muted-surface)]"
                      to={'/app/admin/students?class_id=' + item.id}
                    >
                      {t(TRANSLATION_KEYS.admin.openRoster)}
                    </Link>
                    <Button type="button" size="sm" variant="secondary" onClick={() => startEdit(item)}>
                      {t(TRANSLATION_KEYS.admin.edit)}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </section>
  )
}


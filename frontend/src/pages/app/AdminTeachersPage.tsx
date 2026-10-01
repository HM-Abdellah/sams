import { useCallback, useMemo, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminSubject, AdminTeaching } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { isActive } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

export function AdminTeachersPage() {
  const { t } = useI18n()
  const load = useCallback(async () => {
    const [teachers, classes] = await Promise.all([adminApi.teachers(), adminApi.classes()])
    return { ...teachers, classes: classes.classes }
  }, [])
  const resource = useAdminResource(load)
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [code, setCode] = useState('')
  const [nameFr, setNameFr] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [editingSubject, setEditingSubject] = useState<AdminSubject | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [teacherStatus, setTeacherStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [teacherSort, setTeacherSort] = useState<'name' | 'online' | 'status'>('name')
  const [assignmentQuery, setAssignmentQuery] = useState('')
  const [assignmentSort, setAssignmentSort] = useState<'teacher' | 'subject' | 'class'>('teacher')

  const reload = async () => { await resource.reload() }
  const saveSubject = async () => {
    setSaving(true); setError(null)
    try {
      if (editingSubject) {
        await adminApi.updateSubject({ id: editingSubject.id, code, name_fr: nameFr, name_ar: nameAr, name_en: nameEn, is_active: isActive(editingSubject.is_active) })
      } else {
        await adminApi.createSubject({ code, name_fr: nameFr, name_ar: nameAr, name_en: nameEn })
      }
      setEditingSubject(null); setCode(''); setNameFr(''); setNameAr(''); setNameEn('')
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally { setSaving(false) }
  }
  const assign = async () => {
    if (!selectedTeacher || !selectedSubject || !selectedClass) return
    setSaving(true); setError(null)
    try {
      await adminApi.assignTeaching({ teacher_id: Number(selectedTeacher), subject_id: Number(selectedSubject), class_id: Number(selectedClass) })
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally { setSaving(false) }
  }
  const unassign = async (teaching: AdminTeaching) => {
    if (!window.confirm(t(TRANSLATION_KEYS.admin.confirmUnassign) + '?')) return
    setSaving(true); setError(null)
    try { await adminApi.unassignTeaching(teaching.id); await reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setSaving(false) }
  }

  const filteredTeachers = useMemo(() => {
    const normalized = teacherQuery.trim().toLocaleLowerCase()
    return (resource.data?.teachers ?? []).filter((teacher) => {
      const matchesQuery = normalized === '' || [teacher.full_name, teacher.username, teacher.employee_id]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(normalized))
      const active = isActive(teacher.is_active)
      const matchesStatus = teacherStatus === 'all' || (teacherStatus === 'active' ? active : !active)
      const online = Boolean(Number(teacher.is_online))
      const matchesPresence = presenceFilter === 'all' || (presenceFilter === 'online' ? online : !online)
      return matchesQuery && matchesStatus && matchesPresence
    }).sort((a, b) => {
      if (teacherSort === 'online') return Number(b.is_online) - Number(a.is_online) || a.full_name.localeCompare(b.full_name)
      if (teacherSort === 'status') return Number(isActive(b.is_active)) - Number(isActive(a.is_active)) || a.full_name.localeCompare(b.full_name)
      return a.full_name.localeCompare(b.full_name)
    })
  }, [resource.data, teacherQuery, teacherStatus, presenceFilter, teacherSort])

  const filteredAssignments = useMemo(() => {
    const normalized = assignmentQuery.trim().toLocaleLowerCase()
    return (resource.data?.teachings ?? []).filter((teaching) => {
      if (normalized === '') return true
      return [
        teaching.subject_code,
        teaching.subject_name_fr,
        teaching.subject_name_ar,
        teaching.subject_name_en,
        teaching.class_name,
        teaching.class_level,
        teaching.class_branch,
        resource.data?.teachers.find((teacher) => teacher.id === teaching.teacher_id)?.full_name,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
    }).sort((a, b) => {
      if (assignmentSort === 'subject') return a.subject_name_fr.localeCompare(b.subject_name_fr) || a.class_name.localeCompare(b.class_name)
      if (assignmentSort === 'class') return a.class_name.localeCompare(b.class_name) || a.subject_name_fr.localeCompare(b.subject_name_fr)
      const teacherName = (id: number) => resource.data?.teachers.find((teacher) => teacher.id === id)?.full_name ?? String(id)
      return teacherName(a.teacher_id).localeCompare(teacherName(b.teacher_id)) || a.class_name.localeCompare(b.class_name)
    })
  }, [resource.data, assignmentQuery, assignmentSort])

  if (resource.status === 'idle' || resource.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  if (resource.status === 'error' || resource.data === null) {
    return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  }
  const { teachers, subjects, teachings, classes } = resource.data
  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.teachers)}
        description={t(TRANSLATION_KEYS.admin.teacherAdminHint)}
      />
      {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sams-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.assignTeaching)}</h2>
          <FormField label={t(TRANSLATION_KEYS.admin.teacher)}>
            {({ id, ...aria }) => <Select id={id} {...aria} value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}><option value="">{t(TRANSLATION_KEYS.admin.selectTeacher)}</option>{teachers.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</Select>}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.subject)}>
            {({ id, ...aria }) => <Select id={id} {...aria} value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)}><option value="">{t(TRANSLATION_KEYS.admin.selectSubject)}</option>{subjects.filter((x) => isActive(x.is_active)).map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name_fr}</option>)}</Select>}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.className)}>
            {({ id, ...aria }) => <Select id={id} {...aria} value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}><option value="">{t(TRANSLATION_KEYS.admin.selectClass)}</option>{classes.filter((x) => isActive(x.is_active) && isActive(x.academic_year_active)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>}
          </FormField>
          <Button type="button" disabled={!selectedTeacher || !selectedSubject || !selectedClass || saving} loading={saving} onClick={() => void assign()}>{t(TRANSLATION_KEYS.admin.assign)}</Button>
        </section>
        <section className="sams-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">{editingSubject ? t(TRANSLATION_KEYS.admin.editSubject) : t(TRANSLATION_KEYS.admin.createSubject)}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t(TRANSLATION_KEYS.admin.subjectCode)}>{({ id, ...aria }) => <Input id={id} {...aria} value={code} onChange={(e) => setCode(e.target.value)} />}</FormField>
            <FormField label="Français">{({ id, ...aria }) => <Input id={id} {...aria} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />}</FormField>
            <FormField label="العربية">{({ id, ...aria }) => <Input id={id} {...aria} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />}</FormField>
            <FormField label="English">{({ id, ...aria }) => <Input id={id} {...aria} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />}</FormField>
          </div>
          <div className="flex gap-2"><Button type="button" disabled={!code || !nameFr || !nameAr || !nameEn || saving} onClick={() => void saveSubject()}>{t(TRANSLATION_KEYS.admin.save)}</Button>{editingSubject && <Button type="button" variant="secondary" onClick={() => { setEditingSubject(null); setCode(''); setNameFr(''); setNameAr(''); setNameEn('') }}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>}</div>
        </section>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.teachingAssignments)}</h2>
        <AdminWorkspaceToolbar searchLabel={t(TRANSLATION_KEYS.admin.search)} searchPlaceholder={t(TRANSLATION_KEYS.admin.searchAssignments)} searchValue={assignmentQuery} onSearchChange={setAssignmentQuery}>
          <FormField label={t(TRANSLATION_KEYS.admin.sort)}>
            {({ id, ...aria }) => <Select id={id} {...aria} value={assignmentSort} onChange={(event) => setAssignmentSort(event.target.value as typeof assignmentSort)}>
              <option value="teacher">{t(TRANSLATION_KEYS.admin.sortName)}</option>
              <option value="subject">{t(TRANSLATION_KEYS.admin.sortSubject)}</option>
              <option value="class">{t(TRANSLATION_KEYS.admin.sortClass)}</option>
            </Select>}
          </FormField>
        </AdminWorkspaceToolbar>        {teachings.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.admin.teachingAssignments)} description={t(TRANSLATION_KEYS.admin.noAssignments)} /> : (
          <Table caption={t(TRANSLATION_KEYS.admin.teachingAssignments)} headers={[t(TRANSLATION_KEYS.admin.teacher), t(TRANSLATION_KEYS.admin.subject), t(TRANSLATION_KEYS.admin.className), t(TRANSLATION_KEYS.admin.actions)]}>
            {filteredAssignments.map((x) => <tr key={x.id} className="border-b border-[var(--sams-border)] last:border-b-0">
              <td className="px-3 py-2">{teachers.find((teacher) => teacher.id === x.teacher_id)?.full_name ?? x.teacher_id}</td>
              <td className="px-3 py-2">{x.subject_code} · {x.subject_name_fr}</td>
              <td className="px-3 py-2">{x.class_name}</td>
              <td className="px-3 py-2"><Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void unassign(x)}>{t(TRANSLATION_KEYS.admin.unassign)}</Button></td>
            </tr>)}
          </Table>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.teacherDirectory)}</h2>
        <AdminWorkspaceToolbar searchLabel={t(TRANSLATION_KEYS.admin.search)} searchPlaceholder={t(TRANSLATION_KEYS.admin.searchTeachers)} searchValue={teacherQuery} onSearchChange={setTeacherQuery}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t(TRANSLATION_KEYS.admin.status)}>{({ id, ...aria }) => <Select id={id} {...aria} value={teacherStatus} onChange={(event) => setTeacherStatus(event.target.value as typeof teacherStatus)}><option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option><option value="active">{t(TRANSLATION_KEYS.admin.activeOnly)}</option><option value="inactive">{t(TRANSLATION_KEYS.admin.inactiveOnly)}</option></Select>}</FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.sort)}>
              {({ id, ...aria }) => <Select id={id} {...aria} value={teacherSort} onChange={(event) => setTeacherSort(event.target.value as typeof teacherSort)}>
                <option value="name">{t(TRANSLATION_KEYS.admin.sortName)}</option>
                <option value="online">{t(TRANSLATION_KEYS.admin.sortOnline)}</option>
                <option value="status">{t(TRANSLATION_KEYS.admin.sortStatus)}</option>
              </Select>}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.onlineTeachers)}>{({ id, ...aria }) => <Select id={id} {...aria} value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as typeof presenceFilter)}><option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option><option value="online">{t(TRANSLATION_KEYS.admin.online)}</option><option value="offline">{t(TRANSLATION_KEYS.admin.offline)}</option></Select>}</FormField>
          </div>
        </AdminWorkspaceToolbar>
        <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.showingResults)}: {filteredTeachers.length} / {teachers.length}</p>
        <Table caption={t(TRANSLATION_KEYS.admin.teacherDirectory)} headers={[t(TRANSLATION_KEYS.admin.teacher), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.lastSeen)]}>
          {filteredTeachers.map((x) => <tr key={x.id} className="border-b border-[var(--sams-border)] last:border-b-0">
            <td className="px-3 py-2 font-medium">{x.full_name}</td>
            <td className="px-3 py-2"><Badge variant={isActive(x.is_active) ? 'success' : 'neutral'}>{isActive(x.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></td>
            <td className="px-3 py-2">{x.is_online ? t(TRANSLATION_KEYS.admin.online) : t(TRANSLATION_KEYS.admin.offline)}</td>
          </tr>)}
        </Table>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.subjects)}</h2>
        <Table caption={t(TRANSLATION_KEYS.admin.subjects)} headers={[t(TRANSLATION_KEYS.admin.subjectCode), t(TRANSLATION_KEYS.admin.subjectName), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.actions)]}>
          {subjects.map((x) => <tr key={x.id} className="border-b border-[var(--sams-border)] last:border-b-0">
            <td className="px-3 py-2">{x.code}</td><td className="px-3 py-2">{x.name_fr}</td>
            <td className="px-3 py-2"><Badge variant={isActive(x.is_active) ? 'success' : 'neutral'}>{isActive(x.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></td>
            <td className="px-3 py-2"><Button type="button" size="sm" variant="secondary" onClick={() => { setEditingSubject(x); setCode(x.code); setNameFr(x.name_fr); setNameAr(x.name_ar); setNameEn(x.name_en) }}>{t(TRANSLATION_KEYS.admin.edit)}</Button></td>
          </tr>)}
        </Table>
      </section>
    </section>
  )
}

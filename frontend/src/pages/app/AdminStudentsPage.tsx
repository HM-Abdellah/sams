import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { isActive } from '../../features/admin/helpers.ts'
import { useClassStudents } from '../../features/students/useClassStudents.ts'
import type { Student } from '../../features/students/types.ts'
import { studentsApi } from '../../features/students/api.ts'
import { StudentFormDialog } from '../../features/students/StudentFormDialog.tsx'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, Dialog, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function AdminStudentsPage() {
  const { t, formatDate } = useI18n()
  const classesResource = useAdminResource(() => adminApi.classes())
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedClassId = Number(searchParams.get('class_id') ?? 0) || null
  const [selectedClassId, setSelectedClassId] = useState<number | null>(requestedClassId)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active')
  const [sort, setSort] = useState<'name' | 'student_number' | 'status'>('name')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [transferTarget, setTransferTarget] = useState<Student | null>(null)
  const [targetClassId, setTargetClassId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayIso())
  const [busy, setBusy] = useState<number | 'transfer' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const classes = classesResource.data?.classes ?? []
  const activeClasses = useMemo(
    () => classes.filter((item) => isActive(item.is_active) && isActive(item.academic_year_active)),
    [classes],
  )

  const requestedActiveClassId = activeClasses.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : null
  const effectiveClassId = selectedClassId !== null && activeClasses.some((item) => item.id === selectedClassId)
    ? selectedClassId
    : requestedActiveClassId ?? activeClasses[0]?.id ?? null
  const selectedClass = classes.find((item) => item.id === effectiveClassId) ?? null
  const students = useClassStudents(effectiveClassId)

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return students.students.filter((student) => {
      const matchesQuery = normalized === '' || [
        student.first_name,
        student.last_name,
        student.student_number,
        student.massar_code,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
      const active = student.status === 'active'
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? active : !active)
      return matchesQuery && matchesStatus
    }).sort((a, b) => {
      if (sort === 'student_number') return (a.student_number ?? '').localeCompare(b.student_number ?? '') || a.last_name.localeCompare(b.last_name)
      if (sort === 'status') return a.status.localeCompare(b.status) || a.last_name.localeCompare(b.last_name)
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    })
  }, [students.students, query, statusFilter, sort])

  const transferClasses = useMemo(() => (
    selectedClass === null
      ? []
      : activeClasses.filter((item) => (
        item.id !== selectedClass.id
        && item.academic_year_id === selectedClass.academic_year_id
      ))
  ), [activeClasses, selectedClass])

  const openCreate = () => {
    setEditing(null)
    setError(null)
    setFormOpen(true)
  }

  const openEdit = (student: Student) => {
    setEditing(student)
    setError(null)
    setFormOpen(true)
  }

  const submitStudent = async (input: Parameters<typeof students.createStudent>[0]) => {
    const saved = editing === null
      ? await students.createStudent(input)
      : await students.updateStudent(editing.id, input)
    if (!saved && students.mutationError) setError(students.mutationError)
    return saved
  }

  const deactivate = async (student: Student) => {
    if (effectiveClassId === null) return
    if (!window.confirm(t(TRANSLATION_KEYS.admin.confirmDeactivateStudent) + ': ' + student.first_name + ' ' + student.last_name + '?')) return
    setBusy(student.id)
    setError(null)
    try {
      await studentsApi.deactivate(effectiveClassId, student.id)
      await students.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const openTransfer = (student: Student) => {
    setTransferTarget(student)
    setTargetClassId(transferClasses[0] ? String(transferClasses[0].id) : '')
    setEffectiveDate(todayIso())
    setError(null)
  }

  const transfer = async () => {
    if (effectiveClassId === null || transferTarget === null || !targetClassId || !effectiveDate) return
    setBusy('transfer')
    setError(null)
    try {
      await studentsApi.transfer(effectiveClassId, transferTarget.id, Number(targetClassId), effectiveDate)
      setTransferTarget(null)
      await students.reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  if (classesResource.status === 'idle' || classesResource.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }
  if (classesResource.status === 'error' || classesResource.data === null) {
    return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={classesResource.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void classesResource.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  }

  return (
    <>
      <section className="sams-admin-page space-y-8">
        <PageHeader
          title={t(TRANSLATION_KEYS.navigation.students)}
          description={t(TRANSLATION_KEYS.admin.studentAdminHint)}
          actions={<Button type="button" onClick={openCreate} disabled={effectiveClassId === null}>{t(TRANSLATION_KEYS.admin.create)}</Button>}
        />

        {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}

        <AdminWorkspaceToolbar
          searchLabel={t(TRANSLATION_KEYS.admin.search)}
          searchPlaceholder={t(TRANSLATION_KEYS.navigation.students)}
          searchValue={query}
          onSearchChange={setQuery}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t(TRANSLATION_KEYS.admin.selectStudentClass)}>
              {({ id, ...aria }) => (
                <Select
                  id={id}
                  {...aria}
                  value={effectiveClassId ? String(effectiveClassId) : ''}
                  onChange={(event) => {
                    const nextId = Number(event.target.value) || null
                    setSelectedClassId(nextId)
                    const nextParams = new URLSearchParams(searchParams)
                    if (nextId === null) nextParams.delete('class_id')
                    else nextParams.set('class_id', String(nextId))
                    setSearchParams(nextParams, { replace: true })
                  }}
                >
                  <option value="">{t(TRANSLATION_KEYS.admin.selectStudentClass)}</option>
                  {activeClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.sort)}>
              {({ id, ...aria }) => <Select id={id} {...aria} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                <option value="name">{t(TRANSLATION_KEYS.admin.sortName)}</option>
                <option value="student_number">{t(TRANSLATION_KEYS.teacher.studentNumber)}</option>
                <option value="status">{t(TRANSLATION_KEYS.admin.sortStatus)}</option>
              </Select>}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.status)}>
              {({ id, ...aria }) => (
                <Select id={id} {...aria} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                  <option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option>
                  <option value="active">{t(TRANSLATION_KEYS.admin.activeOnly)}</option>
                  <option value="inactive">{t(TRANSLATION_KEYS.admin.inactiveOnly)}</option>
                </Select>
              )}
            </FormField>
          </div>
        </AdminWorkspaceToolbar>

        {selectedClass ? (
          <section className="space-y-4" aria-labelledby="admin-students-context">
            <div className="sams-card grid gap-4 p-5 sm:grid-cols-3">
              <div>
                <p id="admin-students-context" className="sams-section-label">{t(TRANSLATION_KEYS.admin.className)}</p>
                <p className="mt-1 font-semibold">{selectedClass.name}</p>
              </div>
              <div>
                <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.academicYear)}</p>
                <p className="mt-1 font-semibold">{selectedClass.academic_year_name}</p>
              </div>
              <div>
                <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.students)}</p>
                <p className="mt-1 font-semibold">{students.students.filter((student) => student.status === 'active').length}</p>
              </div>
            </div>

            {students.status === 'loading' && students.students.length === 0 ? (
              <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
            ) : students.status === 'error' && students.students.length === 0 ? (
              <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={students.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void students.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
            ) : students.students.length === 0 ? (
              <EmptyState title={t(TRANSLATION_KEYS.navigation.students)} description={t(TRANSLATION_KEYS.admin.noStudentsInClass)} />
            ) : visibleStudents.length === 0 ? (
              <EmptyState title={t(TRANSLATION_KEYS.admin.search)} description={t(TRANSLATION_KEYS.admin.noStudentsInClass)} />
            ) : (
              <>
                <p className="text-sm text-[var(--sams-muted)]">
                  {t(TRANSLATION_KEYS.admin.showingResults)}: {visibleStudents.length} / {students.students.length}
                </p>
                <Table
                  caption={t(TRANSLATION_KEYS.navigation.students)}
                  headers={[
                    t(TRANSLATION_KEYS.teacher.studentNumber),
                    t(TRANSLATION_KEYS.admin.fullName),
                    t(TRANSLATION_KEYS.teacher.massarCode),
                    t(TRANSLATION_KEYS.teacher.birthDate),
                    t(TRANSLATION_KEYS.admin.status),
                    t(TRANSLATION_KEYS.admin.actions),
                  ]}
                >
                  {visibleStudents.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-3 py-3">{student.student_number ?? '—'}</td>
                      <td className="px-3 py-3 font-medium">{student.first_name} {student.last_name}</td>
                      <td className="px-3 py-3">{student.massar_code ?? '—'}</td>
                      <td className="px-3 py-3">{student.birth_date ? formatDate(student.birth_date) : '—'}</td>
                      <td className="px-3 py-3"><Badge variant={student.status === 'active' ? 'success' : 'neutral'}>{student.status}</Badge></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {student.status === 'active' && <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => openEdit(student)}>{t(TRANSLATION_KEYS.admin.edit)}</Button>}
                          {student.status === 'active' && <Button type="button" size="sm" variant="secondary" disabled={busy !== null} onClick={() => openTransfer(student)}>{t(TRANSLATION_KEYS.admin.transferStudent)}</Button>}
                          {student.status === 'active' && <Button type="button" size="sm" disabled={busy !== null && busy !== student.id} onClick={() => void deactivate(student)}>{t(TRANSLATION_KEYS.admin.deactivate)}</Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
          </section>
        ) : (
          <EmptyState title={t(TRANSLATION_KEYS.navigation.students)} description={t(TRANSLATION_KEYS.admin.selectStudentClass)} />
        )}
      </section>

      <StudentFormDialog
        open={formOpen}
        mode={editing ? 'edit' : 'create'}
        student={editing}
        saving={students.mutationStatus === 'saving'}
        error={students.mutationError ?? error}
        onClose={() => { setFormOpen(false); setEditing(null); setError(null) }}
        onSubmit={submitStudent}
      />

      <Dialog
        open={transferTarget !== null}
        title={t(TRANSLATION_KEYS.admin.transferStudent)}
        description={transferTarget ? transferTarget.first_name + ' ' + transferTarget.last_name : ''}
        closeLabel={t(TRANSLATION_KEYS.admin.cancel)}
        onClose={() => { setTransferTarget(null); setError(null) }}
      >
        <div className="space-y-4">
          <FormField label={t(TRANSLATION_KEYS.admin.targetClass)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={targetClassId} onChange={(event) => setTargetClassId(event.target.value)}>
                <option value="">{t(TRANSLATION_KEYS.admin.targetClass)}</option>
                {transferClasses.map((item: AdminClass) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.admin.effectiveDate)}>
            {({ id, ...aria }) => <Input id={id} {...aria} type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />}
          </FormField>
          <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.confirmTransferStudent)}.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy === 'transfer'} onClick={() => setTransferTarget(null)}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>
            <Button type="button" disabled={!targetClassId || !effectiveDate || busy !== null} loading={busy === 'transfer'} onClick={() => void transfer()}>{t(TRANSLATION_KEYS.admin.transferStudent)}</Button>
          </div>
        </div>
      </Dialog>
    </>
  )
}

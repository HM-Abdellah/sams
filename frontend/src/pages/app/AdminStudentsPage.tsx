import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import {
  compareClassNames,
  compareRosterNumbers,
  isActive,
  studyLevelCode,
} from '../../features/admin/helpers.ts'
import { useClassStudents } from '../../features/students/useClassStudents.ts'
import type { Student } from '../../features/students/types.ts'
import { studentsApi } from '../../features/students/api.ts'
import { StudentFormDialog } from '../../features/students/StudentFormDialog.tsx'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Button, Dialog, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

const EMPTY_ADMIN_CLASSES: AdminClass[] = []

function todayIso() {
  const date = new Date()
  return date.getFullYear()
    + '-' + String(date.getMonth() + 1).padStart(2, '0')
    + '-' + String(date.getDate()).padStart(2, '0')
}

export function AdminStudentsPage() {
  const { t, formatDate } = useI18n()
  const loadClasses = useCallback(() => adminApi.classes(), [])
  const classesResource = useAdminResource(loadClasses)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedClassId = Number(searchParams.get('class_id') ?? 0) || null
  const [selectedClassId, setSelectedClassId] = useState<number | null>(requestedClassId)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [transferTarget, setTransferTarget] = useState<Student | null>(null)
  const [targetClassId, setTargetClassId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(todayIso())
  const [busy, setBusy] = useState<number | 'transfer' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const classes = classesResource.data?.classes ?? EMPTY_ADMIN_CLASSES
  const allActiveClasses = useMemo(
    () => classes.filter((item) => isActive(item.is_active)),
    [classes],
  )
  const activeYearClasses = useMemo(
    () => allActiveClasses.filter((item) => isActive(item.academic_year_active)),
    [allActiveClasses],
  )

  // Keep the everyday roster focused on the active academic year. A historical
  // class is included only when the route explicitly requests its class_id.
  const classOptions = useMemo(() => {
    const options = [...(activeYearClasses.length > 0 ? activeYearClasses : allActiveClasses)]
    const explicitlyRequested = allActiveClasses.find((item) => item.id === requestedClassId)
    if (
      explicitlyRequested !== undefined
      && !isActive(explicitlyRequested.academic_year_active)
      && !options.some((item) => item.id === explicitlyRequested.id)
    ) {
      options.push(explicitlyRequested)
    }

    const levelOrder = { '2BAC': 0, '1BAC': 1, TC: 2, other: 3 } as const
    return options.sort((a, b) => (
      levelOrder[studyLevelCode(a)] - levelOrder[studyLevelCode(b)]
      || compareClassNames(a, b)
    ))
  }, [activeYearClasses, allActiveClasses, requestedClassId])

  const classGroups = useMemo(() => {
    const groups: Record<'TC' | '1BAC' | '2BAC' | 'other', AdminClass[]> = {
      TC: [],
      '1BAC': [],
      '2BAC': [],
      other: [],
    }

    for (const item of classOptions) groups[studyLevelCode(item)].push(item)
    for (const group of Object.values(groups)) group.sort(compareClassNames)
    return groups
  }, [classOptions])

  const requestedAvailableClassId = classOptions.some((item) => item.id === requestedClassId)
    ? requestedClassId
    : null
  const defaultClassId = classOptions[0]?.id ?? null
  const effectiveClassId = selectedClassId !== null && classOptions.some((item) => item.id === selectedClassId)
    ? selectedClassId
    : requestedAvailableClassId ?? defaultClassId
  const selectedClass = classes.find((item) => item.id === effectiveClassId) ?? null
  const isWritableClass = selectedClass !== null
    && isActive(selectedClass.is_active)
    && isActive(selectedClass.academic_year_active)
  const students = useClassStudents(effectiveClassId)

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    return [...students.students]
      .filter((student) => normalized === '' || [
        student.first_name,
        student.last_name,
        student.student_number,
        student.massar_code,
      ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized)))
      .sort(compareRosterNumbers)
  }, [students.students, query])

  const transferClasses = useMemo(() => (
    selectedClass === null
      ? []
      : classOptions.filter((item) => (
        item.id !== selectedClass.id
        && item.academic_year_id === selectedClass.academic_year_id
      ))
  ), [classOptions, selectedClass])

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
          actions={<Button type="button" onClick={openCreate} disabled={!isWritableClass}>{t(TRANSLATION_KEYS.admin.create)}</Button>}
        />

        {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}

        <AdminWorkspaceToolbar
          searchLabel={t(TRANSLATION_KEYS.admin.search)}
          searchPlaceholder={t(TRANSLATION_KEYS.navigation.students)}
          searchValue={query}
          onSearchChange={setQuery}
        >
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
                {(['2BAC', '1BAC', 'TC'] as const).map((group) => (
                  classGroups[group].length > 0 && (
                    <optgroup key={group} label={group}>
                      {classGroups[group].map((item) => (
                        <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>
                      ))}
                    </optgroup>
                  )
                ))}
                {classGroups.other.length > 0 && (
                  <optgroup label={t(TRANSLATION_KEYS.admin.level)}>
                    {classGroups.other.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>
                    ))}
                  </optgroup>
                )}
              </Select>
            )}
          </FormField>
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
                <p className="mt-1 font-semibold">{students.students.length}</p>
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
                    t(TRANSLATION_KEYS.admin.rosterNumber),
                    t(TRANSLATION_KEYS.teacher.studentNumber),
                    t(TRANSLATION_KEYS.admin.fullName),
                    t(TRANSLATION_KEYS.teacher.massarCode),
                    t(TRANSLATION_KEYS.teacher.birthDate),
                    t(TRANSLATION_KEYS.admin.actions),
                  ]}
                >
                  {visibleStudents.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-3 py-3 tabular-nums">{student.roster_number ?? '—'}</td>
                      <td className="px-3 py-3 tabular-nums">{student.student_number ?? '—'}</td>
                      <td className="px-3 py-3 font-medium">{student.first_name} {student.last_name}</td>
                      <td className="px-3 py-3">{student.massar_code ?? '—'}</td>
                      <td className="px-3 py-3">{student.birth_date ? formatDate(student.birth_date) : '—'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" variant="secondary" disabled={busy !== null || !isWritableClass} onClick={() => openEdit(student)}>{t(TRANSLATION_KEYS.admin.edit)}</Button>
                          <Button type="button" size="sm" variant="secondary" disabled={busy !== null || !isWritableClass || transferClasses.length === 0} onClick={() => openTransfer(student)}>{t(TRANSLATION_KEYS.admin.transferStudent)}</Button>
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
                {transferClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
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


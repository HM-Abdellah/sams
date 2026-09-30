import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { useClassStudents } from '../../features/students/useClassStudents.ts'
import type { Student } from '../../features/students/types.ts'
import { StudentDetailsDialog } from '../../features/students/StudentDetailsDialog.tsx'
import { StudentFormDialog } from '../../features/students/StudentFormDialog.tsx'
import {
  AsyncStateFeedback,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  FormField,
  Loading,
  Search,
  Select,
  Table,
} from '../../components/ui/index.ts'

export function TeacherStudentsPage() {
  const { t, formatDate } = useI18n()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [detailsStudent, setDetailsStudent] = useState<Student | null>(null)
  const [formStudent, setFormStudent] = useState<Student | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const classes = useTeacherClasses()
  const selectedClassId = Number(params.get('class_id') ?? 0) || null
  const selectedClass = classes.classes.find((item) => item.id === selectedClassId) ?? null
  const students = useClassStudents(selectedClassId)
  const studentsState = {
    status: students.status,
    data: students.students.length > 0 ? students.students : null,
    error: students.error,
  } as const

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return students.students

    return students.students.filter((student) =>
      [
        student.first_name,
        student.last_name,
        student.student_number ?? '',
        student.massar_code ?? '',
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized),
    )
  }, [query, students.students])
  const selectClass = (classId: string) => {
    const next = new URLSearchParams(params)
    if (classId) next.set('class_id', classId)
    else next.delete('class_id')
    setParams(next)
    setQuery('')
    setDetailsStudent(null)
    setFormStudent(null)
    setFormOpen(false)
  }

  const openCreate = () => {
    setFormMode('create')
    setFormStudent(null)
    setFormOpen(true)
  }

  const openEdit = (student: Student) => {
    setDetailsStudent(null)
    setFormMode('edit')
    setFormStudent(student)
    setFormOpen(true)
  }

  const submitStudent = async (input: Parameters<typeof students.createStudent>[0]) => {
    if (formMode === 'create') return students.createStudent(input)
    if (formStudent === null) return false
    return students.updateStudent(formStudent.id, input)
  }

  if (classes.status === 'idle' || classes.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }

  if (classes.status === 'error') {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={classes.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={
          <Button type="button" variant="secondary" onClick={() => void classes.reload()}>
            {t(TRANSLATION_KEYS.system.reload)}
          </Button>
        }
      />
    )
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{t(TRANSLATION_KEYS.navigation.students)}</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">
          {t(TRANSLATION_KEYS.teacher.teachingContext)}
        </p>
      </header>
      {classes.classes.length === 0 ? (
        <EmptyState
          title={t(TRANSLATION_KEYS.teacher.classes)}
          description={t(TRANSLATION_KEYS.teacher.noClasses)}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <FormField label={t(TRANSLATION_KEYS.teacher.selectClass)}>
              {({ id, ...aria }) => (
                <Select
                  id={id}
                  {...aria}
                  value={selectedClassId ? String(selectedClassId) : ''}
                  onChange={(event) => selectClass(event.target.value)}
                >
                  <option value="">{t(TRANSLATION_KEYS.teacher.selectClass)}</option>
                  {classes.classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              )}
            </FormField>

            <div className="flex items-end">
              <Button
                type="button"
                disabled={selectedClassId === null}
                onClick={openCreate}
              >
                {t(TRANSLATION_KEYS.teacher.addStudent)}
              </Button>
            </div>
          </div>

          {selectedClass === null ? (
            <EmptyState title={t(TRANSLATION_KEYS.teacher.selectClass)} />
          ) : (
            <section className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-surface)] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">{selectedClass.name}</h2>
                  <p className="mt-1 text-sm text-[var(--sams-muted)]">
                    {[selectedClass.level, selectedClass.branch].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                <Badge variant="info">
                  {students.students.length} {t(TRANSLATION_KEYS.teacher.studentCount)}
                </Badge>
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <Detail
                  label={t(TRANSLATION_KEYS.teacher.academicYear)}
                  value={selectedClass.academic_year_name ?? '—'}
                />
                <Detail
                  label={t(TRANSLATION_KEYS.teacher.academicYearRange)}
                  value={
                    selectedClass.academic_year_starts_on && selectedClass.academic_year_ends_on
                      ? formatDate(selectedClass.academic_year_starts_on) +
                        ' → ' +
                        formatDate(selectedClass.academic_year_ends_on)
                      : '—'
                  }
                />
              </dl>
              <p className="mt-4 text-sm text-[var(--sams-muted)]">
                {t(TRANSLATION_KEYS.teacher.historicalEnrollmentHint)}
              </p>
            </section>
          )}

          {selectedClassId !== null && (
            <>
              {students.students.length === 0 && students.status === 'success' ? (
                <EmptyState title={t(TRANSLATION_KEYS.teacher.noStudents)} />
              ) : students.students.length === 0 ? (
                <AsyncStateFeedback
                  state={studentsState}
                  loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
                  refreshingLabel={t(TRANSLATION_KEYS.auth.loading)}
                  errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
                  genericError={t(TRANSLATION_KEYS.system.genericError)}
                  staleErrorLabel={t(TRANSLATION_KEYS.system.genericError)}
                  reloadLabel={t(TRANSLATION_KEYS.system.reload)}
                  onRetry={() => void students.reload()}
                />
              ) : (
                <>
                  <AsyncStateFeedback
                    state={studentsState}
                    loadingLabel={t(TRANSLATION_KEYS.auth.loading)}
                    refreshingLabel={t(TRANSLATION_KEYS.system.refreshing)}
                    errorTitle={t(TRANSLATION_KEYS.system.errorTitle)}
                    genericError={t(TRANSLATION_KEYS.system.genericError)}
                    staleErrorLabel={t(TRANSLATION_KEYS.system.staleError)}
                    reloadLabel={t(TRANSLATION_KEYS.system.reload)}
                    onRetry={() => void students.reload()}
                  />
                <div className="space-y-4">
                  <Search
                    aria-label={t(TRANSLATION_KEYS.teacher.searchStudents)}
                    placeholder={t(TRANSLATION_KEYS.teacher.searchStudents)}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onClear={() => setQuery('')}
                    clearLabel={t(TRANSLATION_KEYS.teacher.clearSearch)}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-[var(--sams-muted)]">
                      {filteredStudents.length} / {students.students.length} {t(TRANSLATION_KEYS.teacher.studentCount)}
                    </p>
                    {students.mutationStatus === 'saving' && (
                      <p role="status" className="text-sm text-[var(--sams-muted)]">
                        {t(TRANSLATION_KEYS.attendance.saving)}
                      </p>
                    )}
                    {students.mutationStatus === 'success' && (
                      <p role="status" className="text-sm text-[var(--sams-success)]">
                        {t(TRANSLATION_KEYS.attendance.saved)}
                      </p>
                    )}
                    {students.mutationStatus === 'error' && students.mutationError && (
                      <p role="alert" className="text-sm text-[var(--sams-danger)]">
                        {students.mutationError}
                      </p>
                    )}
                  </div>

                  {filteredStudents.length === 0 ? (
                    <EmptyState title={t(TRANSLATION_KEYS.teacher.noStudentMatches)} />
                  ) : (
                    <div className="overflow-x-auto">
                      <Table
                        caption={t(TRANSLATION_KEYS.teacher.classRoster)}
                        headers={[
                          t(TRANSLATION_KEYS.teacher.studentNumber),
                          t(TRANSLATION_KEYS.teacher.studentName),
                          t(TRANSLATION_KEYS.teacher.studentStatus),
                          t(TRANSLATION_KEYS.teacher.viewDetails),
                        ]}
                      >
                        {filteredStudents.map((student) => (
                          <tr
                            key={student.id}
                            className="border-b border-[var(--sams-border)] last:border-b-0"
                          >
                            <td className="px-3 py-2">{student.student_number ?? '—'}</td>
                            <td className="px-3 py-2 font-medium">
                              {student.first_name} {student.last_name}
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>
                                {student.status === 'active'
                                  ? t(TRANSLATION_KEYS.teacher.active)
                                  : t(TRANSLATION_KEYS.teacher.inactive)}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setDetailsStudent(student)}
                                >
                                  {t(TRANSLATION_KEYS.teacher.viewDetails)}
                                </Button>
                                {student.status === 'active' && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => openEdit(student)}
                                  >
                                    {t(TRANSLATION_KEYS.teacher.editStudent)}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  )}
                </div>
              </>
              )}
            </>
          )}
        </>
      )}

      <StudentDetailsDialog
        open={detailsStudent !== null}
        student={detailsStudent}
        classInfo={selectedClass}
        onClose={() => setDetailsStudent(null)}
        onEdit={() => {
          if (detailsStudent !== null) openEdit(detailsStudent)
        }}
      />
      <StudentFormDialog
        open={formOpen}
        mode={formMode}
        student={formStudent}
        saving={students.mutationStatus === 'saving'}
        error={students.mutationError}
        onClose={() => {
          if (students.mutationStatus !== 'saving') setFormOpen(false)
        }}
        onSubmit={submitStudent}
      />
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--sams-muted)]">{label}</dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { useClassStudents } from '../../features/students/useClassStudents.ts'
import { Badge, Button, EmptyState, ErrorState, FormField, Loading, Search, Select, Table } from '../../components/ui/index.ts'

export function TeacherStudentsPage() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const classes = useTeacherClasses()
  const selectedClassId = Number(params.get('class_id') ?? 0) || null
  const students = useClassStudents(selectedClassId)

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase()
    if (!normalized) return students.students

    return students.students.filter((student) =>
      `${student.first_name} ${student.last_name} ${student.student_number ?? ''}`
        .toLocaleLowerCase()
        .includes(normalized),
    )
  }, [query, students.students])

  const selectClass = (classId: string) => {
    const next = new URLSearchParams(params)
    if (classId) next.set('class_id', classId)
    else next.delete('class_id')
    setParams(next)
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
        <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.classes)}</p>
      </header>

      {classes.classes.length === 0 ? (
        <EmptyState title={t(TRANSLATION_KEYS.teacher.classes)} description={t(TRANSLATION_KEYS.teacher.noClasses)} />
      ) : (
        <>
          <FormField label={t(TRANSLATION_KEYS.teacher.selectClass)}>
            {({ id }) => (
              <Select id={id} value={selectedClassId ? String(selectedClassId) : ''} onChange={(event) => selectClass(event.target.value)}>
                <option value="">{t(TRANSLATION_KEYS.teacher.selectClass)}</option>
                {classes.classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </Select>
            )}
          </FormField>

          {selectedClassId === null ? (
            <EmptyState title={t(TRANSLATION_KEYS.teacher.selectClass)} />
          ) : students.status === 'idle' || students.status === 'loading' ? (
            <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
          ) : students.status === 'error' ? (
            <ErrorState
              title={t(TRANSLATION_KEYS.system.errorTitle)}
              description={students.error ?? t(TRANSLATION_KEYS.system.genericError)}
              action={
                <Button type="button" variant="secondary" onClick={() => void students.reload()}>
                  {t(TRANSLATION_KEYS.system.reload)}
                </Button>
              }
            />
          ) : students.students.length === 0 ? (
            <EmptyState title={t(TRANSLATION_KEYS.teacher.noStudents)} />
          ) : (
            <div className="space-y-4">
              <Search
                aria-label={t(TRANSLATION_KEYS.teacher.searchStudents)}
                placeholder={t(TRANSLATION_KEYS.teacher.searchStudents)}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onClear={() => setQuery('')}
                clearLabel={t(TRANSLATION_KEYS.teacher.clearSearch)}
              />
              <p className="text-sm text-[var(--sams-muted)]">
                {filteredStudents.length} / {students.students.length} {t(TRANSLATION_KEYS.teacher.studentCount)}
              </p>
              {filteredStudents.length === 0 ? (
                <EmptyState title={t(TRANSLATION_KEYS.teacher.noStudentMatches)} />
              ) : (
                <Table
                  caption={t(TRANSLATION_KEYS.navigation.students)}
                  headers={[
                    t(TRANSLATION_KEYS.teacher.studentNumber),
                    t(TRANSLATION_KEYS.teacher.studentName),
                    t(TRANSLATION_KEYS.teacher.studentStatus),
                  ]}
                >
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-3 py-2">{student.student_number ?? '—'}</td>
                      <td className="px-3 py-2 font-medium">{student.first_name} {student.last_name}</td>
                      <td className="px-3 py-2">
                        <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>
                          {student.status === 'active'
                            ? t(TRANSLATION_KEYS.teacher.active)
                            : t(TRANSLATION_KEYS.teacher.inactive)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </Table>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}

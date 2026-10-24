import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { adminApi } from '../../features/admin/api.ts'
import type { AdminClass, AdminSubject, AdminTeacher, AdminTeacherPresence, AdminTeaching } from '../../features/admin/types.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { useLiveRefresh } from '../../features/sync/useLiveRefresh.ts'
import { dateTime, isActive } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import type { Locale } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge, Button, ConfirmDialog, Dialog, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table,
} from '../../components/ui/index.ts'
import { AdminWorkspaceToolbar } from '../../components/admin/AdminWorkspaceToolbar.tsx'

interface TeachersWorkspaceData {
  teachers: AdminTeacher[]
  subjects: AdminSubject[]
  teachings: AdminTeaching[]
  online_window_seconds: number
  classes: AdminClass[]
}

interface SubjectForm {
  code: string
  name_fr: string
  name_ar: string
  name_en: string
  is_active: boolean
}

const EMPTY_SUBJECT_FORM: SubjectForm = {
  code: '',
  name_fr: '',
  name_ar: '',
  name_en: '',
  is_active: true,
}

const EMPTY_TEACHERS: AdminTeacher[] = []

function subjectLabel(subject: Pick<AdminSubject, 'name_fr' | 'name_ar' | 'name_en' | 'code'>, locale: Locale) {
  const translated = locale === 'ar' ? subject.name_ar : locale === 'en' ? subject.name_en : subject.name_fr
  return translated.trim() || subject.name_fr.trim() || subject.name_en.trim() || subject.name_ar.trim() || subject.code
}

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={online ? 'inline-block size-2.5 shrink-0 rounded-full bg-[var(--sams-success)] ring-4 ring-[var(--sams-success)]/10' : 'inline-block size-2.5 shrink-0 rounded-full bg-[var(--sams-border)]'}
    />
  )
}

function isOnline(teacher: AdminTeacher) {
  return isActive(teacher.is_active) && Number(teacher.is_online) === 1
}

function isCurrentTeaching(teaching: AdminTeaching) {
  return teaching.status === 'active'
    && isActive(teaching.class_is_active)
    && isActive(teaching.academic_year_active)
}

export function AdminTeachersPage() {
  const { t, locale, formatDate } = useI18n()
  const load = useCallback(async (): Promise<TeachersWorkspaceData> => {
    const [directory, classResult] = await Promise.all([adminApi.teachers(), adminApi.classes()])
    return {
      ...directory,
      classes: classResult.classes,
    }
  }, [])
  const resource = useAdminResource(load)
  const [presenceTeachers, setPresenceTeachers] = useState<AdminTeacherPresence[] | null>(null)
  const [presenceUpdatedAt, setPresenceUpdatedAt] = useState<Date | null>(null)
  const [presenceError, setPresenceError] = useState(false)
  const presenceRequestId = useRef(0)
  const [teacherQuery, setTeacherQuery] = useState('')
  const [presenceFilter, setPresenceFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [selectedSubjectId, setSelectedSubjectId] = useState('')
  const [selectedClassId, setSelectedClassId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unassignTarget, setUnassignTarget] = useState<AdminTeaching | null>(null)
  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<AdminSubject | null>(null)
  const [subjectForm, setSubjectForm] = useState<SubjectForm>(EMPTY_SUBJECT_FORM)

  const refreshPresence = useCallback(async () => {
    const requestId = ++presenceRequestId.current
    try {
      const result = await adminApi.teacherPresence()
      if (requestId !== presenceRequestId.current) return
      setPresenceTeachers(result.teachers)
      setPresenceUpdatedAt(new Date())
      setPresenceError(false)
    } catch {
      if (requestId !== presenceRequestId.current) return
      setPresenceError(true)
    }
  }, [])

  useEffect(() => {
    if (resource.status !== 'success') return
    void refreshPresence()
  }, [resource.status, refreshPresence])

  useLiveRefresh(refreshPresence, {
    enabled: resource.status === 'success',
    intervalMs: 30_000,
  })

  const reload = async () => {
    setPresenceTeachers(null)
    setPresenceUpdatedAt(null)
    setError(null)
    await resource.reload()
  }

  const allTeachers = useMemo(() => {
    const teachers = resource.data?.teachers ?? EMPTY_TEACHERS
    if (presenceTeachers === null) return teachers
    const presenceById = new Map(presenceTeachers.map((teacher) => [teacher.id, teacher]))
    return teachers.map((teacher) => {
      const currentPresence = presenceById.get(teacher.id)
      return currentPresence ? {
        ...teacher,
        is_active: currentPresence.is_active,
        last_seen_at: currentPresence.last_seen_at,
        is_online: currentPresence.is_online,
      } : teacher
    })
  }, [resource.data?.teachers, presenceTeachers])
  const activeTeachers = allTeachers.filter((teacher) => isActive(teacher.is_active))
  const onlineTeachers = allTeachers.filter(isOnline).length
  const activeSubjects = (resource.data?.subjects ?? []).filter((subject) => isActive(subject.is_active))
  const assignableClasses = (resource.data?.classes ?? []).filter((item) => (
    isActive(item.is_active) && isActive(item.academic_year_active)
  ))

  const filteredTeachers = useMemo(() => {
    const normalized = teacherQuery.trim().toLocaleLowerCase()
    return allTeachers
      .filter((teacher) => {
        const matchesQuery = normalized === '' || [
          teacher.full_name,
          teacher.username,
          teacher.employee_id,
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
        const online = isOnline(teacher)
        const matchesPresence = presenceFilter === 'all'
          || (presenceFilter === 'online' ? online : !online)
        return matchesQuery && matchesPresence
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [allTeachers, teacherQuery, presenceFilter])

  const visibleTeachings = useMemo(() => {
    return (resource.data?.teachings ?? []).slice().sort((a, b) => (
      Number(isCurrentTeaching(b)) - Number(isCurrentTeaching(a))
      || a.teacher_id - b.teacher_id
      || a.subject_name_fr.localeCompare(b.subject_name_fr)
      || a.class_name.localeCompare(b.class_name, undefined, { numeric: true, sensitivity: 'base' })
    ))
  }, [resource.data?.teachings])

  const assignTeaching = async () => {
    if (!selectedTeacherId || !selectedSubjectId || !selectedClassId) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.assignTeaching({
        teacher_id: Number(selectedTeacherId),
        subject_id: Number(selectedSubjectId),
        class_id: Number(selectedClassId),
      })
      setSelectedTeacherId('')
      setSelectedSubjectId('')
      setSelectedClassId('')
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(false)
    }
  }

  const unassignTeaching = async () => {
    if (unassignTarget === null) return
    setBusy(true)
    setError(null)
    try {
      await adminApi.unassignTeaching(unassignTarget.id)
      setUnassignTarget(null)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(false)
    }
  }

  const openCreateSubject = () => {
    setEditingSubject(null)
    setSubjectForm(EMPTY_SUBJECT_FORM)
    setError(null)
    setSubjectDialogOpen(true)
  }

  const openEditSubject = (subject: AdminSubject) => {
    setEditingSubject(subject)
    setSubjectForm({
      code: subject.code,
      name_fr: subject.name_fr,
      name_ar: subject.name_ar,
      name_en: subject.name_en,
      is_active: isActive(subject.is_active),
    })
    setError(null)
    setSubjectDialogOpen(true)
  }

  const saveSubject = async () => {
    if (!subjectForm.code.trim() || !subjectForm.name_fr.trim() || !subjectForm.name_ar.trim() || !subjectForm.name_en.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (editingSubject) {
        await adminApi.updateSubject({
          id: editingSubject.id,
          code: subjectForm.code.trim(),
          name_fr: subjectForm.name_fr.trim(),
          name_ar: subjectForm.name_ar.trim(),
          name_en: subjectForm.name_en.trim(),
          is_active: subjectForm.is_active,
        })
      } else {
        await adminApi.createSubject({
          code: subjectForm.code.trim(),
          name_fr: subjectForm.name_fr.trim(),
          name_ar: subjectForm.name_ar.trim(),
          name_en: subjectForm.name_en.trim(),
        })
      }
      setSubjectDialogOpen(false)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(false)
    }
  }

  if (resource.status === 'idle' || resource.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }

  if (resource.status === 'error' || resource.data === null) {
    return (
      <ErrorState
        title={t(TRANSLATION_KEYS.system.errorTitle)}
        description={resource.error ?? t(TRANSLATION_KEYS.system.genericError)}
        action={<Button type="button" variant="secondary" onClick={() => void reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>}
      />
    )
  }

  const teachers = resource.data.teachers

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        eyebrow={t(TRANSLATION_KEYS.admin.people)}
        title={t(TRANSLATION_KEYS.navigation.teachers)}
        description={t(TRANSLATION_KEYS.admin.teacherAdminHint)}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/app/admin/onboarding"
              className="sams-interactive-target inline-flex min-h-[var(--sams-control-min)] items-center rounded-[var(--sams-radius-control)] border border-[var(--sams-brand-border)] bg-[var(--sams-brand-surface)] px-3.5 text-sm font-semibold text-[var(--sams-brand-navy)] hover:bg-white"
            >
              {t(TRANSLATION_KEYS.navigation.onboarding)}
            </Link>
            <Button type="button" variant="secondary" onClick={() => void reload()}>
              {t(TRANSLATION_KEYS.system.reload)}
            </Button>
          </div>
        )}
      />

      {error && (
        <p role="alert" className="rounded-lg border border-[var(--sams-danger)]/20 bg-[var(--sams-danger-surface)] px-3 py-2.5 text-sm text-[var(--sams-danger)]">
          {error}
        </p>
      )}

      {presenceError && (
        <p role="status" className="text-sm text-[var(--sams-muted)]">
          {t(TRANSLATION_KEYS.admin.presenceRefreshFailed)}
        </p>
      )}

      <section aria-label={t(TRANSLATION_KEYS.admin.overview)} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="sams-card border-s-[3px] border-s-[var(--sams-brand-primary)] p-5">
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.teacherDirectory)}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{teachers.length}</p>
          <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.teacher)}</p>
        </article>
        <article className="sams-card p-5">
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.onlineTeachers)}</p>
          <div className="mt-3 flex items-center gap-2">
            <PresenceDot online={onlineTeachers > 0} />
            <p className="text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{onlineTeachers}</p>
          </div>
          <p className="mt-1 text-sm text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.admin.online)} · {resource.data.online_window_seconds}s
          </p>
        </article>
        <article className="sams-card p-5">
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.activeTeachers)}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{activeTeachers.length}</p>
          <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.active)}</p>
        </article>
        <article className="sams-card p-5">
          <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.teachingAssignments)}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{visibleTeachings.length}</p>
          <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.subjects)} · {resource.data.subjects.length}</p>
        </article>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.teacherDirectory)}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{t(TRANSLATION_KEYS.navigation.teachers)}</h2>
          </div>
          <div className="text-end text-xs text-[var(--sams-muted)]">
            <p>{t(TRANSLATION_KEYS.admin.showingResults)}: <span className="font-semibold text-[var(--sams-text)]">{filteredTeachers.length}</span> / {allTeachers.length}</p>
            <p aria-live="polite" className="mt-1">
              {presenceUpdatedAt
                ? `${t(TRANSLATION_KEYS.admin.lastPresenceUpdate)} · ${formatDate(presenceUpdatedAt, { dateStyle: 'short', timeStyle: 'medium' })}`
                : t(TRANSLATION_KEYS.admin.livePresence)}
            </p>
          </div>
        </div>

        <AdminWorkspaceToolbar
          searchLabel={t(TRANSLATION_KEYS.admin.search)}
          searchPlaceholder={t(TRANSLATION_KEYS.admin.searchTeachers)}
          searchValue={teacherQuery}
          onSearchChange={setTeacherQuery}
        >
          <FormField label={t(TRANSLATION_KEYS.admin.status)}>
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={presenceFilter} onChange={(event) => setPresenceFilter(event.target.value as typeof presenceFilter)}>
                <option value="all">{t(TRANSLATION_KEYS.admin.allStatuses)}</option>
                <option value="online">{t(TRANSLATION_KEYS.admin.online)}</option>
                <option value="offline">{t(TRANSLATION_KEYS.admin.offline)}</option>
              </Select>
            )}
          </FormField>
        </AdminWorkspaceToolbar>

        {filteredTeachers.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.teacherDirectory)} description={t(TRANSLATION_KEYS.admin.noMatchingResults)} />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[var(--sams-brand-border)] bg-[var(--sams-surface)] md:block">
              <Table
                caption={t(TRANSLATION_KEYS.admin.teacherDirectory)}
                headers={[
                  t(TRANSLATION_KEYS.admin.teacher),
                  t(TRANSLATION_KEYS.admin.employeeId),
                  t(TRANSLATION_KEYS.admin.status),
                  t(TRANSLATION_KEYS.admin.lastSeen),
                  t(TRANSLATION_KEYS.admin.accountStatus),
                ]}
              >
                {filteredTeachers.map((teacher) => {
                  const online = isOnline(teacher)
                  return (
                    <tr key={teacher.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <PresenceDot online={online} />
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--sams-brand-navy)]">{teacher.full_name}</p>
                            <p className="mt-0.5 truncate text-xs text-[var(--sams-muted)]">@{teacher.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">{teacher.employee_id ?? '—'}</td>
                      <td className="px-4 py-3.5"><Badge variant={online ? 'success' : 'neutral'}>{online ? t(TRANSLATION_KEYS.admin.online) : t(TRANSLATION_KEYS.admin.offline)}</Badge></td>
                      <td className="px-4 py-3.5 text-sm text-[var(--sams-muted)]">{dateTime(teacher.last_seen_at)}</td>
                      <td className="px-4 py-3.5"><Badge variant={isActive(teacher.is_active) ? 'success' : 'neutral'}>{isActive(teacher.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></td>
                    </tr>
                  )
                })}
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {filteredTeachers.map((teacher) => {
                const online = isOnline(teacher)
                return (
                  <article key={teacher.id} className="sams-card space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <PresenceDot online={online} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--sams-brand-navy)]">{teacher.full_name}</p>
                            <p className="mt-0.5 truncate text-xs text-[var(--sams-muted)]">@{teacher.username}</p>
                          </div>
                          <Badge variant={online ? 'success' : 'neutral'}>{online ? t(TRANSLATION_KEYS.admin.online) : t(TRANSLATION_KEYS.admin.offline)}</Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--sams-muted)]">
                          <span>{t(TRANSLATION_KEYS.admin.employeeId)}: {teacher.employee_id ?? '—'}</span>
                          <span>{t(TRANSLATION_KEYS.admin.lastSeen)}: {dateTime(teacher.last_seen_at)}</span>
                        </div>
                        <div className="mt-2"><Badge variant={isActive(teacher.is_active) ? 'success' : 'neutral'}>{isActive(teacher.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.teachingAssignments)}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{t(TRANSLATION_KEYS.admin.assignTeaching)}</h2>
          </div>
        </div>

        <div className="sams-card space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <FormField label={t(TRANSLATION_KEYS.admin.teacher)}>
              {({ id, ...aria }) => (
                <Select id={id} {...aria} value={selectedTeacherId} onChange={(event) => setSelectedTeacherId(event.target.value)}>
                  <option value="">{t(TRANSLATION_KEYS.admin.selectTeacher)}</option>
                  {activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.full_name} · @{teacher.username}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.subject)}>
              {({ id, ...aria }) => (
                <Select id={id} {...aria} value={selectedSubjectId} onChange={(event) => setSelectedSubjectId(event.target.value)}>
                  <option value="">{t(TRANSLATION_KEYS.admin.selectSubject)}</option>
                  {activeSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} · {subjectLabel(subject, locale)}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label={t(TRANSLATION_KEYS.admin.className)}>
              {({ id, ...aria }) => (
                <Select id={id} {...aria} value={selectedClassId} onChange={(event) => setSelectedClassId(event.target.value)}>
                  <option value="">{t(TRANSLATION_KEYS.admin.selectClass)}</option>
                  {assignableClasses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.academic_year_name}</option>)}
                </Select>
              )}
            </FormField>
          </div>
          <div className="flex justify-end">
            <Button type="button" disabled={busy || !selectedTeacherId || !selectedSubjectId || !selectedClassId} loading={busy} onClick={() => void assignTeaching()}>
              {t(TRANSLATION_KEYS.admin.assign)}
            </Button>
          </div>
        </div>

        {visibleTeachings.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.teachingAssignments)} description={t(TRANSLATION_KEYS.admin.noAssignments)} />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[var(--sams-brand-border)] bg-[var(--sams-surface)] md:block">
              <Table
                caption={t(TRANSLATION_KEYS.admin.teachingAssignments)}
                headers={[t(TRANSLATION_KEYS.admin.teacher), t(TRANSLATION_KEYS.admin.subject), t(TRANSLATION_KEYS.admin.className), t(TRANSLATION_KEYS.admin.academicYear), t(TRANSLATION_KEYS.admin.actions)]}
              >
                {visibleTeachings.map((teaching) => {
                  const teacher = teachers.find((item) => item.id === teaching.teacher_id)
                  const label = subjectLabel({ name_fr: teaching.subject_name_fr, name_ar: teaching.subject_name_ar, name_en: teaching.subject_name_en, code: teaching.subject_code }, locale)
                  return (
                    <tr key={teaching.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-[var(--sams-brand-navy)]">{teacher?.full_name ?? '—'}</p>
                        <p className="text-xs text-[var(--sams-muted)]">{teacher ? `@${teacher.username}` : ''}</p>
                      </td>
                      <td className="px-3 py-3"><span className="font-medium">{label}</span><span className="ms-2 text-xs text-[var(--sams-muted)]">{teaching.subject_code}</span></td>
                      <td className="px-3 py-3">{teaching.class_name}{teaching.class_level ? <span className="ms-1 text-xs text-[var(--sams-muted)]">{teaching.class_level}</span> : null}</td>
                      <td className="px-3 py-3">
                        <span>{teaching.academic_year_name}</span>
                        {!isCurrentTeaching(teaching) && (
                          <div className="mt-1">
                            <Badge variant="neutral">{t(TRANSLATION_KEYS.admin.inactive)}</Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3"><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setUnassignTarget(teaching)}>{t(TRANSLATION_KEYS.admin.unassign)}</Button></td>
                    </tr>
                  )
                })}
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {visibleTeachings.map((teaching) => {
                const teacher = teachers.find((item) => item.id === teaching.teacher_id)
                const label = subjectLabel({ name_fr: teaching.subject_name_fr, name_ar: teaching.subject_name_ar, name_en: teaching.subject_name_en, code: teaching.subject_code }, locale)
                return (
                  <article key={teaching.id} className="sams-card space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--sams-brand-navy)]">{teacher?.full_name ?? '—'}</p>
                        <p className="mt-0.5 text-xs text-[var(--sams-muted)]">{label} · {teaching.subject_code}</p>
                      </div>
                      <Badge variant="neutral">{teaching.class_name}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--sams-muted)]">
                      <span>{teaching.academic_year_name}</span>
                      {!isCurrentTeaching(teaching) && (
                        <Badge variant="neutral">{t(TRANSLATION_KEYS.admin.inactive)}</Badge>
                      )}
                    </div>
                    <div className="border-t border-[var(--sams-border)] pt-3">
                      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setUnassignTarget(teaching)}>{t(TRANSLATION_KEYS.admin.unassign)}</Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="sams-section-label">{t(TRANSLATION_KEYS.admin.subjects)}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--sams-brand-navy)]">{t(TRANSLATION_KEYS.admin.subjects)}</h2>
          </div>
          <Button type="button" onClick={openCreateSubject}>{t(TRANSLATION_KEYS.admin.createSubject)}</Button>
        </div>
        {resource.data.subjects.length === 0 ? (
          <EmptyState title={t(TRANSLATION_KEYS.admin.subjects)} description={t(TRANSLATION_KEYS.admin.noMatchingResults)} />
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[var(--sams-brand-border)] bg-[var(--sams-surface)] md:block">
              <Table caption={t(TRANSLATION_KEYS.admin.subjects)} headers={[t(TRANSLATION_KEYS.admin.subjectCode), t(TRANSLATION_KEYS.admin.subjectName), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.actions)]}>
                {resource.data.subjects.map((subject) => (
                  <tr key={subject.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                    <td className="px-3 py-3 font-mono text-sm">{subject.code}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[var(--sams-brand-navy)]">{subjectLabel(subject, locale)}</p>
                      <p className="mt-0.5 text-xs text-[var(--sams-muted)]">{subject.name_fr} / {subject.name_ar} / {subject.name_en}</p>
                    </td>
                    <td className="px-3 py-3"><Badge variant={isActive(subject.is_active) ? 'success' : 'neutral'}>{isActive(subject.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge></td>
                    <td className="px-3 py-3"><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => openEditSubject(subject)}>{t(TRANSLATION_KEYS.admin.edit)}</Button></td>
                  </tr>
                ))}
              </Table>
            </div>
            <div className="space-y-2 md:hidden">
              {resource.data.subjects.map((subject) => (
                <article key={subject.id} className="sams-card space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--sams-brand-navy)]">{subjectLabel(subject, locale)}</p>
                      <p className="mt-0.5 font-mono text-xs text-[var(--sams-muted)]">{subject.code}</p>
                    </div>
                    <Badge variant={isActive(subject.is_active) ? 'success' : 'neutral'}>{isActive(subject.is_active) ? t(TRANSLATION_KEYS.admin.active) : t(TRANSLATION_KEYS.admin.inactive)}</Badge>
                  </div>
                  <p className="text-xs text-[var(--sams-muted)]">{subject.name_fr} / {subject.name_ar} / {subject.name_en}</p>
                  <div className="border-t border-[var(--sams-border)] pt-3">
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => openEditSubject(subject)}>{t(TRANSLATION_KEYS.admin.edit)}</Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      <Dialog open={subjectDialogOpen} title={editingSubject ? t(TRANSLATION_KEYS.admin.editSubject) : t(TRANSLATION_KEYS.admin.createSubject)} closeLabel={t(TRANSLATION_KEYS.admin.cancel)} onClose={() => { if (!busy) setSubjectDialogOpen(false) }}>
        <div className="space-y-4">
          {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}
          <FormField label={t(TRANSLATION_KEYS.admin.subjectCode)}>
            {({ id, ...aria }) => <Input id={id} {...aria} value={subjectForm.code} onChange={(event) => setSubjectForm((current) => ({ ...current, code: event.target.value }))} maxLength={24} />}
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label={`${t(TRANSLATION_KEYS.admin.subjectName)} · FR`}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={subjectForm.name_fr} onChange={(event) => setSubjectForm((current) => ({ ...current, name_fr: event.target.value }))} maxLength={120} />}
            </FormField>
            <FormField label={`${t(TRANSLATION_KEYS.admin.subjectName)} · AR`}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={subjectForm.name_ar} onChange={(event) => setSubjectForm((current) => ({ ...current, name_ar: event.target.value }))} maxLength={120} dir="rtl" />}
            </FormField>
            <FormField label={`${t(TRANSLATION_KEYS.admin.subjectName)} · EN`}>
              {({ id, ...aria }) => <Input id={id} {...aria} value={subjectForm.name_en} onChange={(event) => setSubjectForm((current) => ({ ...current, name_en: event.target.value }))} maxLength={120} />}
            </FormField>
          </div>
          {editingSubject && (
            <label className="flex items-center gap-2 text-sm text-[var(--sams-text)]">
              <input type="checkbox" checked={subjectForm.is_active} onChange={(event) => setSubjectForm((current) => ({ ...current, is_active: event.target.checked }))} className="size-4 accent-[var(--sams-brand-primary)]" />
              {t(TRANSLATION_KEYS.admin.active)}
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => setSubjectDialogOpen(false)}>{t(TRANSLATION_KEYS.admin.cancel)}</Button>
            <Button type="button" disabled={busy || !subjectForm.code.trim() || !subjectForm.name_fr.trim() || !subjectForm.name_ar.trim() || !subjectForm.name_en.trim()} loading={busy} onClick={() => void saveSubject()}>{t(TRANSLATION_KEYS.admin.save)}</Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={unassignTarget !== null}
        title={t(TRANSLATION_KEYS.admin.confirmUnassign)}
        description={unassignTarget ? `${unassignTarget.subject_code} · ${unassignTarget.class_name}` : ''}
        cancelLabel={t(TRANSLATION_KEYS.admin.cancel)}
        confirmLabel={t(TRANSLATION_KEYS.admin.unassign)}
        destructive
        busy={busy}
        onCancel={() => { if (!busy) setUnassignTarget(null) }}
        onConfirm={() => unassignTeaching()}
      />
    </section>
  )
}

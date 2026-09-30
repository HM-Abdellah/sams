import { Dialog, Badge, Button } from '../../components/ui/index.ts'
import type { TeacherClass } from '../classes/types.ts'
import type { Student } from './types.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../i18n/types.ts'

interface Props {
  open: boolean
  student: Student | null
  classInfo: TeacherClass | null
  onClose: () => void
  onEdit: () => void
}

function valueOrDash(value: string | null) {
  return value && value.trim() !== '' ? value : '—'
}

export function StudentDetailsDialog({
  open,
  student,
  classInfo,
  onClose,
  onEdit,
}: Props) {
  const { t, formatDate } = useI18n()

  if (student === null) return null

  return (
    <Dialog
      open={open}
      title={t(TRANSLATION_KEYS.teacher.studentDetails)}
      description={student.first_name + ' ' + student.last_name}
      closeLabel={t(TRANSLATION_KEYS.teacher.close)}
      onClose={onClose}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Detail label={t(TRANSLATION_KEYS.teacher.firstName)} value={student.first_name} />
          <Detail label={t(TRANSLATION_KEYS.teacher.lastName)} value={student.last_name} />
          <Detail label={t(TRANSLATION_KEYS.teacher.studentNumber)} value={valueOrDash(student.student_number)} />
          <Detail label={t(TRANSLATION_KEYS.teacher.massarCode)} value={valueOrDash(student.massar_code)} />
          <Detail
            label={t(TRANSLATION_KEYS.teacher.birthDate)}
            value={student.birth_date ? formatDate(student.birth_date) : '—'}
          />
          <div>
            <p className="text-xs font-medium text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.teacher.studentStatus)}</p>
            <div className="mt-1">
              <Badge variant={student.status === 'active' ? 'success' : 'neutral'}>
                {student.status === 'active'
                  ? t(TRANSLATION_KEYS.teacher.active)
                  : t(TRANSLATION_KEYS.teacher.inactive)}
              </Badge>
            </div>
          </div>
        </div>

        <section className="rounded-md border border-[var(--sams-border)] p-4">
          <h3 className="font-semibold">{t(TRANSLATION_KEYS.teacher.enrollmentContext)}</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <Detail label={t(TRANSLATION_KEYS.teacher.currentClass)} value={classInfo?.name ?? '—'} />
            <Detail label={t(TRANSLATION_KEYS.teacher.academicYear)} value={classInfo?.academic_year_name ?? '—'} />
            <Detail label={t(TRANSLATION_KEYS.teacher.classLevel)} value={valueOrDash(classInfo?.level ?? null)} />
            <Detail label={t(TRANSLATION_KEYS.teacher.classBranch)} value={valueOrDash(classInfo?.branch ?? null)} />
            <Detail
              label={t(TRANSLATION_KEYS.teacher.academicYearRange)}
              value={classInfo?.academic_year_starts_on && classInfo.academic_year_ends_on
                ? formatDate(classInfo.academic_year_starts_on) + ' → ' + formatDate(classInfo.academic_year_ends_on)
                : '—'}
            />
          </dl>
          <p className="mt-3 text-sm text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.teacher.historicalEnrollmentHint)}
          </p>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t(TRANSLATION_KEYS.teacher.close)}</Button>
          <Button type="button" onClick={onEdit}>{t(TRANSLATION_KEYS.teacher.editStudent)}</Button>
        </div>
      </div>
    </Dialog>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--sams-muted)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--sams-text)]">{value}</dd>
    </div>
  )
}

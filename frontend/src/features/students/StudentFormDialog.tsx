import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, Button, FormField, Input } from '../../components/ui/index.ts'
import type { Student, StudentMutationInput } from './types.ts'
import { useI18n } from '../i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../i18n/types.ts'

interface Props {
  open: boolean
  mode: 'create' | 'edit'
  student: Student | null
  saving: boolean
  error: string | null
  onClose: () => void
  onSubmit: (input: StudentMutationInput) => Promise<boolean>
}

function nullable(value: string) {
  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

export function StudentFormDialog({
  open,
  mode,
  student,
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const { t } = useI18n()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [massarCode, setMassarCode] = useState('')
  const [birthDate, setBirthDate] = useState('')

  useEffect(() => {
    if (!open) return
    setFirstName(student?.first_name ?? '')
    setLastName(student?.last_name ?? '')
    setStudentNumber(student?.student_number ?? '')
    setMassarCode(student?.massar_code ?? '')
    setBirthDate(student?.birth_date ?? '')
  }, [open, student])

  const title = mode === 'create'
    ? t(TRANSLATION_KEYS.teacher.addStudent)
    : t(TRANSLATION_KEYS.teacher.editStudent)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const saved = await onSubmit({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      student_number: nullable(studentNumber),
      massar_code: nullable(massarCode),
      birth_date: nullable(birthDate),
    })
    if (saved) onClose()
  }

  return (
    <Dialog
      open={open}
      title={title}
      description={t(TRANSLATION_KEYS.teacher.studentFormHint)}
      closeLabel={t(TRANSLATION_KEYS.teacher.cancel)}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={submit}>
        {error && <p role="alert" className="rounded-md border border-[var(--sams-danger)] bg-[var(--sams-danger-surface)] p-3 text-sm">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t(TRANSLATION_KEYS.teacher.firstName)}>
            {({ id, ...aria }) => <Input id={id} {...aria} required maxLength={80} value={firstName} onChange={(event) => setFirstName(event.target.value)} />}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.teacher.lastName)}>
            {({ id, ...aria }) => <Input id={id} {...aria} required maxLength={80} value={lastName} onChange={(event) => setLastName(event.target.value)} />}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.teacher.studentNumber)}>
            {({ id, ...aria }) => <Input id={id} {...aria} maxLength={30} value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} />}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.teacher.massarCode)}>
            {({ id, ...aria }) => <Input id={id} {...aria} maxLength={32} value={massarCode} onChange={(event) => setMassarCode(event.target.value)} />}
          </FormField>
          <FormField label={t(TRANSLATION_KEYS.teacher.birthDate)}>
            {({ id, ...aria }) => <Input id={id} {...aria} type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />}
          </FormField>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t(TRANSLATION_KEYS.teacher.cancel)}
          </Button>
          <Button type="submit" loading={saving}>
            {t(TRANSLATION_KEYS.teacher.saveStudent)}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

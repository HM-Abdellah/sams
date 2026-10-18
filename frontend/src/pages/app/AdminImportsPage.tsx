import { useCallback, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { asNumber, isActive } from '../../features/admin/helpers.ts'
import type { ImportRow } from '../../features/admin/types.ts'
import { TRANSLATION_KEYS, type TranslationKey } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  StatusMessage,
  Table,
} from '../../components/ui/index.ts'

type WorkflowAction = 'reconcile' | 'commit'
type StepState = 'done' | 'current' | 'locked'

const STATUS_KEYS: Record<string, TranslationKey> = {
  staged: TRANSLATION_KEYS.admin.importStatusStaged,
  validated: TRANSLATION_KEYS.admin.importStatusValidated,
  imported: TRANSLATION_KEYS.admin.importStatusImported,
  valid: TRANSLATION_KEYS.admin.importStatusValid,
  warning: TRANSLATION_KEYS.admin.importStatusWarning,
  mapped: TRANSLATION_KEYS.admin.importStatusMapped,
  error: TRANSLATION_KEYS.admin.importStatusError,
  matched: TRANSLATION_KEYS.admin.importStatusMatched,
}

const ISSUE_KEYS: Record<string, TranslationKey> = {
  missing_class_name: TRANSLATION_KEYS.admin.importIssueMissingClassName,
  missing_academic_year: TRANSLATION_KEYS.admin.importIssueMissingAcademicYear,
  missing_first_name: TRANSLATION_KEYS.admin.importIssueMissingFirstName,
  missing_last_name: TRANSLATION_KEYS.admin.importIssueMissingLastName,
  missing_massar_code: TRANSLATION_KEYS.admin.importIssueMissingMassar,
  duplicate_class_in_workbook: TRANSLATION_KEYS.admin.importIssueDuplicateClass,
  duplicate_massar_code_in_workbook: TRANSLATION_KEYS.admin.importIssueDuplicateMassar,
  duplicate_roster_number_in_class: TRANSLATION_KEYS.admin.importIssueDuplicateRoster,
  multiple_academic_years: TRANSLATION_KEYS.admin.importIssueMultipleAcademicYears,
  no_class_blocks_detected: TRANSLATION_KEYS.admin.importIssueNoClasses,
  target_class_not_found: TRANSLATION_KEYS.admin.importIssueTargetClassMissing,
  student_reconciliation_conflict: TRANSLATION_KEYS.admin.importIssueStudentConflict,
  student_enrollment_conflict: TRANSLATION_KEYS.admin.importIssueEnrollmentConflict,
  multiple_enrollments_in_target_academic_year: TRANSLATION_KEYS.admin.importIssueMultipleEnrollments,
  identity_conflict_first_name: TRANSLATION_KEYS.admin.importIssueIdentityFirstName,
  identity_conflict_last_name: TRANSLATION_KEYS.admin.importIssueIdentityLastName,
  identity_conflict_birth_date: TRANSLATION_KEYS.admin.importIssueIdentityBirthDate,
  student_massar_owned_by_another_school: TRANSLATION_KEYS.admin.importIssueForeignMassar,
  target_class_changed_since_reconciliation: TRANSLATION_KEYS.admin.importIssueTargetClassChanged,
  student_data_changed_since_reconciliation: TRANSLATION_KEYS.admin.importIssueStudentChanged,
  staged_row_not_validated: TRANSLATION_KEYS.admin.importIssueNotValidated,
  target_academic_year_required: TRANSLATION_KEYS.admin.importIssueTargetYearRequired,
}

const statusText = (status: string, t: (key: TranslationKey) => string) =>
  t(STATUS_KEYS[status] ?? TRANSLATION_KEYS.admin.importIssueGeneric)

const issueText = (issue: unknown, t: (key: TranslationKey) => string) =>
  t(ISSUE_KEYS[String(issue)] ?? TRANSLATION_KEYS.admin.importIssueGeneric)

const statusVariant = (status: string) => {
  if (status === 'error' || status === 'conflict') return 'danger' as const
  if (status === 'warning') return 'warning' as const
  if (status === 'mapped' || status === 'matched' || status === 'imported' || status === 'valid') return 'success' as const
  return 'neutral' as const
}

const matchText = (row: ImportRow, t: (key: TranslationKey) => string) => {
  if (row.status === 'imported') return t(TRANSLATION_KEYS.admin.importStatusImported)
  if (row.match_status === 'new') return t(TRANSLATION_KEYS.admin.importNewStudent)
  if (row.match_status === 'existing') return t(TRANSLATION_KEYS.admin.importExistingStudent)
  if (row.match_status === 'conflict') return t(TRANSLATION_KEYS.admin.importConflict)
  return t(TRANSLATION_KEYS.admin.importNotChecked)
}

export function AdminImportsPage() {
  const { t } = useI18n()
  const yearsLoad = useCallback(() => adminApi.academicYears(), [])
  const years = useAdminResource(yearsLoad)
  const [file, setFile] = useState<File | null>(null)
  const [yearId, setYearId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof adminApi.importPreview>> | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null)
  const [readyToImport, setReadyToImport] = useState(false)
  const [confirmKind, setConfirmKind] = useState<WorkflowAction | null>(null)
  const [busy, setBusy] = useState<'upload' | WorkflowAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPreview = async (id: number, classId?: number, page = 1) => {
    setError(null)
    try {
      const result = await adminApi.importPreview(id, classId, page)
      setPreview(result)
      setPreviewId(id)
      setBatchId(String(id))
      setReadyToImport(false)
      setSelectedClassId(classId ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    }
  }
  const upload = async () => {
    if (!file) return
    setBusy('upload'); setError(null)
    try {
      const result = await adminApi.uploadSchoolImport(file, yearId ? Number(yearId) : undefined)
      await loadPreview(result.id)
      setFile(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setBusy(null) }
  }
  const loadClassRows = async (classId: number, page = 1) => {
    if (previewId === null) return
    setError(null)
    try {
      const result = await adminApi.importPreview(previewId, classId, page)
      setPreview(result)
      setSelectedClassId(classId)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    }
  }

  const requestWorkflow = (kind: WorkflowAction) => {
    if (previewId === null || preview?.batch.status === 'imported') return
    setConfirmKind(kind)
  }

  const executeWorkflow = async () => {
    if (previewId === null || confirmKind === null) return
    const kind = confirmKind
    setConfirmKind(null)
    setBusy(kind)
    setError(null)
    try {
      const result = kind === 'reconcile'
        ? await adminApi.reconcileImport(previewId)
        : await adminApi.commitImport(previewId)
      await loadPreview(previewId, selectedClassId ?? undefined)
      setReadyToImport(kind === 'reconcile' ? result.ready_to_import === true : false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setBusy(null)
    }
  }

  const canReconcile = preview !== null && preview.batch.status !== 'imported'
  const canCommit = preview !== null && preview.batch.status !== 'imported' && readyToImport

  if (years.status === 'idle' || years.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  if (years.status === 'error' || years.data === null) return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={years.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void years.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  const data = years.data
  const selectedClass = preview?.classes.find((item) => item.id === selectedClassId) ?? null

  const stepState = (step: 1 | 2 | 3 | 4): StepState => {
    if (preview === null) return step === 1 ? 'current' : 'locked'
    if (step === 1) return 'done'
    if (step === 2) return preview.batch.status === 'validated' || preview.batch.status === 'imported' ? 'done' : 'current'
    if (step === 3) return readyToImport || preview.batch.status === 'imported' ? 'done' : preview.batch.status === 'validated' ? 'current' : 'locked'
    return preview.batch.status === 'imported' ? 'done' : readyToImport ? 'current' : 'locked'
  }

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.imports)}
        description={t(TRANSLATION_KEYS.admin.importHint)}
      />
      {error && <StatusMessage variant="danger" role="alert">{error}</StatusMessage>}

      <ol aria-label={t(TRANSLATION_KEYS.admin.importBatch)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {([
          [1, TRANSLATION_KEYS.admin.importStepUpload],
          [2, TRANSLATION_KEYS.admin.importStepValidate],
          [3, TRANSLATION_KEYS.admin.importStepReconcile],
          [4, TRANSLATION_KEYS.admin.importStepCommit],
        ] as const).map(([step, key]) => {
          const state = stepState(step)
          return (
            <li key={step} className="sams-card flex items-start gap-3 p-4">
              <Badge variant={state === 'done' ? 'success' : state === 'current' ? 'info' : 'neutral'}>{step}</Badge>
              <p className="font-medium">{t(key)}</p>
            </li>
          )
        })}
      </ol>

      <section className="sams-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.stageImport)}</h2>
        <FormField label={t(TRANSLATION_KEYS.admin.targetAcademicYear)}>
          {({ id, ...aria }) => <Select id={id} {...aria} value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="">{t(TRANSLATION_KEYS.admin.selectAcademicYear)}</option>
            {data.academic_years.map((x) => <option key={x.id} value={x.id}>{x.name}{isActive(x.is_active) ? ' · active' : ''}</option>)}
          </Select>}
        </FormField>
        <input aria-label={t(TRANSLATION_KEYS.admin.importFile)} type="file" accept=".xlsx,.xls,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button type="button" disabled={!file || busy !== null} loading={busy === 'upload'} onClick={() => void upload()}>{t(TRANSLATION_KEYS.admin.upload)}</Button>
      </section>

      <section className="sams-card p-5 space-y-4">
        <h2 className="text-lg font-semibold">{t(TRANSLATION_KEYS.admin.importBatch)}</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <FormField label={t(TRANSLATION_KEYS.admin.batchId)}>{({ id, ...aria }) => <Input id={id} {...aria} inputMode="numeric" value={batchId} onChange={(e) => setBatchId(e.target.value)} />}</FormField>
          <Button type="button" variant="secondary" disabled={!/^[1-9]\d*$/.test(batchId)} onClick={() => void loadPreview(Number(batchId))}>{t(TRANSLATION_KEYS.admin.loadBatch)}</Button>
        </div>
      </section>
      {preview && <section className="space-y-4">
        <div className="sams-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{preview.batch.original_filename}</h2>
              <p className="mt-1 text-sm text-[var(--sams-muted)]">
                {t(TRANSLATION_KEYS.admin.batchId)}: {preview.batch.id}
                {preview.batch.target_academic_year_name ? ' · ' + preview.batch.target_academic_year_name : ''}
              </p>
            </div>
            <Badge variant={statusVariant(preview.batch.status)}>{statusText(preview.batch.status, t)}</Badge>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Detail label={t(TRANSLATION_KEYS.navigation.classes)} value={String(asNumber(preview.batch.total_classes))} />
            <Detail label={t(TRANSLATION_KEYS.admin.rows)} value={String(asNumber(preview.batch.total_rows))} />
            <Detail label={t(TRANSLATION_KEYS.admin.importWarnings)} value={String(asNumber(preview.batch.warning_rows) + asNumber(preview.batch.warning_classes))} />
            <Detail label={t(TRANSLATION_KEYS.admin.importErrors)} value={String(asNumber(preview.batch.error_rows) + asNumber(preview.batch.error_classes))} />
            <Detail label={t(TRANSLATION_KEYS.admin.targetAcademicYear)} value={preview.batch.target_academic_year_name ?? '—'} />
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StatusMessage
              variant={asNumber(preview.batch.error_rows) + asNumber(preview.batch.error_classes) > 0 ? 'warning' : 'success'}
              role="status"
              className="flex-1"
            >
              {asNumber(preview.batch.error_rows) + asNumber(preview.batch.error_classes) > 0
                ? t(TRANSLATION_KEYS.admin.importNeedsAttention)
                : readyToImport
                  ? t(TRANSLATION_KEYS.admin.importReady)
                  : t(TRANSLATION_KEYS.admin.importValidationSummary)}
            </StatusMessage>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={!canReconcile || busy !== null} loading={busy === 'reconcile'} onClick={() => requestWorkflow('reconcile')}>{t(TRANSLATION_KEYS.admin.reconcile)}</Button>
            <Button type="button" variant="secondary" disabled={!canCommit || busy !== null} loading={busy === 'commit'} onClick={() => requestWorkflow('commit')}>{t(TRANSLATION_KEYS.admin.commit)}</Button>
          </div>
        </div>
        {preview.classes.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.admin.classes)} /> : (
          <Table caption={t(TRANSLATION_KEYS.admin.importClasses)} headers={[t(TRANSLATION_KEYS.admin.sourceClass), t(TRANSLATION_KEYS.admin.students), t(TRANSLATION_KEYS.admin.status), t(TRANSLATION_KEYS.admin.importIssues)]}>
            {preview.classes.map((x) => {
              const issues = Array.isArray(x.issues) ? x.issues : []
              return (
                <tr key={x.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                  <td className="px-3 py-2 font-medium">{x.source_class_name}</td>
                  <td className="px-3 py-2">{asNumber(x.student_count)}</td>
                  <td className="px-3 py-2"><Badge variant={statusVariant(x.status)}>{statusText(x.status, t)}</Badge></td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={x.id === selectedClassId ? 'primary' : 'secondary'}
                      onClick={() => void loadClassRows(x.id)}
                    >
                      {issues.length > 0
                        ? issues.length + ' ' + t(TRANSLATION_KEYS.admin.importIssues)
                        : t(TRANSLATION_KEYS.admin.importSelectClassRows)}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
        {selectedClass && (
          <section className="sams-card p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedClass.source_class_name}</h2>
                <p className="mt-1 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.importSelectClassRows)}</p>
              </div>
              <Badge variant={statusVariant(selectedClass.status)}>{statusText(selectedClass.status, t)}</Badge>
            </div>
            {Array.isArray(selectedClass.issues) && selectedClass.issues.length > 0 ? (
              <div>
                <h3 className="font-medium">{t(TRANSLATION_KEYS.admin.importIssues)}</h3>
                <ul className="mt-2 space-y-1 text-sm text-[var(--sams-muted)]">
                  {selectedClass.issues.map((issue, index) => <li key={String(issue) + '-' + index}>• {issueText(issue, t)}</li>)}
                </ul>
              </div>
            ) : (
              <StatusMessage variant="success" role="status">{t(TRANSLATION_KEYS.admin.importNoIssues)}</StatusMessage>
            )}
            {preview.rows ? (
              <div className="space-y-4">
                <Table caption={t(TRANSLATION_KEYS.admin.importRows)} headers={[
                  t(TRANSLATION_KEYS.admin.importSourceRow),
                  t(TRANSLATION_KEYS.admin.name),
                  'Massar',
                  t(TRANSLATION_KEYS.admin.status),
                  t(TRANSLATION_KEYS.admin.importMatch),
                  t(TRANSLATION_KEYS.admin.importIssues),
                ]}>
                  {preview.rows.items.map((row) => {
                    const issues = Array.isArray(row.issues) ? row.issues : []
                    return (
                      <tr key={row.id} className="border-b border-[var(--sams-border)] last:border-b-0">
                        <td className="px-3 py-2">{asNumber(row.source_row)}</td>
                        <td className="px-3 py-2 font-medium">{row.first_name} {row.last_name}</td>
                        <td className="px-3 py-2">{row.massar_code ?? '—'}</td>
                        <td className="px-3 py-2"><Badge variant={statusVariant(row.status)}>{statusText(row.status, t)}</Badge></td>
                        <td className="px-3 py-2 text-sm">{matchText(row, t)}</td>
                        <td className="px-3 py-2">
                          {issues.length === 0 ? t(TRANSLATION_KEYS.admin.importNoIssues) : (
                            <ul className="space-y-1 text-xs text-[var(--sams-muted)]">
                              {issues.map((issue, index) => <li key={String(issue) + '-' + index}>{issueText(issue, t)}</li>)}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </Table>
                <Pagination
                  page={preview.rows.page}
                  pageCount={preview.rows.total_pages}
                  previousLabel={t(TRANSLATION_KEYS.admin.previous)}
                  nextLabel={t(TRANSLATION_KEYS.admin.next)}
                  ariaLabel={t(TRANSLATION_KEYS.admin.pagination)}
                  onPageChange={(page) => void loadClassRows(selectedClass.id, page)}
                />
              </div>
            ) : (
              <StatusMessage variant="info" role="status">{t(TRANSLATION_KEYS.admin.importSelectClassRows)}</StatusMessage>
            )}
          </section>
        )}
      </section>}

      <ConfirmDialog
        open={confirmKind !== null}
        title={confirmKind === 'commit'
          ? t(TRANSLATION_KEYS.admin.confirmCommit)
          : t(TRANSLATION_KEYS.admin.confirmReconcile)}
        description={confirmKind === 'commit'
          ? t(TRANSLATION_KEYS.admin.importConfirmCommitDescription)
          : t(TRANSLATION_KEYS.admin.importConfirmReconcileDescription)}
        cancelLabel={t(TRANSLATION_KEYS.admin.cancel)}
        confirmLabel={confirmKind === 'commit'
          ? t(TRANSLATION_KEYS.admin.commit)
          : t(TRANSLATION_KEYS.admin.reconcile)}
        busy={busy !== null}
        onCancel={() => setConfirmKind(null)}
        onConfirm={executeWorkflow}
      />
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-[var(--sams-muted)]">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>
}

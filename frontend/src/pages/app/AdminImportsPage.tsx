import { useCallback, useState } from 'react'
import { adminApi } from '../../features/admin/api.ts'
import { useAdminResource } from '../../features/admin/useAdminResource.ts'
import { isActive, asNumber } from '../../features/admin/helpers.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { Badge, Button, EmptyState, ErrorState, FormField, Input, Loading, PageHeader, Select, Table } from '../../components/ui/index.ts'

export function AdminImportsPage() {
  const { t } = useI18n()
  const yearsLoad = useCallback(() => adminApi.academicYears(), [])
  const years = useAdminResource(yearsLoad)
  const [file, setFile] = useState<File | null>(null)
  const [yearId, setYearId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof adminApi.importPreview>> | null>(null)
  const [busy, setBusy] = useState<'upload' | 'reconcile' | 'commit' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPreview = async (id: number) => {
    setError(null)
    try { const result = await adminApi.importPreview(id); setPreview(result); setPreviewId(id); setBatchId(String(id)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
  }
  const upload = async () => {
    if (!file) return
    setBusy('upload'); setError(null)
    try {
      const result = await adminApi.uploadSchoolImport(file, yearId ? Number(yearId) : undefined)
      setBatchId(String(result.id))
      await loadPreview(result.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setBusy(null) }
  }
  const canCommit = preview !== null && preview.classes.length > 0 && preview.classes.every((item) => item.status === 'mapped')

  const workflow = async (kind: 'reconcile' | 'commit') => {
    if (previewId === null) return
    if (!window.confirm((kind === 'commit' ? t(TRANSLATION_KEYS.admin.confirmCommit) : t(TRANSLATION_KEYS.admin.confirmReconcile)) + '?')) return
    setBusy(kind); setError(null)
    try { await (kind === 'reconcile' ? adminApi.reconcileImport(previewId) : adminApi.commitImport(previewId)); await loadPreview(previewId) }
    catch (cause) { setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setBusy(null) }
  }

  if (years.status === 'idle' || years.status === 'loading') return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  if (years.status === 'error' || years.data === null) return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={years.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void years.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  const data = years.data

  return (
    <section className="sams-admin-page space-y-8">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.imports)}
        description={t(TRANSLATION_KEYS.admin.importHint)}
      />
      {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}
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
            <div><h2 className="text-lg font-semibold">{preview.batch.original_filename}</h2><p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.admin.status)}: {preview.batch.status}</p></div>
            <Badge variant={preview.batch.status === 'imported' ? 'success' : preview.batch.error_rows && asNumber(preview.batch.error_rows) > 0 ? 'danger' : 'info'}>{preview.batch.status}</Badge>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Detail label={t(TRANSLATION_KEYS.navigation.classes)} value={String(asNumber(preview.batch.total_classes))} />
            <Detail label={t(TRANSLATION_KEYS.admin.rows)} value={String(asNumber(preview.batch.total_rows))} />
            <Detail label={t(TRANSLATION_KEYS.admin.targetAcademicYear)} value={preview.batch.target_academic_year_name ?? '—'} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" disabled={busy !== null || preview.batch.status === 'imported'} loading={busy === 'reconcile'} onClick={() => void workflow('reconcile')}>{t(TRANSLATION_KEYS.admin.reconcile)}</Button>
            <Button type="button" variant="secondary" disabled={busy !== null || preview.batch.status === 'imported' || !canCommit} loading={busy === 'commit'} onClick={() => void workflow('commit')}>{t(TRANSLATION_KEYS.admin.commit)}</Button>
          </div>
        </div>
        {preview.classes.length === 0 ? <EmptyState title={t(TRANSLATION_KEYS.admin.classes)} /> : (
          <Table caption={t(TRANSLATION_KEYS.admin.importClasses)} headers={[t(TRANSLATION_KEYS.admin.sourceClass), t(TRANSLATION_KEYS.admin.students), t(TRANSLATION_KEYS.admin.status)]}>
            {preview.classes.map((x) => <tr key={x.id} className="border-b border-[var(--sams-border)] last:border-b-0">
              <td className="px-3 py-2 font-medium">{x.source_class_name}</td><td className="px-3 py-2">{asNumber(x.student_count)}</td><td className="px-3 py-2"><Badge variant={x.status === 'error' ? 'danger' : x.status === 'mapped' ? 'success' : 'neutral'}>{x.status}</Badge></td>
            </tr>)}
          </Table>
        )}
        {preview.rows && <Table caption={t(TRANSLATION_KEYS.admin.importRows)} headers={[t(TRANSLATION_KEYS.admin.name), 'Massar', t(TRANSLATION_KEYS.admin.status)]}>
          {preview.rows.items.map((x) => <tr key={x.id} className="border-b border-[var(--sams-border)] last:border-b-0"><td className="px-3 py-2">{x.first_name} {x.last_name}</td><td className="px-3 py-2">{x.massar_code ?? '—'}</td><td className="px-3 py-2">{x.status}</td></tr>)}
        </Table>}
      </section>}
    </section>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-medium text-[var(--sams-muted)]">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>
}

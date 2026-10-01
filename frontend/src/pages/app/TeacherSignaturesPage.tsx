import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useTeacherClasses } from '../../features/classes/useTeacherClasses.ts'
import { signaturesApi } from '../../features/signatures/api.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { Badge, Button, EmptyState, ErrorState, FormField, Loading, PageHeader, Select } from '../../components/ui/index.ts'

const WIDTH = 720
const HEIGHT = 260

export function TeacherSignaturesPage() {
  const { t } = useI18n()
  const classes = useTeacherClasses()
  const [params, setParams] = useSearchParams()
  const [signature, setSignature] = useState<string | null>(null)
  const [loadingSignature, setLoadingSignature] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)

  const classId = Number(params.get('class_id') ?? 0) || null

  useEffect(() => {
    if (classId === null) {
      setSignature(null)
      setDirty(false)
      return
    }
    let cancelled = false
    setLoadingSignature(true)
    setError(null)
    void signaturesApi.get(classId)
      .then((result) => {
        if (cancelled) return
        setSignature(result.signature?.signature_data ?? null)
        setDirty(false)
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
      })
      .finally(() => {
        if (!cancelled) setLoadingSignature(false)
      })
    return () => { cancelled = true }
  }, [classId, t])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = WIDTH * ratio
    canvas.height = HEIGHT * ratio
    canvas.style.aspectRatio = WIDTH + ' / ' + HEIGHT
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    const styles = getComputedStyle(document.documentElement)
    const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
    context.lineWidth = 2.5
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = token('--sams-text', '#171717')
    context.fillStyle = token('--sams-surface', '#ffffff')
    context.fillRect(0, 0, WIDTH, HEIGHT)
    if (!signature) return
    const image = new Image()
    image.onload = () => context.drawImage(image, 0, 0, WIDTH, HEIGHT)
    image.src = signature
  }, [signature])

  const point = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
    }
  }

  const save = async () => {
    if (classId === null || !dirty || !canvasRef.current) return
    setSaving(true)
    setError(null)
    try {
      const result = await signaturesApi.save(classId, canvasRef.current.toDataURL('image/png'))
      setSignature(result.signature.signature_data)
      setDirty(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    if (classId === null || !signature) return
    setSaving(true)
    setError(null)
    try {
      await signaturesApi.delete(classId)
      setSignature(null)
      setDirty(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSaving(false)
    }
  }

  if (classes.status === 'idle' || classes.status === 'loading') {
    return <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
  }
  if (classes.status === 'error') {
    return <ErrorState title={t(TRANSLATION_KEYS.system.errorTitle)} description={classes.error ?? t(TRANSLATION_KEYS.system.genericError)} action={<Button type="button" variant="secondary" onClick={() => void classes.reload()}>{t(TRANSLATION_KEYS.system.reload)}</Button>} />
  }
  if (classes.classes.length === 0) {
    return <EmptyState title={t(TRANSLATION_KEYS.teacher.classes)} description={t(TRANSLATION_KEYS.teacher.noClasses)} />
  }

  return (
    <section className="space-y-5">
      <PageHeader
        title={t(TRANSLATION_KEYS.navigation.signatures)}
        description={t(TRANSLATION_KEYS.signature.hint)}
      />

      <FormField label={t(TRANSLATION_KEYS.teacher.selectClass)}>
        {({ id, ...aria }) => (
          <Select id={id} {...aria} value={classId ? String(classId) : ''} onChange={(event) => setParams(new URLSearchParams({ class_id: event.target.value }))}>
            <option value="">{t(TRANSLATION_KEYS.teacher.selectClass)}</option>
            {classes.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Select>
        )}
      </FormField>

      {classId === null ? (
        <EmptyState title={t(TRANSLATION_KEYS.teacher.selectClass)} />
      ) : loadingSignature ? (
        <Loading label={t(TRANSLATION_KEYS.auth.loading)} />
      ) : (
        <section className="sams-card space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{classes.classes.find((item) => item.id === classId)?.name ?? String(classId)}</h2>
            {signature && !dirty && <Badge variant="success">{t(TRANSLATION_KEYS.signature.saved)}</Badge>}
          </div>
          {error && <p role="alert" className="text-sm text-[var(--sams-danger)]">{error}</p>}
          <p className="text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.signature.hint)}</p>
          <canvas
            ref={canvasRef}
            aria-label={t(TRANSLATION_KEYS.signature.canvas)}
            className="block min-h-52 w-full touch-none rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)] shadow-inner"
            onPointerDown={(event) => {
              const current = point(event)
              if (!current) return
              drawingRef.current = true
              event.currentTarget.setPointerCapture(event.pointerId)
              const context = event.currentTarget.getContext('2d')
              if (!context) return
              context.beginPath()
              context.moveTo(current.x, current.y)
              setDirty(true)
            }}
            onPointerMove={(event) => {
              if (!drawingRef.current) return
              const current = point(event)
              if (!current) return
              const context = event.currentTarget.getContext('2d')
              context?.lineTo(current.x, current.y)
              context?.stroke()
            }}
            onPointerUp={() => { drawingRef.current = false }}
            onPointerCancel={() => { drawingRef.current = false }}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!dirty || saving} loading={saving} onClick={() => void save()}>{t(TRANSLATION_KEYS.signature.save)}</Button>
            <Button type="button" variant="secondary" disabled={!signature || saving || dirty} onClick={() => void clear()}>{t(TRANSLATION_KEYS.signature.clear)}</Button>
          </div>
        </section>
      )}
    </section>
  )
}

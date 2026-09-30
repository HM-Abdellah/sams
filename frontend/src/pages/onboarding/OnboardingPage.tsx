import { useState } from 'react'
import { useNavigate } from 'react-router'
import { onboardingApi } from '../../features/onboarding/api.ts'
import { ApiError } from '../../services/api/errors.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { Button, FormField, Input, LanguageSelect, StatusMessage } from '../../components/ui/index.ts'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [phone, setPhone] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setError(null); setSubmitting(true)
    try {
      const result = await onboardingApi.request({
        onboarding_code: code.trim(), full_name: fullName.trim(),
        ...(employeeId.trim() ? { employee_id: employeeId.trim() } : {}),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      })
      setToken(result.request_token)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally { setSubmitting(false) }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]">
      <section className="w-full max-w-md rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--sams-muted)]">SAMS</p><LanguageSelect />
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{t(TRANSLATION_KEYS.onboarding.title)}</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.onboarding.hint)}</p>
        {error && <div className="mt-4"><StatusMessage variant="danger">{error}</StatusMessage></div>}
        {token === null ? (
          <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
            <FormField label={t(TRANSLATION_KEYS.onboarding.code)}>{({ id, ...aria }) => <Input id={id} {...aria} value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" />}</FormField>
            <FormField label={t(TRANSLATION_KEYS.onboarding.fullName)}>{({ id, ...aria }) => <Input id={id} {...aria} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />}</FormField>
            <FormField label={t(TRANSLATION_KEYS.onboarding.employeeId)}>{({ id, ...aria }) => <Input id={id} {...aria} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} autoComplete="off" />}</FormField>
            <FormField label={t(TRANSLATION_KEYS.onboarding.phone)}>{({ id, ...aria }) => <Input id={id} {...aria} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />}</FormField>
            <Button type="submit" loading={submitting} className="w-full">{t(TRANSLATION_KEYS.onboarding.submitRequest)}</Button>
          </form>
        ) : (
          <div className="mt-6 space-y-4">
            <StatusMessage variant="success" title={t(TRANSLATION_KEYS.onboarding.requestSubmitted)}>{t(TRANSLATION_KEYS.onboarding.requestTokenHint)}</StatusMessage>
            <div className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-muted-surface)] p-4"><p className="text-sm font-medium">{t(TRANSLATION_KEYS.onboarding.requestToken)}</p><code className="mt-2 block break-all text-sm">{token}</code></div>
            <Button type="button" className="w-full" onClick={() => navigate('/onboarding/status', { state: { requestToken: token } })}>{t(TRANSLATION_KEYS.onboarding.checkStatus)}</Button>
          </div>
        )}
      </section>
    </main>
  )
}

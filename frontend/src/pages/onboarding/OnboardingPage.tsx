import { useState } from 'react'
import { useNavigate } from 'react-router'
import { onboardingApi } from '../../features/onboarding/api.ts'
import { ApiError } from '../../services/api/errors.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { Button, FormField, Input, StatusMessage } from '../../components/ui/index.ts'
import { AuthPublicShell } from '../../components/ui/AuthPublicShell.tsx'

export function OnboardingPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setError(null)
    setSubmitting(true)

    try {
      const result = await onboardingApi.request({
        onboarding_code: code.trim(),
        full_name: fullName.trim(),
        ...(employeeId.trim() ? { employee_id: employeeId.trim() } : {}),
      })
      setToken(result.request_token)
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPublicShell
      title={t(TRANSLATION_KEYS.onboarding.title)}
      description={t(TRANSLATION_KEYS.onboarding.hint)}
    >
      {error && <StatusMessage variant="danger">{error}</StatusMessage>}

      {token === null ? (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <FormField label={t(TRANSLATION_KEYS.onboarding.code)}>
            {({ id, ...aria }) => (
              <Input id={id} {...aria} value={code} onChange={(event) => setCode(event.target.value)} required autoComplete="off" />
            )}
          </FormField>

          <FormField label={t(TRANSLATION_KEYS.onboarding.fullName)}>
            {({ id, ...aria }) => (
              <Input id={id} {...aria} value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" />
            )}
          </FormField>

          <FormField label={t(TRANSLATION_KEYS.onboarding.employeeId)}>
            {({ id, ...aria }) => (
              <Input id={id} {...aria} value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} autoComplete="off" />
            )}
          </FormField>

          <Button type="submit" loading={submitting} className="w-full !bg-[#1477ad] !text-white shadow-[0_8px_18px_rgba(20,119,173,0.20)] hover:!bg-[#0d628f]">
            {t(TRANSLATION_KEYS.onboarding.submitRequest)}
          </Button>

          <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/login')}>
            {t(TRANSLATION_KEYS.onboarding.goToLogin)}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <StatusMessage variant="success" title={t(TRANSLATION_KEYS.onboarding.requestSubmitted)}>
            {t(TRANSLATION_KEYS.onboarding.requestTokenHint)}
          </StatusMessage>

          <div className="rounded-xl border border-[#c9e0eb] bg-[#f5fbff] p-4">
            <p className="text-sm font-medium text-[#17324d]">{t(TRANSLATION_KEYS.onboarding.requestToken)}</p>
            <code className="mt-2 block break-all text-sm text-[#24506d]">{token}</code>
          </div>

          <Button type="button" className="w-full !bg-[#1477ad] !text-white hover:!bg-[#0d628f]" onClick={() => navigate('/onboarding/status', { state: { requestToken: token } })}>
            {t(TRANSLATION_KEYS.onboarding.checkStatus)}
          </Button>
        </div>
      )}
    </AuthPublicShell>
  )
}


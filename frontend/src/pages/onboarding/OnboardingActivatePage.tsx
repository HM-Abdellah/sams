import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { onboardingApi, type OnboardingActivationData } from '../../features/onboarding/api.ts'
import { ApiError } from '../../services/api/errors.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { Button, FormField, Input, StatusMessage } from '../../components/ui/index.ts'
import { AuthPublicShell } from '../../components/ui/AuthPublicShell.tsx'

export function OnboardingActivatePage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<OnboardingActivationData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const stateToken = typeof location.state === 'object' && location.state !== null
    && 'requestToken' in location.state && typeof location.state.requestToken === 'string'
    ? location.state.requestToken.trim()
    : ''
  const queryToken = new URLSearchParams(location.search).get('request_token')?.trim() ?? ''
  const token = stateToken || queryToken

  useEffect(() => {
    if (queryToken !== '' && stateToken === '') {
      navigate('/onboarding/activate', { replace: true, state: { requestToken: queryToken } })
    }
  }, [navigate, queryToken, stateToken])

  const activate = async () => {
    if (token === '') return

    setError(null)
    setSubmitting(true)
    try {
      setResult(await onboardingApi.activate(token, password))
      setPassword('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPublicShell
      title={t(TRANSLATION_KEYS.onboarding.activateTitle)}
      description={t(TRANSLATION_KEYS.onboarding.activationHint)}
    >
      {token === '' && (
        <StatusMessage className="mb-6" variant="warning">
          {t(TRANSLATION_KEYS.onboarding.missingToken)}
        </StatusMessage>
      )}

      {error && (
        <div className="mb-6">
          <StatusMessage variant="danger">{error}</StatusMessage>
        </div>
      )}

      {result === null && token !== '' ? (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void activate() }}>
          <FormField label={t(TRANSLATION_KEYS.onboarding.activationPassword)}>
            {({ id, ...aria }) => (
              <Input id={id} {...aria} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={255} autoComplete="new-password" required />
            )}
          </FormField>

          <Button type="submit" loading={submitting} className="w-full !bg-[#1477ad] !text-white shadow-[0_8px_18px_rgba(20,119,173,0.20)] hover:!bg-[#0d628f]">
            {t(TRANSLATION_KEYS.onboarding.activate)}
          </Button>
        </form>
      ) : result !== null ? (
        <div className="space-y-4">
          <StatusMessage variant="success" title={t(TRANSLATION_KEYS.onboarding.activatedTitle)}>
            {t(TRANSLATION_KEYS.onboarding.requestSubmitted)}
          </StatusMessage>

          <div className="rounded-xl border border-[#c9e0eb] bg-[#f5fbff] p-4">
            <p className="text-sm text-[#17324d]">{t(TRANSLATION_KEYS.onboarding.samsCodeIssued)}</p>
            <code className="mt-2 block text-xl font-semibold text-[#1477ad]">{result.sams_code}</code>
            <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.onboarding.requestTokenHint)}</p>
          </div>

          <Button type="button" className="w-full !bg-[#1477ad] !text-white hover:!bg-[#0d628f]" onClick={() => navigate('/login')}>
            {t(TRANSLATION_KEYS.onboarding.goToLogin)}
          </Button>
        </div>
      ) : null}

      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => navigate('/onboarding/status', { state: token ? { requestToken: token } : undefined })}>
        {t(TRANSLATION_KEYS.onboarding.statusTitle)}
      </Button>
    </AuthPublicShell>
  )
}


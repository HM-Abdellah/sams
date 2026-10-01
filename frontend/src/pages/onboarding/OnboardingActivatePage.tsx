import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { onboardingApi, type OnboardingActivationData } from '../../features/onboarding/api.ts'
import { ApiError } from '../../services/api/errors.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { Button, FormField, Input, LanguageSelect, StatusMessage } from '../../components/ui/index.ts'

export function OnboardingActivatePage() {
  const location = useLocation(); const navigate = useNavigate(); const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<OnboardingActivationData | null>(null)
  const [error, setError] = useState<string | null>(null); const [submitting, setSubmitting] = useState(false)
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
    setError(null); setSubmitting(true)
    try {
      setResult(await onboardingApi.activate(token, password))
      setPassword('')
    }
    catch (cause) { setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setSubmitting(false) }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]"><section className="w-full max-w-md rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-[var(--sams-muted)]">SAMS</p><LanguageSelect /></div>
      <h1 className="mt-1 text-2xl font-semibold">{t(TRANSLATION_KEYS.onboarding.activateTitle)}</h1>
      <p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.onboarding.activationHint)}</p>
      {token === '' && <StatusMessage className="mt-6" variant="warning">{t(TRANSLATION_KEYS.onboarding.missingToken)}</StatusMessage>}
      {error && <div className="mt-6"><StatusMessage variant="danger">{error}</StatusMessage></div>}
      {result === null && token !== '' ? (
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void activate() }}>
          <FormField label={t(TRANSLATION_KEYS.onboarding.activationPassword)}>{({ id, ...aria }) => <Input id={id} {...aria} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={10} maxLength={255} autoComplete="new-password" required />}</FormField>
          <Button type="submit" loading={submitting} className="w-full">{t(TRANSLATION_KEYS.onboarding.activate)}</Button>
        </form>
      ) : result !== null ? (
        <div className="mt-6 space-y-4">
          <StatusMessage variant="success" title={t(TRANSLATION_KEYS.onboarding.activatedTitle)}>{t(TRANSLATION_KEYS.onboarding.requestSubmitted)}</StatusMessage>
          <div className="rounded-lg border border-[var(--sams-border)] bg-[var(--sams-muted-surface)] p-4"><p className="text-sm">{t(TRANSLATION_KEYS.onboarding.samsCodeIssued)}</p><code className="mt-2 block text-xl font-semibold">{result.sams_code}</code><p className="mt-2 text-sm text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.onboarding.requestTokenHint)}</p></div>
          <Button type="button" className="w-full" onClick={() => navigate('/login')}>{t(TRANSLATION_KEYS.onboarding.goToLogin)}</Button>
        </div>
      ) : null}
      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => navigate('/onboarding/status', { state: token ? { requestToken: token } : undefined })}>{t(TRANSLATION_KEYS.onboarding.statusTitle)}</Button>
    </section></main>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { onboardingApi, type OnboardingStatusData } from '../../features/onboarding/api.ts'
import { ApiError } from '../../services/api/errors.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { Button, FormField, Input, LanguageSelect, Loading, StatusMessage } from '../../components/ui/index.ts'

const labels = {
  pending: TRANSLATION_KEYS.onboarding.pending,
  approved: TRANSLATION_KEYS.onboarding.approved,
  rejected: TRANSLATION_KEYS.onboarding.rejected,
  expired: TRANSLATION_KEYS.onboarding.expired,
} as const

const descriptions = {
  pending: TRANSLATION_KEYS.onboarding.requestSubmitted,
  approved: TRANSLATION_KEYS.onboarding.activationHint,
  rejected: TRANSLATION_KEYS.onboarding.rejected,
  expired: TRANSLATION_KEYS.onboarding.expired,
} as const

export function OnboardingStatusPage() {
  const location = useLocation(); const navigate = useNavigate(); const { t } = useI18n()
  const stateToken = typeof location.state === 'object' && location.state !== null
    && 'requestToken' in location.state && typeof location.state.requestToken === 'string'
    ? location.state.requestToken.trim()
    : ''
  const queryToken = new URLSearchParams(location.search).get('request_token')?.trim() ?? ''
  const initialToken = stateToken || queryToken
  const [token, setToken] = useState(initialToken)
  const [data, setData] = useState<OnboardingStatusData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(initialToken !== '')

  const load = useCallback(async (requestToken: string) => {
    setError(null); setLoading(true)
    try { setData(await onboardingApi.status(requestToken)) }
    catch (cause) { setData(null); setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.system.genericError)) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => { if (initialToken !== '') void load(initialToken) }, [initialToken, load])

  const updateToken = () => {
    const next = token.trim()
    if (next === '') return
    navigate('/onboarding/status', { replace: true, state: { requestToken: next } })
  }

  return (
    <main className="grid min-h-screen place-items-center p-6"><section className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm dark:bg-neutral-900">
      <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-neutral-500">SAMS</p><LanguageSelect /></div>
      <h1 className="mt-1 text-2xl font-semibold">{t(TRANSLATION_KEYS.onboarding.statusTitle)}</h1>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); updateToken() }}><div className="min-w-0 flex-1"><FormField label={t(TRANSLATION_KEYS.onboarding.requestToken)}>{({ id, ...aria }) => <Input id={id} {...aria} value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required />}</FormField></div><Button type="submit" className="mt-6">{t(TRANSLATION_KEYS.onboarding.checkStatus)}</Button></form>
      {initialToken === '' && <StatusMessage className="mt-4" variant="info">{t(TRANSLATION_KEYS.onboarding.missingToken)}</StatusMessage>}
      {loading && <div className="mt-6"><Loading label={t(TRANSLATION_KEYS.auth.loading)} /></div>}
      {error && <div className="mt-6"><StatusMessage variant="danger">{error}</StatusMessage></div>}
      {data && !loading && <div className="mt-6 space-y-4">
        <StatusMessage variant={data.status === 'approved' ? 'success' : data.status === 'pending' ? 'warning' : 'danger'} title={t(labels[data.status])}>{t(descriptions[data.status])}</StatusMessage>
        <p className="text-sm text-neutral-600 dark:text-neutral-300">{data.activated ? t(TRANSLATION_KEYS.onboarding.activated) : t(TRANSLATION_KEYS.onboarding.notActivated)}</p>
        {data.status === 'approved' && !data.activated && <Button type="button" className="w-full" onClick={() => navigate('/onboarding/activate', { state: { requestToken: token } })}>{t(TRANSLATION_KEYS.onboarding.activateTitle)}</Button>}
        {data.activated && <Button type="button" className="w-full" onClick={() => navigate('/login')}>{t(TRANSLATION_KEYS.onboarding.goToLogin)}</Button>}
        {data.status !== 'rejected' && data.status !== 'expired' && <Button type="button" variant="secondary" className="w-full" loading={loading} onClick={() => void load(token.trim())}>{t(TRANSLATION_KEYS.onboarding.refreshStatus)}</Button>}
      </div>}
      <Button type="button" variant="ghost" className="mt-4 w-full" onClick={() => navigate('/onboarding')}>{t(TRANSLATION_KEYS.onboarding.backToRequest)}</Button>
    </section></main>
  )
}

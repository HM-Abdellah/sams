import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../services/api/errors.ts'
import { useSession } from '../../features/auth/useSession.ts'
import { Button } from '../../components/ui/Button.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { LanguageSelect } from '../../components/ui/LanguageSelect.tsx'
import { StatusMessage } from '../../components/ui/Feedback.tsx'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'

export function LoginPage() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [samsCode, setSamsCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { t } = useI18n()

  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
    ? location.state.from
    : '/app'

  if (session.status === 'loading') {
    return <div className="grid min-h-screen place-items-center p-6">{t(TRANSLATION_KEYS.auth.loading)}</div>
  }

  if (session.status === 'authenticated') return null

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide text-neutral-500">SAMS</p>
          <LanguageSelect />
        </div>
        <h1 className="mt-1 text-2xl font-semibold">{t(TRANSLATION_KEYS.auth.signIn)}</h1>
        <p className="mt-2 text-sm text-neutral-600">{t(TRANSLATION_KEYS.auth.signInHint)}</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            setSubmitting(true)
            try {
              await session.login(samsCode, password)
              navigate(from, { replace: true })
            } catch (cause) {
              setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.auth.genericError))
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <label className="block text-sm font-medium">
            {t(TRANSLATION_KEYS.auth.samsCode)}
            <Input
              autoComplete="username"
              value={samsCode}
              onChange={(event) => setSamsCode(event.target.value)}
              className="mt-1"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            {t(TRANSLATION_KEYS.auth.password)}
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1"
              required
            />
          </label>
          {error !== null && (
            <StatusMessage variant="danger">{error}</StatusMessage>
          )}
          <Button
            type="submit"
            className="w-full"
            loading={submitting}
          >
            {t(TRANSLATION_KEYS.auth.signIn)}
          </Button>
        </form>
      </section>
    </main>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../../services/api/errors.ts'
import { AuthPublicShell } from '../../components/ui/AuthPublicShell.tsx'
import { Button } from '../../components/ui/Button.tsx'
import { Input } from '../../components/ui/Input.tsx'
import { StatusMessage } from '../../components/ui/Feedback.tsx'
import { Loading } from '../../components/ui/Loading.tsx'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'
import { setupApi } from '../../features/setup/api.ts'

export function SetupPage() {
  const { t } = useI18n()
  const [status, setStatus] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [completed, setCompleted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [setupKey, setSetupKey] = useState('')
  const [schoolCode, setSchoolCode] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    let cancelled = false

    void setupApi.status()
      .then((result) => {
        if (cancelled) return
        setStatus(result.available ? 'ready' : 'closed')
      })
      .catch((cause) => {
        if (cancelled) return
        setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.setup.loadFailed))
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [t])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmation) {
      setError(t(TRANSLATION_KEYS.setup.passwordMismatch))
      return
    }

    if (password.length < 10) {
      setError(t(TRANSLATION_KEYS.setup.passwordLength))
      return
    }

    setSubmitting(true)

    try {
      await setupApi.initialize({
        setupKey,
        schoolCode,
        schoolName,
        username,
        fullName,
        password,
      })
      setCompleted(true)
      setStatus('closed')
      setSetupKey('')
      setPassword('')
      setConfirmation('')
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.setup.genericError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthPublicShell
      title={t(TRANSLATION_KEYS.setup.title)}
      description={t(TRANSLATION_KEYS.setup.description)}
    >
      {completed ? (
        <div className="space-y-4">
          <StatusMessage title={t(TRANSLATION_KEYS.setup.completedTitle)} variant="success">
            <p>{t(TRANSLATION_KEYS.setup.completedDescription)}</p>
          </StatusMessage>

          <div className="rounded-xl border border-[var(--sams-border)] bg-[var(--sams-surface)] p-4 text-sm">
            <p className="font-semibold text-[var(--sams-text)]">{t(TRANSLATION_KEYS.setup.nextStepTitle)}</p>
            <p className="mt-1.5 leading-6 text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.setup.nextStepDescription)}</p>
          </div>

          <Link
            to="/login"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--sams-radius-control)] bg-[var(--sams-action)] px-4 text-sm font-medium text-[var(--sams-action-foreground)] shadow-sm transition-colors hover:bg-[var(--sams-action-hover)]"
          >
            {t(TRANSLATION_KEYS.setup.goToLogin)}
          </Link>
        </div>
      ) : status === 'loading' ? (
        <Loading label={t(TRANSLATION_KEYS.setup.loading)} />
      ) : status === 'error' ? (
        <StatusMessage title={t(TRANSLATION_KEYS.setup.unavailableTitle)} variant="danger">
          {error ?? t(TRANSLATION_KEYS.setup.loadFailed)}
        </StatusMessage>
      ) : status === 'closed' ? (
        <div className="space-y-4">
          <StatusMessage title={t(TRANSLATION_KEYS.setup.unavailableTitle)} variant="warning">
            <p>{t(TRANSLATION_KEYS.setup.unavailableDescription)}</p>
          </StatusMessage>
          <Link
            to="/login"
            className="inline-flex min-h-10 w-full items-center justify-center rounded-[var(--sams-radius-control)] border border-[var(--sams-border)] bg-[var(--sams-surface)] px-4 text-sm font-medium text-[var(--sams-text)] shadow-sm transition-colors hover:border-[var(--sams-action)]/30 hover:bg-[var(--sams-action-soft)]"
          >
            {t(TRANSLATION_KEYS.setup.goToLogin)}
          </Link>
        </div>
      ) : (
        <form className="max-h-[calc(100dvh-12rem)] space-y-3 overflow-y-auto pe-1 sm:space-y-4" onSubmit={submit}>
          {error && (
            <StatusMessage variant="danger" className="mb-1">
              {error}
            </StatusMessage>
          )}

          <div className="rounded-xl border border-[var(--sams-border)] bg-[var(--sams-muted-surface)] p-3.5 text-xs leading-5 text-[var(--sams-muted)]">
            <p className="font-semibold text-[var(--sams-text)]">{t(TRANSLATION_KEYS.setup.securityTitle)}</p>
            <p className="mt-1">{t(TRANSLATION_KEYS.setup.securityDescription)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="setup-key">{t(TRANSLATION_KEYS.setup.setupKey)}</label>
            <Input id="setup-key" type="password" autoComplete="off" value={setupKey} onChange={(event) => setSetupKey(event.target.value)} required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="school-code">{t(TRANSLATION_KEYS.setup.schoolCode)}</label>
              <Input id="school-code" value={schoolCode} onChange={(event) => setSchoolCode(event.target.value)} autoComplete="organization" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="school-name">{t(TRANSLATION_KEYS.setup.schoolName)}</label>
              <Input id="school-name" value={schoolName} onChange={(event) => setSchoolName(event.target.value)} autoComplete="organization-title" required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="setup-full-name">{t(TRANSLATION_KEYS.setup.fullName)}</label>
              <Input id="setup-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="setup-username">{t(TRANSLATION_KEYS.setup.username)}</label>
              <Input id="setup-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="setup-password">{t(TRANSLATION_KEYS.setup.password)}</label>
              <Input id="setup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--sams-text)]" htmlFor="setup-confirm-password">{t(TRANSLATION_KEYS.setup.confirmPassword)}</label>
              <Input id="setup-confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
            </div>
          </div>

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            {submitting ? t(TRANSLATION_KEYS.setup.creating) : t(TRANSLATION_KEYS.setup.createAdministrator)}
          </Button>

          <p className="text-center text-xs leading-5 text-[var(--sams-muted)]">
            {t(TRANSLATION_KEYS.setup.lockAfterCreation)}
          </p>
        </form>
      )}
    </AuthPublicShell>
  )
}


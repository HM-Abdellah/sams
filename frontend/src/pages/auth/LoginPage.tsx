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
import { safeReturnTo } from '../../routes/safeReturnTo.ts'

export function LoginPage() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [samsCode, setSamsCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { t } = useI18n()

  const from = safeReturnTo(location.state?.from)

  if (session.status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--sams-background)] p-6 text-[var(--sams-text)]">
        {t(TRANSLATION_KEYS.auth.loading)}
      </div>
    )
  }

  if (session.status === 'authenticated') return null

  return (
    <main className="min-h-screen bg-[var(--sams-background)] text-[var(--sams-text)]">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="relative hidden overflow-hidden bg-[var(--sams-action)] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-14">
          <div className="relative z-10">
            <div className="inline-flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-white text-sm font-bold text-[var(--sams-action)] shadow-sm">SA</div>
              <span className="text-sm font-semibold tracking-[0.16em]">SAMS</span>
            </div>
            <div className="mt-16 max-w-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white">{t(TRANSLATION_KEYS.auth.productName)}</p>
              <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em] xl:text-5xl">
                {t(TRANSLATION_KEYS.auth.tagline)}
              </h2>
              <p className="mt-5 max-w-lg text-base leading-7 text-white">
                {t(TRANSLATION_KEYS.auth.description)}
              </p>
            </div>
          </div>

          <div className="relative z-10 rounded-2xl border border-white/20 bg-white/12 p-4">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold text-white">
              <span>{t(TRANSLATION_KEYS.auth.registerPreview)}</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[var(--sams-action)]">{t(TRANSLATION_KEYS.auth.ready)}</span>
            </div>
            <div className="mt-4 grid grid-cols-[1.5fr_repeat(4,1fr)] overflow-hidden rounded-xl bg-white/95 text-[var(--sams-text)]">
              <div className="border-b border-e border-[var(--sams-border)] px-3 py-2 text-[11px] font-semibold text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.auth.student)}</div>
              {['08', '09', '10', '11'].map((item) => (
                <div key={item} className="border-b border-e last:border-e-0 border-[var(--sams-border)] px-2 py-2 text-center text-[11px] font-semibold text-[var(--sams-muted)]">
                  {item}
                </div>
              ))}
              {['Amal B.', 'Youssef A.', 'Sara M.'].map((student, rowIndex) => (
                <div key={student} className="contents">
                  <div className="border-e border-[var(--sams-border)] px-3 py-2 text-xs font-medium">{student}</div>
                  {[0, 1, 2, 3].map((cell) => (
                    <div
                      key={cell}
                      className={[
                        'border-e last:border-e-0 border-[var(--sams-border)] px-2 py-2 text-center text-xs font-bold',
                        rowIndex === 1 && cell === 2
                          ? 'bg-[var(--sams-danger-surface)] text-[var(--sams-danger)]'
                          : cell === 3
                            ? 'bg-[var(--sams-warning-surface)] text-[var(--sams-warning)]'
                            : 'bg-[var(--sams-success-surface)] text-[var(--sams-success)]',
                      ].join(' ')}
                    >
                      {rowIndex === 1 && cell === 2 ? 'A' : cell === 3 ? 'L' : '✓'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="pointer-events-none absolute -end-24 -top-24 size-72 rounded-full border-[48px] border-white/8" />
          <div className="pointer-events-none absolute -bottom-28 -start-20 size-80 rounded-full border-[56px] border-[var(--sams-brand-accent)]/25" />
        </aside>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="grid size-10 place-items-center rounded-xl bg-[var(--sams-action)] text-sm font-bold text-white">SA</div>
                <span className="text-sm font-semibold tracking-[0.12em]">SAMS</span>
              </div>
              <LanguageSelect />
            </div>

            <div className="mt-10">
              <p className="sams-section-label">{t(TRANSLATION_KEYS.auth.secureAccess)}</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{t(TRANSLATION_KEYS.auth.signIn)}</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--sams-muted)]">{t(TRANSLATION_KEYS.auth.signInHint)}</p>
            </div>

            <form
              className="mt-8 space-y-5"
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
                  className="mt-2"
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
                  className="mt-2"
                  required
                />
              </label>

              {error !== null && <StatusMessage variant="danger">{error}</StatusMessage>}

              <Button type="submit" size="lg" className="w-full" loading={submitting}>
                {t(TRANSLATION_KEYS.auth.signIn)}
              </Button>

              <p className="text-center text-xs leading-5 text-[var(--sams-muted)]">
                {t(TRANSLATION_KEYS.auth.secureHint)}
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

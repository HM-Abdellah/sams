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

function SamsMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={[
        'grid size-10 shrink-0 place-items-center rounded-xl shadow-sm',
        inverted ? 'bg-[#dffcff]' : 'bg-[#e2f3ff]',
      ].join(' ')}
    >
      <img
        src="./assets/brand/sams-logo.svg"
        alt=""
        className="size-6 object-contain"
      />
    </div>
  )
}

export function LoginPage() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const { t } = useI18n()

  const from = safeReturnTo(location.state?.from)

  if (session.status === 'loading') {
    return (
      <div className="grid h-[100dvh] place-items-center overflow-hidden bg-[#eef3f8] p-6 text-[var(--sams-text)]">
        {t(TRANSLATION_KEYS.auth.loading)}
      </div>
    )
  }

  if (session.status === 'authenticated') return null

  return (
    <main className="h-[100dvh] overflow-hidden overscroll-none bg-[#e8f4ff] text-[#17324d]">
      <div className="grid h-full lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="relative hidden min-h-0 overflow-hidden bg-[linear-gradient(145deg,#123b73_0%,#0c6f91_62%,#078786_100%)] px-10 py-9 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-11">
          <div className="relative z-10 flex items-center gap-3">
            <SamsMark inverted />
            <div>
              <p className="text-base font-semibold tracking-[0.1em]">SAMS</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
                {t(TRANSLATION_KEYS.auth.secureAccess)}
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fe6ee]">
              {t(TRANSLATION_KEYS.auth.productName)}
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
              {t(TRANSLATION_KEYS.auth.tagline)}
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-white/70">
              {t(TRANSLATION_KEYS.auth.description)}
            </p>

            <div className="mt-8 max-w-lg rounded-2xl border border-white/12 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold text-white/80">
                  {t(TRANSLATION_KEYS.auth.registerPreview)}
                </span>
                <span className="rounded-full border border-[#6fe6ee]/25 bg-[#6fe6ee]/10 px-2.5 py-1 text-[10px] font-semibold text-[#b8fbff]">
                  {t(TRANSLATION_KEYS.auth.ready)}
                </span>
              </div>

              <div aria-hidden="true" className="mt-4 overflow-hidden rounded-xl border border-[#a9d5e7] bg-[#f7fcff]">
                <div className="grid grid-cols-[1.5fr_repeat(4,1fr)] text-[10px] text-[#5b7690]">
                  <div className="border-b border-r border-[#c9e0eb] bg-[#e8f6fb] px-3 py-2 font-semibold text-[#24506d]">
                    {t(TRANSLATION_KEYS.auth.student)}
                  </div>
                  {['08', '09', '10', '11'].map((item) => (
                    <div key={item} className="border-b border-r last:border-r-0 border-[#c9e0eb] bg-[#e8f6fb] px-2 py-2 text-center font-semibold">
                      {item}
                    </div>
                  ))}
                  {['Amal B.', 'Youssef A.', 'Sara M.'].map((student, rowIndex) => (
                    <div key={student} className="contents">
                      <div className="border-r border-[#c9e0eb] px-3 py-2 text-[11px] font-medium text-[#23445e]">
                        {student}
                      </div>
                      {[0, 1, 2, 3].map((cell) => {
                        const absent = rowIndex === 1 && cell === 2
                        return (
                          <div
                            key={cell}
                            aria-label={absent ? 'Absence enregistrée' : 'Présence'}
                            className={[
                              'border-r last:border-r-0 px-2 py-2 text-center text-[12px] font-extrabold',
                              absent ? 'bg-[#fff0ef] text-[#d4473f]' : 'bg-[#f7fcff] text-transparent',
                            ].join(' ')}
                          >
                            {absent ? 'X' : ''}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-white/40">
            {t(TRANSLATION_KEYS.auth.secureHint)}
          </p>

          <div aria-hidden="true" className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full border-[40px] border-white/[0.06]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -start-16 size-80 rounded-full border-[54px] border-[#29c7d8]/10" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#29c7d8]/25" />
        </aside>

        <section className="flex h-full min-h-0 items-center justify-center overflow-hidden px-4 py-4 sm:px-6 lg:px-10">
          <div className="w-full max-w-md rounded-[1.5rem] border border-[#b9d8eb] bg-[#f7fbff] px-5 py-5 shadow-[0_20px_55px_rgba(22,73,112,0.12)] sm:px-7 sm:py-7 lg:border lg:px-8 lg:py-8 lg:shadow-[0_20px_55px_rgba(22,73,112,0.10)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 lg:hidden">
                <SamsMark />
                <div>
                  <p className="text-sm font-semibold tracking-[0.1em] text-[#0b1f33]">SAMS</p>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#6c7a89]">
                    {t(TRANSLATION_KEYS.auth.secureAccess)}
                  </p>
                </div>
              </div>
              <LanguageSelect />
            </div>

            <div className="mt-5 sm:mt-7">
              <p className="sams-section-label">{t(TRANSLATION_KEYS.auth.secureAccess)}</p>
              <h1 className="mt-1.5 text-[1.75rem] font-semibold tracking-[-0.035em] text-[#0b1f33] sm:text-3xl">
                {t(TRANSLATION_KEYS.auth.signIn)}
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-5 text-[var(--sams-muted)]">
                {t(TRANSLATION_KEYS.auth.signInHint)}
              </p>
            </div>

            <form
              className="mt-5 space-y-4 sm:mt-6"
              onSubmit={async (event) => {
                event.preventDefault()
                setError(null)
                setSubmitting(true)

                try {
                  await session.login(identifier, password)
                  navigate(from, { replace: true })
                } catch (cause) {
                  setError(cause instanceof ApiError ? cause.message : t(TRANSLATION_KEYS.auth.genericError))
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              <label className="block text-sm font-medium text-[#233244]">
                {t(TRANSLATION_KEYS.auth.loginIdentifier)}
                <Input
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="mt-1.5 border-[#b9d8eb] bg-[#ffffff] focus-visible:border-[#1687b5] focus-visible:ring-[#cceff6]"
                  required
                />
              </label>

              <label className="block text-sm font-medium text-[#233244]">
                {t(TRANSLATION_KEYS.auth.password)}
                <div className="relative mt-1.5">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="border-[#b9d8eb] bg-[#ffffff] pe-12 focus-visible:border-[#1687b5] focus-visible:ring-[#cceff6]"
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword
                      ? t(TRANSLATION_KEYS.auth.hidePassword)
                      : t(TRANSLATION_KEYS.auth.showPassword)}
                    title={showPassword
                      ? t(TRANSLATION_KEYS.auth.hidePassword)
                      : t(TRANSLATION_KEYS.auth.showPassword)}
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-e-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-lg text-[#64748b] transition-colors hover:bg-[#eef3f8] hover:text-[#0b1f33] focus-visible:outline-none"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
                      {showPassword ? (
                        <>
                          <path d="M3.5 12s3.2-5 8.5-5 8.5 5 8.5 5-3.2 5-8.5 5-8.5-5-8.5-5Z" />
                          <circle cx="12" cy="12" r="2.3" />
                        </>
                      ) : (
                        <>
                          <path d="M4 4l16 16" />
                          <path d="M6.2 6.3C4.5 7.5 3.4 9.1 2.8 10.3c-.2.4-.2.9 0 1.3C3.9 14 7.1 17 12 17c1.3 0 2.5-.2 3.5-.6" />
                          <path d="M9.6 7.3A9.7 9.7 0 0 1 12 7c4.9 0 8.1 3 9.2 5.4.2.4.2.9 0 1.3a11.4 11.4 0 0 1-1.4 2.1" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </label>

              {error !== null && <StatusMessage variant="danger">{error}</StatusMessage>}

              <Button type="submit" size="lg" className="w-full !bg-[#1477ad] !text-white shadow-[0_8px_18px_rgba(20,119,173,0.20)] hover:!bg-[#0d628f]" loading={submitting}>
                {t(TRANSLATION_KEYS.auth.signIn)}
              </Button>

              <div className="flex items-start gap-2 pt-0.5 text-xs leading-5 text-[var(--sams-muted)]">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-[#1d78a6]" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
                </svg>
                <p>{t(TRANSLATION_KEYS.auth.secureHint)}</p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  )
}

import type { ReactNode } from 'react'
import { LanguageSelect } from './LanguageSelect.tsx'
import { TRANSLATION_KEYS } from '../../features/i18n/types.ts'
import { useI18n } from '../../features/i18n/useI18n.ts'

function SamsMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={[
        'grid size-11 shrink-0 place-items-center rounded-[0.8rem] shadow-sm',
        inverted ? 'bg-[#dffcff]' : 'bg-[#e2f3ff]',
      ].join(' ')}
    >
      <img
        src={`${import.meta.env.BASE_URL}assets/brand/sams-logo.svg`}
        alt=""
        className="size-8 object-contain"
      />
    </div>
  )
}

interface AuthPublicShellProps {
  title: string
  description: string
  children: ReactNode
}

export function AuthPublicShell({ title, description, children }: AuthPublicShellProps) {
  const { t } = useI18n()

  return (
    <main className="h-[100dvh] overflow-hidden overscroll-none bg-[#eaf6ff] text-[#17324d]">
      <div className="grid h-full lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="relative hidden min-h-0 overflow-hidden bg-[linear-gradient(145deg,#123b73_0%,#0d668f_58%,#087f84_100%)] px-10 py-9 text-white lg:flex lg:flex-col lg:justify-between xl:px-14 xl:py-11">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-28 size-[30rem] rounded-full bg-[#67e9f9]/10 blur-3xl" />
          <div aria-hidden="true" className="sams-login-float pointer-events-none absolute end-20 top-28 size-16 rotate-12 rounded-2xl border border-white/10 bg-white/[0.04]" />

          <div className="relative z-10 flex items-center gap-3 sams-login-reveal">
            <SamsMark inverted />
            <div>
              <p className="text-base font-semibold tracking-[0.1em]">SAMS</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/55">
                {t(TRANSLATION_KEYS.auth.secureAccess)}
              </p>
            </div>
          </div>

          <div className="relative z-10 max-w-xl sams-login-reveal sams-login-reveal-delay-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fe6ee]">
              {t(TRANSLATION_KEYS.auth.productName)}
            </p>
            <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
              {t(TRANSLATION_KEYS.auth.tagline)}
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-white/70">
              {t(TRANSLATION_KEYS.auth.description)}
            </p>

            <div className="mt-8 max-w-lg rounded-[1.15rem] border border-white/12 bg-white/[0.065] p-4 shadow-[0_18px_45px_rgba(4,24,48,0.10)] backdrop-blur-sm sams-login-reveal sams-login-reveal-delay-2">
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
                  {[
                    TRANSLATION_KEYS.auth.studentAmal,
                    TRANSLATION_KEYS.auth.studentYoussef,
                    TRANSLATION_KEYS.auth.studentSara,
                  ].map((studentKey, rowIndex) => (
                    <div key={studentKey} className="contents">
                      <div className="border-r border-[#c9e0eb] px-3 py-2 text-[11px] font-medium text-[#23445e]">
                        {t(studentKey)}
                      </div>
                      {[0, 1, 2, 3].map((cell) => {
                        const absent = (rowIndex === 0 && cell === 1) || (rowIndex === 1 && cell === 2)
                        return (
                          <div
                            key={cell}
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

          <p className="relative z-10 text-xs text-white/40 sams-login-reveal sams-login-reveal-delay-2">
            {t(TRANSLATION_KEYS.auth.secureHint)}
          </p>
          <div aria-hidden="true" className="pointer-events-none absolute -end-20 -top-20 size-64 rounded-full border-[40px] border-white/[0.06]" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 -start-16 size-80 rounded-full border-[54px] border-[#29c7d8]/10" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[#29c7d8]/25" />
        </aside>

        <section className="relative flex h-full min-h-0 items-center justify-center overflow-hidden bg-[#edf6fb] px-0 py-0 lg:bg-[radial-gradient(circle_at_20%_18%,rgba(60,200,231,0.14),transparent_26%),radial-gradient(circle_at_92%_82%,rgba(29,78,216,0.08),transparent_30%)] lg:px-10">
          <div aria-hidden="true" className="pointer-events-none absolute -end-24 bottom-10 hidden size-64 rounded-full border-[36px] border-[#1687b5]/[0.05] lg:block" />

          <div className="sams-login-mobile-shell sams-auth-public-shell relative flex h-full w-full flex-col justify-center overflow-hidden bg-[#f8fcff] sams-login-reveal lg:h-auto lg:max-h-[calc(100dvh-2rem)] lg:w-full lg:max-w-md lg:rounded-[1.25rem] lg:border lg:border-[#b9d8eb] lg:bg-[#f8fcff]/95 lg:px-8 lg:py-8 lg:shadow-[0_24px_60px_rgba(22,73,112,0.11)] lg:backdrop-blur-sm">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1d4ed8_0%,#1687b5_52%,#29c7d8_100%)]" />

            <div className="sams-login-header flex items-center justify-between gap-3">
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

            <div className="sams-login-intro mt-4 sm:mt-7 sams-login-reveal sams-login-reveal-delay-1 lg:mt-7">
              <p className="sams-section-label">{t(TRANSLATION_KEYS.auth.secureAccess)}</p>
              <h1 className="sams-login-title mt-1.5 text-[1.75rem] font-semibold tracking-[-0.035em] text-[#0b1f33] sm:text-3xl">
                {title}
              </h1>
              <p className="sams-login-subtitle mt-2 max-w-sm text-sm leading-5 text-[var(--sams-muted)]">
                {description}
              </p>
            </div>

            <div className="sams-login-form sams-auth-public-form mt-4 sm:mt-6">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}


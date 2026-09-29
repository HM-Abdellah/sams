import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { LOCALE_DIRECTION, LOCALE_INTL, type Locale } from '../../features/i18n/types.ts'
import { translate } from '../../features/i18n/dictionary.ts'
import { I18nContext, type I18nContextValue } from '../../features/i18n/I18nContext.ts'

const DEFAULT_LOCALE: Locale = 'fr'

function browserLocale(): Locale {
  const language = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : ''
  return language === 'ar' || language === 'en' || language === 'fr' ? language : DEFAULT_LOCALE
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(browserLocale)

  useEffect(() => {
    const direction = LOCALE_DIRECTION[locale]
    document.documentElement.lang = locale
    document.documentElement.dir = direction
  }, [locale])

  const t = useCallback((key: Parameters<I18nContextValue['t']>[0]) => translate(locale, key), [locale])

  const formatDate = useCallback(
    (value: string | Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(LOCALE_INTL[locale], options).format(typeof value === 'string' ? new Date(value) : value),
    [locale],
  )

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(LOCALE_INTL[locale], options).format(value),
    [locale],
  )

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: LOCALE_DIRECTION[locale],
      setLocale,
      t,
      formatDate,
      formatNumber,
    }),
    [locale, t, formatDate, formatNumber],
  )

  return <I18nContext value={value}>{children}</I18nContext>
}

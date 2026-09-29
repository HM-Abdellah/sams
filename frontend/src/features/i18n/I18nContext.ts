import { createContext } from 'react'
import type { Locale } from './types.ts'

export interface I18nContextValue {
  locale: Locale
  direction: 'ltr' | 'rtl'
  setLocale: (locale: Locale) => void
  t: (key: import('./types.ts').TranslationKey) => string
  formatDate: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}

export const I18nContext = createContext<I18nContextValue | null>(null)

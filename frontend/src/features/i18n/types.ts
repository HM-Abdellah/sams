export const SUPPORTED_LOCALES = ['fr', 'ar', 'en'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]
export type Direction = 'ltr' | 'rtl'

export const LOCALE_DIRECTION: Record<Locale, Direction> = {
  fr: 'ltr',
  ar: 'rtl',
  en: 'ltr',
}

export const LOCALE_INTL: Record<Locale, string> = {
  fr: 'fr-MA',
  ar: 'ar-MA',
  en: 'en-GB',
}

export const TRANSLATION_KEYS = {
  app: {
    application: 'app.application',
    signOut: 'app.signOut',
    language: 'app.language',
    english: 'app.language.english',
    french: 'app.language.french',
    arabic: 'app.language.arabic',
  },
  auth: {
    signIn: 'auth.signIn',
    samsCode: 'auth.samsCode',
    password: 'auth.password',
    signInHint: 'auth.signInHint',
    signingIn: 'auth.signingIn',
    loading: 'auth.loading',
    genericError: 'auth.genericError',
  },
  navigation: {
    attendance: 'navigation.attendance',
    students: 'navigation.students',
    signatures: 'navigation.signatures',
    reports: 'navigation.reports',
    dashboard: 'navigation.dashboard',
    classes: 'navigation.classes',
    teachers: 'navigation.teachers',
    users: 'navigation.users',
    onboarding: 'navigation.onboarding',
    academicYears: 'navigation.academicYears',
    imports: 'navigation.imports',
    archive: 'navigation.archive',
    audit: 'navigation.audit',
  },
} as const

export type TranslationKey = {
  [Group in keyof typeof TRANSLATION_KEYS]:
    (typeof TRANSLATION_KEYS)[Group][keyof (typeof TRANSLATION_KEYS)[Group]]
}[keyof typeof TRANSLATION_KEYS]

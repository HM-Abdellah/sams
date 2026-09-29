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
  teacher: {
    dashboard: 'teacher.dashboard',
    welcome: 'teacher.welcome',
    classes: 'teacher.classes',
    classesAssigned: 'teacher.classesAssigned',
    noClasses: 'teacher.noClasses',
    openAttendance: 'teacher.openAttendance',
    openStudents: 'teacher.openStudents',
    statistics: 'teacher.statistics',
    reportMonth: 'teacher.reportMonth',
    present: 'teacher.present',
    absent: 'teacher.absent',
    late: 'teacher.late',
    excused: 'teacher.excused',
    totalRecorded: 'teacher.totalRecorded',
    selectClass: 'teacher.selectClass',
    studentCount: 'teacher.studentCount',
    studentNumber: 'teacher.studentNumber',
    studentName: 'teacher.studentName',
    studentStatus: 'teacher.studentStatus',
    active: 'teacher.active',
    inactive: 'teacher.inactive',
    searchStudents: 'teacher.searchStudents',
    clearSearch: 'teacher.clearSearch',
    noStudents: 'teacher.noStudents',
    noStudentMatches: 'teacher.noStudentMatches',
  },
  navigation: {
    dashboard: 'navigation.dashboard',
    attendance: 'navigation.attendance',
    students: 'navigation.students',
    signatures: 'navigation.signatures',
    reports: 'navigation.reports',
    classes: 'navigation.classes',
    teachers: 'navigation.teachers',
    users: 'navigation.users',
    onboarding: 'navigation.onboarding',
    academicYears: 'navigation.academicYears',
    imports: 'navigation.imports',
    archive: 'navigation.archive',
    audit: 'navigation.audit',
  },
  system: {
    notFound: 'system.notFound',
    goToApp: 'system.goToApp',
    unauthorizedTitle: 'system.unauthorizedTitle',
    unauthorized: 'system.unauthorized',
    errorTitle: 'system.errorTitle',
    genericError: 'system.genericError',
    reload: 'system.reload',
  },
} as const

export type TranslationKey = {
  [Group in keyof typeof TRANSLATION_KEYS]:
    (typeof TRANSLATION_KEYS)[Group][keyof (typeof TRANSLATION_KEYS)[Group]]
}[keyof typeof TRANSLATION_KEYS]

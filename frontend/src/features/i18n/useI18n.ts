import { useContext } from 'react'
import { I18nContext } from './I18nContext.ts'

export function useI18n() {
  const context = useContext(I18nContext)

  if (context === null) {
    throw new Error('useI18n must be used inside I18nProvider')
  }

  return context
}

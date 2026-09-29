import { useI18n } from '../../features/i18n/useI18n.ts'
import { TRANSLATION_KEYS, type Locale } from '../../features/i18n/types.ts'
import { Select } from './Select.tsx'

export function LanguageSelect() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="sams-language">
        {t(TRANSLATION_KEYS.app.language)}
      </label>
      <Select
        id="sams-language"
        aria-label={t(TRANSLATION_KEYS.app.language)}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="min-h-9 w-auto py-1"
      >
        <option value="fr">{t(TRANSLATION_KEYS.app.french)}</option>
        <option value="ar">{t(TRANSLATION_KEYS.app.arabic)}</option>
        <option value="en">{t(TRANSLATION_KEYS.app.english)}</option>
      </Select>
    </div>
  )
}

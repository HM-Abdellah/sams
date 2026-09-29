import { useRouteError, isRouteErrorResponse } from 'react-router'
import { Button } from '../../components/ui/Button.tsx'
import { useI18n } from '../../features/i18n/useI18n.ts'

export function RouteErrorPage() {
  const error = useRouteError()
  const { t } = useI18n()
  const detail = isRouteErrorResponse(error) && error.status >= 500
    ? error.statusText
    : t('system.genericError')

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-lg border bg-[var(--sams-surface)] p-6">
        <p className="text-sm font-semibold text-[var(--sams-muted)]">SAMS</p>
        <h1 className="text-2xl font-semibold">{t('system.errorTitle')}</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">{detail}</p>
        <Button type="button" className="mt-4" onClick={() => window.location.reload()}>
          {t('system.reload')}
        </Button>
      </section>
    </main>
  )
}

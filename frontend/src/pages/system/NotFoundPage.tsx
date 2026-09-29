import { useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button.tsx'
import { useI18n } from '../../features/i18n/useI18n.ts'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-lg border bg-[var(--sams-surface)] p-6">
        <p className="text-sm font-semibold text-[var(--sams-muted)]">SAMS</p>
        <h1 className="mt-1 text-2xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-[var(--sams-muted)]">
          {t('system.notFound')}
        </p>
        <Button type="button" className="mt-4" onClick={() => navigate('/app')}>
          {t('system.goToApp')}
        </Button>
      </section>
    </main>
  )
}

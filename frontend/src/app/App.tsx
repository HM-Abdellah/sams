import { I18nProvider } from './providers/I18nProvider.tsx'
import { SessionProvider } from './providers/SessionProvider.tsx'
import { AppRouter } from '../routes/router.tsx'

export function App() {
  return (
    <I18nProvider>
      <SessionProvider>
        <AppRouter />
      </SessionProvider>
    </I18nProvider>
  )
}

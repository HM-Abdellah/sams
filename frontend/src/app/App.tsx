import { SessionProvider } from './providers/SessionProvider.tsx'
import { AppRouter } from '../routes/router.tsx'

export function App() {
  return (
    <SessionProvider>
      <AppRouter />
    </SessionProvider>
  )
}

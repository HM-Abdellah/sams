import { env } from '../lib/env.ts'
import { AppRouter } from '../routes/router.tsx'

export function App() {
  return (
    <div data-api-base-url={env.apiBaseUrl}>
      <AppRouter />
    </div>
  )
}

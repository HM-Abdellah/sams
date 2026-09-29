import { useContext } from 'react'
import { SessionContext } from './SessionContext.ts'
import type { SessionContextValue } from './types.ts'

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext)
  if (context === null) {
    throw new Error('useSession must be used inside SessionProvider.')
  }
  return context
}

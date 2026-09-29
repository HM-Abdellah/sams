import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../services/api/errors.ts'
import { useSession } from '../../features/auth/useSession.ts'

export function LoginPage() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [samsCode, setSamsCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
    ? location.state.from
    : '/app'

  if (session.status === 'loading') {
    return <div className="grid min-h-screen place-items-center p-6">Loading…</div>
  }

  if (session.status === 'authenticated') return null

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-neutral-500">SAMS</p>
        <h1 className="mt-1 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-neutral-600">Use your SAMS Code and password.</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            setSubmitting(true)
            try {
              await session.login(samsCode, password)
              navigate(from, { replace: true })
            } catch (cause) {
              setError(cause instanceof ApiError ? cause.message : 'Unable to sign in. Try again.')
            } finally {
              setSubmitting(false)
            }
          }}
        >
          <label className="block text-sm font-medium">
            SAMS Code
            <input
              autoComplete="username"
              value={samsCode}
              onChange={(event) => setSamsCode(event.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 block w-full rounded-md border px-3 py-2"
              required
            />
          </label>
          {error !== null && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-md border px-4 py-2 font-medium disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}

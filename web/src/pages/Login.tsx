import { useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { useAuthHydrated } from '../hooks/useAuthHydrated'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { passwordsMatch } from '../lib/passwords'
import { normalizeLoginUsername } from '../lib/username'
import { useAuthStore } from '../store/useAuthStore'
import { useTrackerStore } from '../store/useTrackerStore'

export function Login() {
  const navigate = useNavigate()
  const loc = useLocation()
  const locState = loc.state as
    | { from?: string; registered?: boolean }
    | null
  const from = locState?.from ?? '/'
  const justRegistered = locState?.registered === true

  const existing = useCurrentUser()
  const users = useTrackerStore((s) => s.users)
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const authHydrated = useAuthHydrated()
  const storeHydrated = useSyncExternalStore(
    (onStoreChange) =>
      useTrackerStore.persist.onFinishHydration(onStoreChange),
    () => useTrackerStore.persist.hasHydrated(),
    () => true,
  )

  if (!authHydrated || !storeHydrated) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (existing && !existing.mustChangePassword) {
    return <Navigate to="/" replace />
  }
  if (existing?.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const un = normalizeLoginUsername(username)
    const u = users.find((x) => x.username === un)
    if (!u || !passwordsMatch(u.password, password)) {
      setError('Invalid username or password.')
      return
    }
    setCurrentUserId(u.id)
    if (u.mustChangePassword) {
      navigate('/change-password', { replace: true })
      return
    }
    const safeFrom =
      from && !from.startsWith('/login') ? from : null
    navigate(safeFrom ?? '/', { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
          Scrum tracker
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use the username and password from your team admin. First-time members
          use the master password once, then choose their own.
        </p>
        {justRegistered ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            Team created. Sign in with the username and password you just set.
            Everything stays in this browser only—no server to start.
          </p>
        ) : null}
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          <div>
            <label
              className="text-xs font-semibold text-slate-600 dark:text-slate-400"
              htmlFor="u"
            >
              Username
            </label>
            <input
              id="u"
              autoComplete="username"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <PasswordField
            id="p"
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
          {error ? (
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400">
          <Link
            to="/register"
            className="font-semibold text-indigo-700 underline hover:text-indigo-900 dark:text-slate-100 dark:hover:text-white"
          >
            Create a new team (admin)
          </Link>
        </p>
      </div>
    </div>
  )
}

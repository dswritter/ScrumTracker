import { useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { normalizeLoginUsername } from '../lib/username'
import { useAuthStore } from '../store/useAuthStore'
import { useTrackerStore } from '../store/useTrackerStore'
import { isAdmin } from '../lib/permissions'

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
  const storeHydrated = useSyncExternalStore(
    (onStoreChange) =>
      useTrackerStore.persist.onFinishHydration(onStoreChange),
    () => useTrackerStore.persist.hasHydrated(),
    () => true,
  )

  if (existing && !existing.mustChangePassword) {
    return <Navigate to={isAdmin(existing) ? '/' : '/me'} replace />
  }
  if (existing?.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeHydrated) return
    setError(null)
    const un = normalizeLoginUsername(username)
    const pw = password.trim()
    const u = users.find((x) => x.username === un)
    if (!u || u.password.trim() !== pw) {
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
    const dest =
      u.role === 'admin' ? (safeFrom ?? '/') : '/me'
    navigate(dest, { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          Scrum tracker
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the username and password from your team admin. First-time members
          use the master password once, then choose their own.
        </p>
        {justRegistered ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Team created. Sign in with the username and password you just set.
            Everything stays in this browser only—no server to start.
          </p>
        ) : null}
        <form className="mt-6 space-y-3" onSubmit={onSubmit}>
          {!storeHydrated ? (
            <p className="text-sm text-slate-600">Loading saved team data…</p>
          ) : null}
          <div>
            <label className="text-xs font-semibold text-slate-600" htmlFor="u">
              Username
            </label>
            <input
              id="u"
              autoComplete="username"
              disabled={!storeHydrated}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:bg-slate-50"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <PasswordField
            id="p"
            label="Password"
            autoComplete="current-password"
            disabled={!storeHydrated}
            value={password}
            onChange={setPassword}
          />
          {error ? (
            <p className="text-sm font-medium text-rose-700">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={!storeHydrated}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link
            to="/register"
            className="font-semibold text-indigo-700 underline hover:text-indigo-900"
          >
            Create a new team (admin)
          </Link>
        </p>
      </div>
    </div>
  )
}

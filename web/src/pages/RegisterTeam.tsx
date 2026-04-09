import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useAuthStore } from '../store/useAuthStore'
import { useTrackerStore } from '../store/useTrackerStore'

export function RegisterTeam() {
  const existing = useCurrentUser()
  const navigate = useNavigate()
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId)
  const registerTeamWithAdmin = useTrackerStore((s) => s.registerTeamWithAdmin)

  const [teamName, setTeamName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Password and confirmation do not match.')
      return
    }
    const r = registerTeamWithAdmin({
      teamName,
      adminDisplayName: displayName,
      adminUsername: username,
      adminPassword: password,
    })
    if (!r.ok) {
      setError(r.error)
      return
    }
    navigate('/login', {
      replace: true,
      state: { registered: true },
    })
  }

  const field =
    'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          New team
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Register as team admin
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Creates an isolated workspace: only users you add can see this team&apos;s
          data. All of this is saved in your browser (local storage)—there is no
          separate backend server to run. Leading @ on usernames is optional.
        </p>

        {existing ? (
          <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p>
              You are signed in as{' '}
              <span className="font-semibold">
                @{existing.username}
              </span>
              . To create another team, sign out first (usernames must be unique
              across all teams in this browser).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100/80"
                onClick={() => setCurrentUserId(null)}
              >
                Sign out
              </button>
              <Link
                to="/"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="tn">
                Team name
              </label>
              <input
                id="tn"
                className={field}
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Color & Graphics"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="dn">
                Your display name
              </label>
              <input
                id="dn"
                className={field}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="As it should appear on work items"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600" htmlFor="un">
                Username (e.g. LDAP)
              </label>
              <input
                id="un"
                autoComplete="username"
                className={field}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <PasswordField
              id="pw"
              label="Password (min 8 characters)"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
            />
            <PasswordField
              id="pw2"
              label="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
            />
            {error ? (
              <p className="text-sm font-medium text-rose-700">{error}</p>
            ) : null}
            <button
              type="submit"
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              Create team
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-600">
          <Link
            to="/login"
            className="font-semibold text-indigo-700 underline hover:text-indigo-900"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

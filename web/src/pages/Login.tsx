import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import {
  clearFirstLoginPasswordVerified,
  markFirstLoginPasswordVerified,
} from '../lib/firstLoginSession'
import { useAuthHydrated } from '../hooks/useAuthHydrated'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerPersistHydrated } from '../hooks/useTrackerPersistHydrated'
import { passwordsMatch } from '../lib/passwords'
import { normalizeLoginUsername } from '../lib/username'
import type { TrackerUserAccount } from '../types'
import { useAuthStore } from '../store/useAuthStore'
import { useTrackerStore } from '../store/useTrackerStore'
import { isUpperManagement } from '../lib/permissions'

type LoginPhase = 'credentials' | 'optional-hint'

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
  const setPasswordHintForUser = useTrackerStore(
    (s) => s.setPasswordHintForUser,
  )
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hintAfterFailure, setHintAfterFailure] = useState<string | null>(null)
  const [phase, setPhase] = useState<LoginPhase>('credentials')
  const [pendingUser, setPendingUser] = useState<TrackerUserAccount | null>(
    null,
  )
  const [optionalHintDraft, setOptionalHintDraft] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const authHydrated = useAuthHydrated()
  const storeHydrated = useTrackerPersistHydrated()

  if (!authHydrated || !storeHydrated) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <p className="text-sm text-slate-600 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (existing && !existing.mustChangePassword) {
    return <Navigate to={isUpperManagement(existing) ? '/overview' : '/'} replace />
  }
  if (existing?.mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  const needsOptionalHintStep = (u: TrackerUserAccount) =>
    !(u.passwordHint && u.passwordHint.trim())

  const finishLogin = (u: TrackerUserAccount) => {
    setCurrentUserId(u.id)
    if (u.mustChangePassword) {
      navigate('/change-password', { replace: true })
      return
    }
    if (isUpperManagement(u)) {
      navigate('/overview', { replace: true })
      return
    }
    const safeFrom =
      from && !from.startsWith('/login') ? from : null
    navigate(safeFrom ?? '/', { replace: true })
  }

  const onCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setHintAfterFailure(null)
    const un = normalizeLoginUsername(username)
    const u = users.find((x) => x.username === un)
    if (!u || !passwordsMatch(u.password, password)) {
      setError('Invalid username or password.')
      if (u?.passwordHint?.trim()) {
        setHintAfterFailure(u.passwordHint.trim())
      } else {
        setHintAfterFailure(null)
      }
      return
    }

    if (u.mustChangePassword) {
      markFirstLoginPasswordVerified(u.id)
    }

    if (needsOptionalHintStep(u)) {
      setPendingUser(u)
      setOptionalHintDraft('')
      setPhase('optional-hint')
      return
    }

    finishLogin(u)
  }

  const onOptionalHintBack = () => {
    if (pendingUser?.mustChangePassword) {
      clearFirstLoginPasswordVerified()
    }
    setPendingUser(null)
    setOptionalHintDraft('')
    setPhase('credentials')
  }

  const onOptionalHintContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingUser) return
    const hint = optionalHintDraft.trim()
    if (hint) {
      setPasswordHintForUser(pendingUser.id, hint)
    }
    finishLogin(pendingUser)
    setPendingUser(null)
    setPhase('credentials')
  }

  if (phase === 'optional-hint' && pendingUser) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            Scrum tracker
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            Optional password hint
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Your password is correct. You do not have a hint saved yet. If you
            sometimes forget your password, add a short reminder (never your real
            password). You can skip this step.
          </p>
          <form className="mt-6 space-y-3" onSubmit={onOptionalHintContinue}>
            <div>
              <label
                className="text-xs font-semibold text-slate-600 dark:text-slate-400"
                htmlFor="hint"
              >
                Hint (optional)
              </label>
              <input
                id="hint"
                type="text"
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                placeholder='e.g. "same as my laptop PIN phrase"'
                value={optionalHintDraft}
                onChange={(e) => setOptionalHintDraft(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={onOptionalHintBack}
              >
                Back
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                {optionalHintDraft.trim() ? 'Save hint & continue' : 'Skip'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
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
        <form className="mt-6 space-y-3" onSubmit={onCredentialsSubmit}>
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
            <div className="space-y-2 text-sm">
              <p className="font-medium text-rose-700 dark:text-rose-400">
                {error}
              </p>
              {hintAfterFailure ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <span className="font-semibold">Your saved hint:</span>{' '}
                  {hintAfterFailure}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Sign in
          </button>
        </form>

        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
          <button
            type="button"
            className="text-sm font-semibold text-indigo-700 underline hover:text-indigo-900 dark:text-indigo-300 dark:hover:text-indigo-200"
            onClick={() => setShowForgot((v) => !v)}
          >
            Forgot password?
          </button>
          {showForgot ? (
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
              <p>
                This app stores passwords in your team&apos;s synced data
                (demo mode). There is no automated email reset.
              </p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>
                  Ask a <strong>team admin</strong> to open{' '}
                  <strong>Settings → Members</strong> and use{' '}
                  <strong>Issue temp password</strong> for your username.
                </li>
                <li>
                  The admin shares that <strong>one-time temporary password</strong>{' '}
                  with you securely (chat, call, in person).
                </li>
                <li>
                  Sign in here with your username and that temporary password.
                  You will be asked to choose a new password (and you can set an
                  optional hint for next time).
                </li>
              </ol>
            </div>
          ) : null}
        </div>

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

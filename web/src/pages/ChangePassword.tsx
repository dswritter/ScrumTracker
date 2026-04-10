import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import { isAdmin } from '../lib/permissions'

type VoluntaryMode = 'current' | 'master'

export function ChangePassword() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const completeFirstLoginPasswordChange = useTrackerStore(
    (s) => s.completeFirstLoginPasswordChange,
  )
  const changeOwnPassword = useTrackerStore((s) => s.changeOwnPassword)
  const resetPasswordWithMaster = useTrackerStore(
    (s) => s.resetPasswordWithMaster,
  )

  const [master, setMaster] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [voluntaryMode, setVoluntaryMode] = useState<VoluntaryMode>('current')

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const home = isAdmin(user) ? '/' : '/me'

  const onFirstLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = completeFirstLoginPasswordChange(user.id, master, next, confirm)
    if (!r.ok) {
      setError(r.error)
      return
    }
    navigate(home, { replace: true })
  }

  const onVoluntarySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const r =
      voluntaryMode === 'current'
        ? changeOwnPassword(user.id, current, next, confirm)
        : resetPasswordWithMaster(user.id, master, next, confirm)
    if (!r.ok) {
      setError(r.error)
      return
    }
    navigate(home, { replace: true })
  }

  if (user.mustChangePassword) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
            First sign-in
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            Set your password
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Enter the <strong>master password</strong> your admin gave you, then
            choose a new password (at least 8 characters) and confirm it.
          </p>
        </div>

        <form
          onSubmit={onFirstLoginSubmit}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <PasswordField
            id="m"
            label="Master password"
            autoComplete="off"
            value={master}
            onChange={setMaster}
          />
          <PasswordField
            id="n"
            label="New password"
            autoComplete="new-password"
            value={next}
            onChange={setNext}
          />
          <PasswordField
            id="c"
            label="Confirm new password"
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
            Save and continue
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
          Account
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          Change password
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your <strong>current password</strong>, or the{' '}
          <strong>master password</strong> your administrator can look up in{' '}
          <strong>Settings</strong> (same value shown next to your account).
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 font-semibold ${
            voluntaryMode === 'current'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600'
          }`}
          onClick={() => {
            setVoluntaryMode('current')
            setError(null)
          }}
        >
          I know my password
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 font-semibold ${
            voluntaryMode === 'master'
              ? 'bg-white text-indigo-900 shadow-sm'
              : 'text-slate-600'
          }`}
          onClick={() => {
            setVoluntaryMode('master')
            setError(null)
          }}
        >
          Use master password
        </button>
      </div>

      <form
        onSubmit={onVoluntarySubmit}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {voluntaryMode === 'current' ? (
          <PasswordField
            id="cur"
            label="Current password"
            autoComplete="current-password"
            value={current}
            onChange={setCurrent}
          />
        ) : (
          <>
            <PasswordField
              id="mast"
              label="Master password (from admin)"
              autoComplete="off"
              value={master}
              onChange={setMaster}
            />
            <p className="text-xs text-slate-500">
              If you forgot your login password, ask an admin to confirm the
              password listed for you in Settings, or reset it there first.
            </p>
          </>
        )}
        <PasswordField
          id="n2"
          label="New password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
        />
        <PasswordField
          id="c2"
          label="Confirm new password"
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
          Update password
        </button>
      </form>

      <p className="text-center text-sm">
        <Link to={home} className="font-medium text-indigo-700 hover:underline">
          Cancel
        </Link>
      </p>
    </div>
  )
}

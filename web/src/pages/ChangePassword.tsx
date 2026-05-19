import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { clearFirstLoginPasswordVerified, isFirstLoginPasswordVerified } from '../lib/firstLoginSession'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
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
  const setPasswordHintForUser = useTrackerStore(
    (s) => s.setPasswordHintForUser,
  )

  const [master, setMaster] = useState('')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [firstHint, setFirstHint] = useState('')
  const [voluntaryHint, setVoluntaryHint] = useState('')
  const voluntaryHintDirty = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [voluntaryMode, setVoluntaryMode] = useState<VoluntaryMode>('current')

  const firstLoginSessionOk = user
    ? isFirstLoginPasswordVerified(user.id)
    : false

  useEffect(() => {
    if (!user) return
    setVoluntaryHint(user.passwordHint ?? '')
    voluntaryHintDirty.current = false
  }, [user?.id, user?.passwordHint])

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const home = '/'

  const onFirstLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = completeFirstLoginPasswordChange(
      user.id,
      firstLoginSessionOk ? '' : master,
      next,
      confirm,
      firstHint.trim() || undefined,
    )
    if (!r.ok) {
      setError(r.error)
      return
    }
    clearFirstLoginPasswordVerified()
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
    if (voluntaryHintDirty.current) {
      setPasswordHintForUser(user.id, voluntaryHint.trim())
    }
    navigate(home, { replace: true })
  }

  if (user.mustChangePassword) {
    return (
      <div className="mx-auto max-w-md space-y-6 px-4 py-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
            First sign-in
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            Set your password
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {firstLoginSessionOk ? (
              <>
                You already signed in with your temporary password. Choose a
                new password (at least 8 characters) and confirm it below.
              </>
            ) : (
              <>
                Enter the <strong>temporary password</strong> your admin gave
                you (out of band), then choose a new password (at least 8
                characters) and confirm it.
              </>
            )}
          </p>
        </div>

        <form
          onSubmit={onFirstLoginSubmit}
          className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90"
        >
          {!firstLoginSessionOk ? (
            <PasswordField
              id="m"
              label="Temporary password"
              autoComplete="off"
              value={master}
              onChange={setMaster}
            />
          ) : null}
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
          <div>
            <label
              htmlFor="fh"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400"
            >
              Password hint (optional)
            </label>
            <input
              id="fh"
              type="text"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Shown only if you mistype your password on sign-in"
              value={firstHint}
              onChange={(e) => setFirstHint(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Never put your real password here. This hint is stored with your
              team data in this browser (demo mode).
            </p>
          </div>
          {error ? (
            <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
              {error}
            </p>
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
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
          Account
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
          Change password
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Use your <strong>current password</strong>, or a{' '}
          <strong>temporary password</strong> an admin issues for you in{' '}
          <strong>Admin settings</strong> and shares out of band (admins never
          see your chosen password).
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1 text-sm dark:border-slate-600 dark:bg-slate-800/80">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 font-semibold ${
            voluntaryMode === 'current'
              ? 'bg-white text-indigo-900 shadow-sm dark:bg-slate-900 dark:text-indigo-300 dark:shadow-slate-900/50'
              : 'text-slate-600 dark:text-slate-400'
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
              ? 'bg-white text-indigo-900 shadow-sm dark:bg-slate-900 dark:text-indigo-300 dark:shadow-slate-900/50'
              : 'text-slate-600 dark:text-slate-400'
          }`}
          onClick={() => {
            setVoluntaryMode('master')
            setError(null)
          }}
        >
          Temporary password from admin
        </button>
      </div>

      <form
        onSubmit={onVoluntarySubmit}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/90"
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
              label="Temporary password (from admin)"
              autoComplete="off"
              value={master}
              onChange={setMaster}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              If you forgot your login password, ask an admin to use{' '}
              <strong>Issue temp password</strong> for your account and send you
              the value securely.
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
        <div>
          <label
            htmlFor="vh"
            className="text-xs font-semibold text-slate-600 dark:text-slate-400"
          >
            Password hint (optional)
          </label>
          <input
            id="vh"
            type="text"
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder={
              user.passwordHint
                ? 'Update or clear your sign-in hint'
                : 'Shown if you mistype your password on sign-in'
            }
            value={voluntaryHint}
            onChange={(e) => {
              voluntaryHintDirty.current = true
              setVoluntaryHint(e.target.value)
            }}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Leave unchanged to keep your current hint. Edit to update; delete
            all text and save to remove the hint.
          </p>
        </div>
        {error ? (
          <p className="text-sm font-medium text-rose-700 dark:text-rose-400">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Update password
        </button>
      </form>

      <p className="text-center text-sm">
        <Link
          to={home}
          className="font-medium text-indigo-700 hover:underline dark:text-slate-100 dark:hover:text-white"
        >
          Cancel
        </Link>
      </p>
    </div>
  )
}

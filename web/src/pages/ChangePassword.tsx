import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { PasswordField } from '../components/PasswordField'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import { isAdmin } from '../lib/permissions'

export function ChangePassword() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const completeFirstLoginPasswordChange = useTrackerStore(
    (s) => s.completeFirstLoginPasswordChange,
  )

  const [master, setMaster] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!user.mustChangePassword) {
    return <Navigate to={isAdmin(user) ? '/' : '/me'} replace />
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const r = completeFirstLoginPasswordChange(
      user.id,
      master,
      next,
      confirm,
    )
    if (!r.ok) {
      setError(r.error)
      return
    }
    navigate(isAdmin(user) ? '/' : '/me', { replace: true })
  }

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
        onSubmit={onSubmit}
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

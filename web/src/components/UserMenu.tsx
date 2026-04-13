import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { isAdmin } from '../lib/permissions'
import { useAuthStore } from '../store/useAuthStore'

export function UserMenu() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId)

  if (!user) return null

  const accountDestination = isAdmin(user) ? '/settings' : '/change-password'

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="flex max-w-[min(100vw-8rem,16rem)] items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 sm:max-w-none"
        title={isAdmin(user) ? 'Open settings' : 'Account & password'}
        onClick={() => navigate(accountDestination)}
      >
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {user.displayName}
        </span>
        <span className="text-slate-400 dark:text-slate-500">·</span>
        <span className="text-slate-500 dark:text-slate-400">
          {isAdmin(user) ? 'Administrator' : 'Member'}
        </span>
      </button>
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        title="Log out"
        aria-label="Log out"
        onClick={() => {
          setCurrentUserId(null)
          navigate('/login', { replace: true })
        }}
      >
        <i className="fa-solid fa-right-from-bracket text-base" aria-hidden />
      </button>
    </div>
  )
}

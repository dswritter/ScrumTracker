import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { isAdmin } from '../lib/permissions'
import { useAuthStore } from '../store/useAuthStore'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { useTrackerStore } from '../store/useTrackerStore'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

const adminNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/me', label: 'My page' },
  { to: '/items', label: 'Work items' },
  { to: '/people', label: 'People' },
  { to: '/matrix', label: 'Matrix' },
  { to: '/settings', label: 'Settings' },
]

const memberNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/me', label: 'My page' },
  { to: '/items', label: 'Work items' },
]

export function Layout() {
  const user = useCurrentUser()
  const teamCtx = useTeamContextNullable()
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId)
  const ensureAutoSprints = useTrackerStore((s) => s.ensureAutoSprints)
  const rollIncompleteWorkItems = useTrackerStore(
    (s) => s.rollIncompleteWorkItems,
  )
  const navigate = useNavigate()

  useEffect(() => {
    if (!teamCtx?.teamId) return
    ensureAutoSprints(teamCtx.teamId)
    rollIncompleteWorkItems(teamCtx.teamId)
  }, [teamCtx?.teamId, ensureAutoSprints, rollIncompleteWorkItems])

  const nav = user && isAdmin(user) ? adminNav : memberNav

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-none flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Scrum tracker
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              {teamCtx?.teamName ?? 'Scrum tracker'}
            </h1>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={Boolean(end)} className={linkClass}>
                {label}
              </NavLink>
            ))}
            {user ? (
              <>
                <span className="hidden px-2 text-slate-300 sm:inline">|</span>
                <span className="w-full text-xs text-slate-600 sm:w-auto sm:px-1">
                  <span className="font-medium text-slate-800">
                    {user.displayName}
                  </span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-slate-500">
                    {isAdmin(user) ? 'Administrator' : 'Member'}
                  </span>
                </span>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setCurrentUserId(null)
                    navigate('/login', { replace: true })
                  }}
                >
                  Log out
                </button>
              </>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-none flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

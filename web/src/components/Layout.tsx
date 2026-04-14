import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { JiraHeaderSyncButton } from './JiraHeaderSyncButton'
import { UserMenu } from './UserMenu'
import { useChatUnreadTotal } from '../hooks/useChatUnreadTotal'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { isAdmin } from '../lib/permissions'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { useTrackerStore } from '../store/useTrackerStore'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[#00B050]/15 text-[#0d5c2e] ring-1 ring-[#00B050]/35 dark:bg-[#00B050]/20 dark:text-[#86efac] dark:ring-[#00B050]/45'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  ].join(' ')

const adminNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/me', label: 'My page' },
  { to: '/items', label: 'Work items' },
  { to: '/chat', label: 'Chat' },
  { to: '/people', label: 'People' },
  { to: '/matrix', label: 'Matrix' },
]

const memberNav = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/me', label: 'My page' },
  { to: '/items', label: 'Work items' },
  { to: '/chat', label: 'Chat' },
]

export function Layout() {
  const user = useCurrentUser()
  const teamCtx = useTeamContextNullable()
  const chatUnread = useChatUnreadTotal()
  const rollIncompleteWorkItems = useTrackerStore(
    (s) => s.rollIncompleteWorkItems,
  )

  useEffect(() => {
    if (!teamCtx?.teamId) return
    rollIncompleteWorkItems(teamCtx.teamId)
  }, [teamCtx?.teamId, rollIncompleteWorkItems])

  const nav = user && isAdmin(user) ? adminNav : memberNav

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex w-full max-w-none flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#007a3d] dark:text-[#4ade80]">
              Scrum tracker
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {teamCtx?.teamName ?? 'Scrum tracker'}
            </h1>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {nav.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={Boolean(end)} className={linkClass}>
                <span className="inline-flex items-center gap-1.5">
                  {label}
                  {to === '/chat' && chatUnread > 0 ? (
                    <span className="min-w-[1.125rem] rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white tabular-nums">
                      {chatUnread > 99 ? '99+' : chatUnread}
                    </span>
                  ) : null}
                </span>
              </NavLink>
            ))}
            {user ? (
              <>
                <span className="hidden px-2 text-slate-300 dark:text-slate-600 sm:inline">
                  |
                </span>
                <JiraHeaderSyncButton />
                <UserMenu />
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

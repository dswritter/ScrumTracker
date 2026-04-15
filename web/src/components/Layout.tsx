import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { JiraDailyAutoSync } from './JiraDailyAutoSync'
import { JiraHeaderSyncButton } from './JiraHeaderSyncButton'
import { KnowledgeHeaderSearch } from './KnowledgeHeaderSearch'
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
  const { pathname } = useLocation()
  const user = useCurrentUser()
  const teamCtx = useTeamContextNullable()
  const chatUnread = useChatUnreadTotal()
  const [kbSearchExpanded, setKbSearchExpanded] = useState(false)
  const rollIncompleteWorkItems = useTrackerStore(
    (s) => s.rollIncompleteWorkItems,
  )

  useEffect(() => {
    if (!teamCtx?.teamId) return
    rollIncompleteWorkItems(teamCtx.teamId)
  }, [teamCtx?.teamId, rollIncompleteWorkItems])

  useEffect(() => {
    const onExpand = () => setKbSearchExpanded(true)
    const onCollapse = () => setKbSearchExpanded(false)
    window.addEventListener('kb-search-expand', onExpand)
    window.addEventListener('kb-search-collapse', onCollapse)
    return () => {
      window.removeEventListener('kb-search-expand', onExpand)
      window.removeEventListener('kb-search-collapse', onCollapse)
    }
  }, [])

  useEffect(() => {
    if (!kbSearchExpanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const t = e.target
      if (t instanceof HTMLElement && t.closest('[role="dialog"]')) return
      if (document.querySelector('.w-md-editor-fullscreen')) return
      setKbSearchExpanded(false)
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [kbSearchExpanded])

  useEffect(() => {
    const focusKnowledgeSearch = (e: KeyboardEvent) => {
      if (e.key !== '.' || e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) return
      if (t instanceof HTMLElement && t.isContentEditable) return
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement)
        return
      if (active instanceof HTMLElement && active.closest('[contenteditable="true"]'))
        return
      e.preventDefault()
      window.dispatchEvent(new CustomEvent('kb-search-expand'))
      requestAnimationFrame(() => {
        document.getElementById('kb-knowledge-search-input')?.focus()
      })
    }
    window.addEventListener('keydown', focusKnowledgeSearch, true)
    return () => window.removeEventListener('keydown', focusKnowledgeSearch, true)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const el = document.activeElement
      if (!el || !(el instanceof HTMLElement)) return
      if (el.closest('[role="dialog"]')) return
      e.preventDefault()
      el.blur()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  const nav = user && isAdmin(user) ? adminNav : memberNav
  const dashboardMain = pathname === '/' || pathname === '/index.html'

  return (
    <div className="flex min-h-svh flex-col">
      <JiraDailyAutoSync />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
        <div className="mx-auto flex w-full max-w-none flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-4 lg:px-8">
          <div className="text-left lg:shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#007a3d] dark:text-[#4ade80]">
              Scrum tracker
            </p>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {teamCtx?.teamName ?? 'Scrum tracker'}
            </h1>
          </div>
          {user && teamCtx ? (
            <div className="flex min-w-0 w-full flex-1 justify-start lg:mx-auto lg:max-w-xl">
              <div className="flex w-full max-w-lg min-w-0 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-200/70 dark:border-slate-600 dark:bg-slate-900/85 dark:ring-slate-700/80">
                <NavLink
                  to="/kb"
                  className={({ isActive }) =>
                    [
                      'inline-flex shrink-0 items-center px-3 py-2 text-sm font-semibold transition-colors',
                      isActive
                        ? 'bg-[#00B050]/15 text-[#0d5c2e] dark:bg-[#00B050]/20 dark:text-[#86efac]'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
                    ].join(' ')
                  }
                >
                  Knowledge
                </NavLink>
                <span
                  className="w-px shrink-0 self-stretch bg-slate-200 dark:bg-slate-600"
                  aria-hidden
                />
                <div
                  className={[
                    'min-h-0 min-w-0 overflow-hidden transition-[max-width] duration-300 ease-in-out',
                    kbSearchExpanded
                      ? 'max-w-[min(32rem,calc(100vw-2rem))] flex-1'
                      : 'max-w-[2.75rem] shrink-0',
                  ].join(' ')}
                >
                  <KnowledgeHeaderSearch
                    fused
                    expanded={kbSearchExpanded}
                    onExpandedChange={setKbSearchExpanded}
                  />
                </div>
              </div>
            </div>
          ) : null}
          <nav className="flex flex-wrap items-center gap-1 lg:shrink-0 lg:justify-end">
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
      <main
        className={
          dashboardMain
            ? 'mx-auto w-full max-w-none flex-1 px-4 pb-8 pt-4 sm:px-6 lg:px-8'
            : 'mx-auto w-full max-w-none flex-1 px-4 py-8 sm:px-6 lg:px-8'
        }
      >
        <Outlet />
      </main>
    </div>
  )
}

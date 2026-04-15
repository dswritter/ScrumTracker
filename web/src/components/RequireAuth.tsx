import { useSyncExternalStore } from 'react'
import { matchPath, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthHydrated } from '../hooks/useAuthHydrated'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'

export function RequireAuth() {
  const authHydrated = useAuthHydrated()
  const storeHydrated = useSyncExternalStore(
    (onStoreChange) =>
      useTrackerStore.persist.onFinishHydration(onStoreChange),
    () => useTrackerStore.persist.hasHydrated(),
    () => true,
  )
  const user = useCurrentUser()
  const loc = useLocation()

  if (!authHydrated || !storeHydrated) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  }

  const onChangePassword = matchPath(
    { path: '/change-password', end: true },
    loc.pathname,
  )
  if (user.mustChangePassword && !onChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}

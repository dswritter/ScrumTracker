import { matchPath, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

export function RequireAuth() {
  const user = useCurrentUser()
  const loc = useLocation()

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

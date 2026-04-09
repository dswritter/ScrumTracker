import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { isAdmin } from '../lib/permissions'

export function AdminRoute() {
  const user = useCurrentUser()
  if (!isAdmin(user)) {
    return <Navigate to="/me" replace />
  }
  return <Outlet />
}

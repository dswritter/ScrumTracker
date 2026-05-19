import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useAuthStore } from '../store/useAuthStore'
import { isAdmin, isUpperManagement } from '../lib/permissions'

export function AdminRoute() {
  const user = useCurrentUser()
  const viewingTeamId = useAuthStore((s) => s.viewingTeamId)
  // Upper management gets admin-level access when actively viewing a team.
  if (isAdmin(user)) return <Outlet />
  if (isUpperManagement(user) && viewingTeamId) return <Outlet />
  return <Navigate to="/me" replace />
}

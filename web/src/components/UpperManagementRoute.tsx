import { Navigate, Outlet } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { isUpperManagement } from '../lib/permissions'

export function UpperManagementRoute() {
  const user = useCurrentUser()
  if (!isUpperManagement(user)) return <Navigate to="/" replace />
  return <Outlet />
}

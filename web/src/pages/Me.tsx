import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'

/** Landing page for members: personal progress (same as People profile). */
export function Me() {
  const user = useCurrentUser()
  if (!user) return <Navigate to="/login" replace />
  return (
    <Navigate
      to={`/people/${encodeURIComponent(user.displayName)}`}
      replace
    />
  )
}

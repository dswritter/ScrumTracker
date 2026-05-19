import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'
import { useTrackerStore } from '../store/useTrackerStore'

export function ViewingModeBanner() {
  const viewingTeamId = useAuthStore((s) => s.viewingTeamId)
  const setViewingTeamId = useAuthStore((s) => s.setViewingTeamId)
  const navigate = useNavigate()
  const teams = useTrackerStore((s) => s.teams)

  const team = viewingTeamId ? teams.find((t) => t.id === viewingTeamId) : null

  // Auto-clear stale viewingTeamId (team was deleted).
  useEffect(() => {
    if (viewingTeamId && !team) {
      setViewingTeamId(null)
    }
  }, [viewingTeamId, team, setViewingTeamId])

  if (!viewingTeamId || !team) return null

  function handleBack() {
    setViewingTeamId(null)
    navigate('/overview')
  }

  return (
    <div className="sticky top-[57px] z-20 flex items-center justify-between gap-4 border-b border-amber-200 bg-amber-50 px-4 py-2">
      <p className="text-sm text-amber-900">
        Viewing{' '}
        <span className="font-semibold">{team.name}</span>
        {' · '}
        <span className="text-amber-700">Full access</span>
      </p>
      <button
        onClick={handleBack}
        className="flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
      >
        ← Back to Overview
      </button>
    </div>
  )
}

import { useMemo } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TrackerTeamData } from '../types'

const empty: TrackerTeamData = {
  sprints: [],
  workItems: [],
  teamMembers: [],
  jiraBaseUrl: '',
}

export type TeamContext = {
  user: NonNullable<ReturnType<typeof useCurrentUser>>
  teamId: string
  teamName: string
} & TrackerTeamData

/** Current user's team slice; null if not signed in or missing team. */
export function useTeamContextNullable(): TeamContext | null {
  const user = useCurrentUser()
  const teams = useTrackerStore((s) => s.teams)
  const slice = useTrackerStore((s) =>
    user?.teamId ? s.teamsData[user.teamId] : undefined,
  )

  return useMemo(() => {
    if (!user?.teamId) return null
    const meta = teams.find((t) => t.id === user.teamId)
    const d = slice ?? empty
    return {
      user,
      teamId: user.teamId,
      teamName: meta?.name ?? 'Team',
      sprints: d.sprints,
      workItems: d.workItems,
      teamMembers: d.teamMembers,
      jiraBaseUrl: d.jiraBaseUrl,
      jiraSyncJql: d.jiraSyncJql,
      jiraSprintFieldId: d.jiraSprintFieldId,
    }
    }, [user, teams, slice])
}

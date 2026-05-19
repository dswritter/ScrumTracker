import { useMemo } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { filterWorkItemsForViewer } from '../lib/workItemPrivacy'
import { useTrackerStore } from '../store/useTrackerStore'
import { useAuthStore } from '../store/useAuthStore'
import { isUpperManagement } from '../lib/permissions'
import type { TrackerTeamData, TrackerUserAccount } from '../types'

const empty: TrackerTeamData = {
  sprints: [],
  workItems: [],
  teamMembers: [],
  jiraBaseUrl: '',
  slackDmUrlByDisplayName: undefined,
  weeklyWikiPageUrl: undefined,
  teamChatThreads: undefined,
}

export type TeamContext = {
  user: NonNullable<ReturnType<typeof useCurrentUser>>
  teamId: string
  teamName: string
  /** Login accounts for this team (Slack URLs, roles, etc.). */
  teamUsers: TrackerUserAccount[]
} & TrackerTeamData

/** Current user's team slice; null if not signed in or missing team. */
export function useTeamContextNullable(): TeamContext | null {
  const user = useCurrentUser()
  const viewingTeamId = useAuthStore((s) => s.viewingTeamId)
  const teams = useTrackerStore((s) => s.teams)
  const allUsers = useTrackerStore((s) => s.users)

  // Upper-management users use viewingTeamId when set; others use their own teamId.
  const effectiveTeamId = useMemo(() => {
    if (viewingTeamId && user && isUpperManagement(user)) return viewingTeamId
    return user?.teamId || null
  }, [viewingTeamId, user])

  const slice = useTrackerStore((s) =>
    effectiveTeamId ? s.teamsData[effectiveTeamId] : undefined,
  )

  return useMemo(() => {
    if (!effectiveTeamId || !user) return null
    const meta = teams.find((t) => t.id === effectiveTeamId)
    const d = slice ?? empty
    const teamUsers = allUsers.filter((u) => u.teamId === effectiveTeamId)
    return {
      user,
      teamId: effectiveTeamId,
      teamName: meta?.name ?? 'Team',
      teamUsers,
      sprints: d.sprints,
      workItems: filterWorkItemsForViewer(d.workItems, user),
      teamMembers: d.teamMembers,
      jiraBaseUrl: d.jiraBaseUrl,
      jiraSyncJql: d.jiraSyncJql,
      jiraSprintFieldId: d.jiraSprintFieldId,
      slackDmUrlByDisplayName: d.slackDmUrlByDisplayName,
      weeklyWikiPageUrl: d.weeklyWikiPageUrl,
      teamChatThreads: d.teamChatThreads,
      teamKnowledgePages: d.teamKnowledgePages,
    }
  }, [user, effectiveTeamId, teams, slice, allUsers])
}

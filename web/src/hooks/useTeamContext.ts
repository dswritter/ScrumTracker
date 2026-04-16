import { useMemo } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { filterWorkItemsForViewer } from '../lib/workItemPrivacy'
import { useTrackerStore } from '../store/useTrackerStore'
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
  const teams = useTrackerStore((s) => s.teams)
  const allUsers = useTrackerStore((s) => s.users)
  const slice = useTrackerStore((s) =>
    user?.teamId ? s.teamsData[user.teamId] : undefined,
  )

  return useMemo(() => {
    if (!user?.teamId) return null
    const meta = teams.find((t) => t.id === user.teamId)
    const d = slice ?? empty
    const teamUsers = allUsers.filter((u) => u.teamId === user.teamId)
    return {
      user,
      teamId: user.teamId,
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
    }, [user, teams, slice, allUsers])
}

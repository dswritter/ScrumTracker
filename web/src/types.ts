export type SprintId = string

export interface Sprint {
  id: SprintId
  name: string
  /** YYYY-MM-DD */
  start: string
  /** YYYY-MM-DD */
  end: string
  emoji?: string
}

export type WorkStatus =
  | 'done'
  | 'in_progress'
  | 'to_test'
  | 'to_track'
  | 'blocked'
  | 'todo'

/** Append-only thread; older entries are not edited or deleted in the UI. */
export interface WorkComment {
  id: string
  authorName: string
  body: string
  /** ISO timestamp */
  createdAt: string
}

/** Team DM message; stored in shared snapshot (syncs like work items). */
export interface TeamChatMessage {
  id: string
  authorName: string
  body: string
  /** ISO timestamp */
  createdAt: string
  /** Set when the author edits the message body. */
  editedAt?: string
}

export interface WorkItem {
  id: string
  section: string
  component: string
  title: string
  eta: string
  assignees: string[]
  status: WorkStatus
  sprintIds: SprintId[]
  jiraKeys: string[]
  /**
   * Set by individual Jira sync when this issue was filed by the user in the current
   * sprint window but is not on a Jira sprint that maps to the tracker’s active sprint.
   * Admins can add the sprint in Jira, then re-sync.
   */
  jiraNeedsSprintLabel?: boolean
  comments: WorkComment[]
  /** Legacy field; migrated into `comments` on load. */
  notes?: string
}

export type UserRole = 'admin' | 'member'

export interface TrackerTeam {
  id: string
  name: string
}

/** One playbook page (Git, Jira, setup, URLs, etc.); order is array order. */
export interface TeamKnowledgePage {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
  authorDisplayName: string
  /** Display name of the user who last changed title/body (defaults to owner). */
  lastEditedByDisplayName: string
  /** Page discussion; same shape as work-item comments. */
  comments: WorkComment[]
}

export interface TrackerTeamData {
  sprints: Sprint[]
  workItems: WorkItem[]
  /** Roster for assignees; kept in sync when login accounts are added/removed. */
  teamMembers: string[]
  jiraBaseUrl: string
  /** JQL used by the sync server to import issues (optional). */
  jiraSyncJql?: string
  /**
   * Jira custom field id for Sprint (e.g. customfield_10020). When set, sync maps
   * Jira sprints onto tracker sprints and work item sprint membership.
   */
  jiraSprintFieldId?: string
  /** Display name → Slack DM/archive URL (admin-managed). */
  slackDmUrlByDisplayName?: Record<string, string>
  /** Confluence page to open when pasting weekly wiki snippet. */
  weeklyWikiPageUrl?: string
  /**
   * Direct-message threads keyed by canonical pair `"{nameA}|||{nameB}"` (sorted by localeCompare).
   * Same thread is shared for both participants.
   */
  teamChatThreads?: Record<string, TeamChatMessage[]>
  /** Team playbook pages; syncs with team snapshot. */
  teamKnowledgePages?: TeamKnowledgePage[]
}

/**
 * Client-side demo: passwords stored in plain text. Use a real backend for production.
 * New members receive an auto-generated master password and must set their own on first login.
 */
export interface TrackerUserAccount {
  id: string
  teamId: string
  username: string
  displayName: string
  role: UserRole
  password: string
  mustChangePassword: boolean
  /** Optional Slack DM / archive URL (admin-editable; same rules as team map). */
  slackChatUrl?: string
}

export const TRACKER_SCHEMA_VERSION = 3 as const

export interface TrackerSnapshot {
  version: typeof TRACKER_SCHEMA_VERSION
  teams: TrackerTeam[]
  teamsData: Record<string, TrackerTeamData>
  users: TrackerUserAccount[]
}

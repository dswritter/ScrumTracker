import type {
  Sprint,
  TrackerTeam,
  TrackerTeamData,
  TrackerUserAccount,
  WorkItem,
} from '../types'
import { DEMO_SEED_ADMIN_PASSWORD, seedPasswordFromKey } from '../lib/passwords'
import {
  DEFAULT_WEEKLY_WIKI_PAGE_URL,
  mergeBundledSlackDefaults,
} from './defaultSlackDmUrls'

export const SEED_TEAM_ID = 'team-cng'

export const SEED_TEAM_META: TrackerTeam = {
  id: SEED_TEAM_ID,
  name: 'Color & Graphics',
}

/** Display names on roster / assignees (synced with login accounts). */
export const SEED_TEAM = [
  'Saikat Chakrabarty',
  'Dharmendra Singh',
  'Priya Agrawal',
  'Tushar Gupta',
  'Ayush Jindal',
  'Shivendra Kumar',
  'Shubham Thakral',
  'Akshat Bhatnagar',
  'Kuldeep Singh',
  'Milind Anand',
  'Sunil Kumar',
  'Shubham Kumar',
] as const

/** No bundled sprints — populate via Jira sync. */
export const SEED_SPRINTS: Sprint[] = []

/** No bundled work items — populate via Jira sync or add manually. */
export const SEED_ITEMS: WorkItem[] = []

/**
 * Work item ids from the old bundled MS-doc sample data. These are stripped on
 * load from persisted storage so empty SEED_ITEMS takes effect for everyone.
 */
export const LEGACY_SEED_WORK_ITEM_IDS = new Set(
  Array.from({ length: 15 }, (_, i) => `wi-${i + 1}`),
)

/** Bundled demo sprint rows (CG M15/M16) removed from seed; strip from storage. */
export const LEGACY_SEED_SPRINT_IDS = new Set([
  'sprint-0',
  'sprint-1',
  'sprint-2',
  'sprint-3',
])

/**
 * Remove legacy bundled demo tasks and sprints from persisted data for the
 * seed team only; drops references to legacy sprint ids on remaining items.
 */
export function stripLegacyBundledSeedSlice(
  teamId: string,
  data: TrackerTeamData,
): TrackerTeamData {
  if (teamId !== SEED_TEAM_ID) return data
  return {
    ...data,
    sprints: data.sprints.filter((s) => !LEGACY_SEED_SPRINT_IDS.has(s.id)),
    workItems: data.workItems
      .filter((w) => !LEGACY_SEED_WORK_ITEM_IDS.has(w.id))
      .map((w) => ({
        ...w,
        sprintIds: w.sprintIds.filter((id) => !LEGACY_SEED_SPRINT_IDS.has(id)),
      })),
  }
}

export const SEED_TEAM_PAYLOAD: TrackerTeamData = {
  sprints: [...SEED_SPRINTS],
  workItems: [...SEED_ITEMS],
  teamMembers: [...SEED_TEAM],
  jiraBaseUrl: 'https://jira.corp.adobe.com/browse/',
  slackDmUrlByDisplayName: mergeBundledSlackDefaults({}),
  weeklyWikiPageUrl: DEFAULT_WEEKLY_WIKI_PAGE_URL,
  teamChatThreads: {},
}

type SeedMember = {
  id: string
  username: string
  displayName: string
  role: 'admin' | 'member'
  mustChangePassword: boolean
}

const SEED_MEMBER_DEFS: SeedMember[] = [
  {
    id: 'user-admin',
    username: 'chakraba',
    displayName: 'Saikat Chakrabarty',
    role: 'admin',
    mustChangePassword: false,
  },
  {
    id: 'user-dharmendra',
    username: 'dharmendras',
    displayName: 'Dharmendra Singh',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-priya',
    username: 'agrawalpriya',
    displayName: 'Priya Agrawal',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-tushar',
    username: 'tushagup',
    displayName: 'Tushar Gupta',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-ayush',
    username: 'ayjindal',
    displayName: 'Ayush Jindal',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-shivendra',
    username: 'sshivendrak',
    displayName: 'Shivendra Kumar',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-shubham',
    username: 'thakral',
    displayName: 'Shubham Thakral',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-akshat',
    username: 'akbhatna',
    displayName: 'Akshat Bhatnagar',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-kuldeep',
    username: 'kundeeps',
    displayName: 'Kuldeep Singh',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-milind',
    username: 'milinda',
    displayName: 'Milind Anand',
    role: 'member',
    mustChangePassword: true,
  },
  {
    id: 'user-sunil',
    username: 'sunilku',
    displayName: 'Sunil Kumar',
    role: 'member',
    mustChangePassword: true,
  },
]

export const SEED_USERS: TrackerUserAccount[] = SEED_MEMBER_DEFS.map((m) => ({
  id: m.id,
  teamId: SEED_TEAM_ID,
  username: m.username.toLowerCase(),
  displayName: m.displayName,
  role: m.role,
  password:
    m.role === 'admin'
      ? DEMO_SEED_ADMIN_PASSWORD
      : seedPasswordFromKey(`${m.username}:member`),
  mustChangePassword: m.mustChangePassword,
}))

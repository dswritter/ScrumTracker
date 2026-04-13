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

/** Aligned with Color & Graphics March plan (M15/M16). */
export const SEED_SPRINTS: Sprint[] = [
  {
    id: 'sprint-0',
    name: 'CG M15 Sprint 1',
    start: '2026-02-16',
    end: '2026-02-27',
    emoji: '🟢',
  },
  {
    id: 'sprint-1',
    name: 'CG M15 Sprint 2',
    start: '2026-03-02',
    end: '2026-03-13',
    emoji: '🔵',
  },
  {
    id: 'sprint-2',
    name: 'CG M16 Sprint 1',
    start: '2026-03-16',
    end: '2026-03-31',
    emoji: '🟠',
  },
  {
    id: 'sprint-3',
    name: 'CG M16 Sprint 2',
    start: '2026-04-01',
    end: '2026-04-15',
    emoji: '🟣',
  },
]

/** No bundled work items — populate via Jira sync or add manually. */
export const SEED_ITEMS: WorkItem[] = []

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

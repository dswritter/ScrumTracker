import type {
  Sprint,
  TrackerTeam,
  TrackerTeamData,
  TrackerUserAccount,
  WorkComment,
  WorkItem,
} from '../types'
import { DEMO_SEED_ADMIN_PASSWORD, seedPasswordFromKey } from '../lib/passwords'

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
] as const

let _seedC = 0
function c(body: string, author = 'System'): WorkComment {
  _seedC += 1
  return {
    id: `c-seed-${_seedC}`,
    authorName: author,
    body,
    createdAt: '2026-01-15T12:00:00.000Z',
  }
}

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

/** Populated from ColorGraphics_March_Plan_editable.docx (WinARM / AGM / SVG / Dx12). */
export const SEED_ITEMS: WorkItem[] = [
  {
    id: 'wi-1',
    section: 'WinARM',
    component: 'ACE',
    title: 'TestACE target creation',
    eta: 'April release',
    assignees: ['Dharmendra Singh'],
    status: 'done',
    sprintIds: ['sprint-0'],
    jiraKeys: [],
    comments: [
      c(
        'Completed (tested on device). PR merged to main; TODO merge to green.',
      ),
    ],
  },
  {
    id: 'wi-2',
    section: 'WinARM',
    component: 'ACE',
    title: 'TestACE testing',
    eta: 'April release',
    assignees: ['Priya Agrawal'],
    status: 'done',
    sprintIds: ['sprint-1'],
    jiraKeys: [],
    comments: [
      c('Tests passed; color profile tests failed due to missing files.'),
    ],
  },
  {
    id: 'wi-3',
    section: 'WinARM',
    component: 'ACE',
    title: 'TestACE runtime failures',
    eta: 'April release',
    assignees: ['Priya Agrawal'],
    status: 'in_progress',
    sprintIds: ['sprint-1', 'sprint-2'],
    jiraKeys: [],
    comments: [
      c(
        'Ps install fixed ~50% of issues; 8 failures left; debugging on new machine.',
      ),
    ],
  },
  {
    id: 'wi-4',
    section: 'WinARM',
    component: 'AGM',
    title: 'Magma target creation',
    eta: 'April release',
    assignees: ['Dharmendra Singh'],
    status: 'in_progress',
    sprintIds: ['sprint-0'],
    jiraKeys: ['CTAGM-4173506'],
    comments: [c('PR raised, tests running, to merge.')],
  },
  {
    id: 'wi-5',
    section: 'WinARM',
    component: 'AGM',
    title: 'Magma / PSPortSuite testing',
    eta: 'April release',
    assignees: ['Tushar Gupta'],
    status: 'done',
    sprintIds: ['sprint-1', 'sprint-2', 'sprint-3'],
    jiraKeys: [],
    comments: [
      c(
        'Dharmendra: PR fixed, tests running; PDFL exceptions (JIRA). Tushar: PSP build/runtime fixes merged to Dharmendra branch.',
      ),
    ],
  },
  {
    id: 'wi-6',
    section: 'WinARM',
    component: 'AGM',
    title: 'Magma runtime failures',
    eta: 'April release',
    assignees: ['Priya Agrawal'],
    status: 'done',
    sprintIds: ['sprint-1'],
    jiraKeys: [],
    comments: [c('PR merged in bravo; PDFL — disable two tests.')],
  },
  {
    id: 'wi-7',
    section: 'WinARM',
    component: 'PDF',
    title: 'PDF print testing on Surface',
    eta: 'April release',
    assignees: ['Ayush Jindal'],
    status: 'done',
    sprintIds: ['sprint-0', 'sprint-1'],
    jiraKeys: [],
    comments: [
      c('Testing done on Surface and WinARM VM; reverify on new laptop.'),
    ],
  },
  {
    id: 'wi-8',
    section: 'WinARM',
    component: 'PDF',
    title: 'PDF print testing on laptop',
    eta: 'April release',
    assignees: ['Ayush Jindal'],
    status: 'done',
    sprintIds: ['sprint-2'],
    jiraKeys: [],
    comments: [c('Verified on VM.')],
  },
  {
    id: 'wi-9',
    section: 'Dx12',
    component: 'Illustrator',
    title: 'Dx12 testing on Surface',
    eta: 'May release',
    assignees: ['Ayush Jindal'],
    status: 'to_track',
    sprintIds: ['sprint-0', 'sprint-1', 'sprint-2', 'sprint-3'],
    jiraKeys: ['CTAGM-4173911', 'AI-4333084'],
    comments: [
      c(
        'BVT passed; bolt pending. ARM build hang — JIRA on AI; x64 build assert.',
      ),
    ],
  },
  {
    id: 'wi-10',
    section: 'Dx12',
    component: 'Illustrator',
    title: 'Dx12 laptop testing',
    eta: 'May release',
    assignees: ['Ayush Jindal'],
    status: 'to_track',
    sprintIds: ['sprint-2'],
    jiraKeys: [],
    comments: [
      c(
        'VM CPU tests; 27 files diffs in quality; perf edit ~10% degradation in 15 files.',
      ),
    ],
  },
  {
    id: 'wi-11',
    section: 'SVG',
    component: 'AGM',
    title: 'SVGAGM target creation',
    eta: 'April release',
    assignees: ['Dharmendra Singh'],
    status: 'done',
    sprintIds: ['sprint-0'],
    jiraKeys: [],
    comments: [c('PR raised, fix added, merged.')],
  },
  {
    id: 'wi-12',
    section: 'SVG',
    component: 'AGM',
    title: 'SVGAGM testing',
    eta: 'April release',
    assignees: ['Priya Agrawal'],
    status: 'done',
    sprintIds: ['sprint-1'],
    jiraKeys: [],
    comments: [c('PR to merge; testing done.')],
  },
  {
    id: 'wi-13',
    section: 'SVG',
    component: 'AGM',
    title: 'SVGAGM runtime failures',
    eta: 'April release',
    assignees: ['Priya Agrawal'],
    status: 'done',
    sprintIds: ['sprint-1'],
    jiraKeys: [],
    comments: [c('Fixed build issue.')],
  },
  {
    id: 'wi-14',
    section: 'Automation',
    component: 'BVT',
    title: 'Extend BVT to all AGM build targets',
    eta: 'Ongoing',
    assignees: ['Dharmendra Singh'],
    status: 'in_progress',
    sprintIds: ['sprint-1', 'sprint-2', 'sprint-3'],
    jiraKeys: ['CTAGM-4173506'],
    comments: [c('Linux follow-up.')],
  },
  {
    id: 'wi-15',
    section: 'Dx12',
    component: 'Illustrator',
    title: 'Dx12 rollout support',
    eta: 'Early April 2026',
    assignees: ['Ayush Jindal', 'Priya Agrawal'],
    status: 'to_track',
    sprintIds: ['sprint-2', 'sprint-3'],
    jiraKeys: ['AI-4333084'],
    comments: [c('Client test files pending.')],
  },
]

export const SEED_TEAM_PAYLOAD: TrackerTeamData = {
  sprints: [...SEED_SPRINTS],
  workItems: [...SEED_ITEMS],
  teamMembers: [...SEED_TEAM],
  jiraBaseUrl: 'https://jira.corp.adobe.com/browse/',
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

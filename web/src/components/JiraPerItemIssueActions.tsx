import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  JiraCreateIssueModal,
  LinkJiraIssueModal,
  mergeJiraKeysList,
} from './JiraIssueHubModals'
import type { JiraHubSyncContext } from './JiraIssueHubModals'
import { JiraUserPatModal } from './JiraUserPatModal'
import {
  fetchJiraTokenStatusPayload,
  fetchJiraUserTokenStatusPayload,
  jiraTokenStatusAllowsSync,
} from '../lib/jiraApi'
import { canEditWorkItem, isAdmin } from '../lib/permissions'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { useTrackerStore } from '../store/useTrackerStore'
import type { Sprint, TrackerUserAccount, WorkItem } from '../types'

const iconBtn =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-[#0052CC] shadow-sm hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800'

/**
 * Compact create / link Jira controls for a single work item (Items table or detail).
 */
export function JiraPerItemIssueActions({
  item,
  user,
  teamId,
  workItems,
  sprints,
}: {
  item: WorkItem
  user: TrackerUserAccount
  teamId: string
  workItems: WorkItem[]
  sprints: Sprint[]
}) {
  const navigate = useNavigate()
  const addWorkItem = useTrackerStore((s) => s.addWorkItem)
  const updateWorkItem = useTrackerStore((s) => s.updateWorkItem)
  const admin = isAdmin(user)
  const [createOpen, setCreateOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [patOpen, setPatOpen] = useState(false)
  const [pendingAfterPat, setPendingAfterPat] = useState<'create' | 'link' | null>(
    null,
  )

  const syncCtx: JiraHubSyncContext = useMemo(
    () =>
      admin
        ? { teamId, syncMode: 'admin' }
        : { teamId, syncMode: 'individual', trackerUsername: user.username },
    [admin, teamId, user.username],
  )

  const ensurePatForHub = useCallback(async (): Promise<
    'ok' | 'needPat' | 'navigate'
  > => {
    if (admin) {
      const tokenPayload = await fetchJiraTokenStatusPayload()
      if (!jiraTokenStatusAllowsSync(tokenPayload)) {
        navigate('/settings#jira-integration')
        return 'navigate'
      }
      return 'ok'
    }
    const tokenPayload = await fetchJiraUserTokenStatusPayload(user.username)
    if (!jiraTokenStatusAllowsSync(tokenPayload)) {
      return 'needPat'
    }
    return 'ok'
  }, [admin, navigate, user.username])

  const openCreate = async () => {
    const gate = await ensurePatForHub()
    if (gate === 'navigate') return
    if (gate === 'needPat') {
      setPendingAfterPat('create')
      setPatOpen(true)
      return
    }
    setCreateOpen(true)
  }

  const openLink = async () => {
    const gate = await ensurePatForHub()
    if (gate === 'navigate') return
    if (gate === 'needPat') {
      setPendingAfterPat('link')
      setPatOpen(true)
      return
    }
    setLinkOpen(true)
  }

  if (!isTrackerSyncEnabled()) return null
  if (!canEditWorkItem(user, item)) return null

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        className={iconBtn}
        title="Create Jira issue (this work item)"
        aria-label={`Create Jira issue for ${item.title.slice(0, 40)}`}
        onClick={() => void openCreate()}
      >
        <i className="fa-solid fa-plus text-[10px]" aria-hidden />
      </button>
      <button
        type="button"
        className={iconBtn}
        title="Link existing Jira issue"
        aria-label={`Link Jira issue to ${item.title.slice(0, 40)}`}
        onClick={() => void openLink()}
      >
        <i className="fa-solid fa-link text-[10px]" aria-hidden />
      </button>

      <JiraUserPatModal
        open={patOpen}
        onClose={() => {
          setPatOpen(false)
          setPendingAfterPat(null)
        }}
        username={user.username}
        onSaved={() => {
          setPatOpen(false)
          const next = pendingAfterPat
          setPendingAfterPat(null)
          if (next === 'create') setCreateOpen(true)
          if (next === 'link') setLinkOpen(true)
        }}
      />

      <JiraCreateIssueModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        syncCtx={syncCtx}
        user={user}
        workItems={workItems}
        sprints={sprints}
        contextItemId={item.id}
        onApplyNewItem={(partial) => addWorkItem(teamId, partial)}
        onApplyLink={(itemId, jiraKey) => {
          const row = workItems.find((w) => w.id === itemId)
          if (!row) return
          updateWorkItem(teamId, itemId, {
            jiraKeys: mergeJiraKeysList(row.jiraKeys, jiraKey),
          })
        }}
      />

      <LinkJiraIssueModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        syncCtx={syncCtx}
        user={user}
        workItems={workItems}
        contextItemId={item.id}
        onApplyLink={(itemId, jiraKey) => {
          const row = workItems.find((w) => w.id === itemId)
          if (!row) return
          updateWorkItem(teamId, itemId, {
            jiraKeys: mergeJiraKeysList(row.jiraKeys, jiraKey),
          })
        }}
      />
    </div>
  )
}

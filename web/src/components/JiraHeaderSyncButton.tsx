import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  JiraCreateIssueModal,
  LinkJiraIssueModal,
  mergeJiraKeysList,
} from './JiraIssueHubModals'
import { JiraUserPatModal } from './JiraUserPatModal'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import {
  fetchJiraTokenStatusPayload,
  fetchJiraUserTokenStatusPayload,
  jiraTokenStatusAllowsSync,
} from '../lib/jiraApi'
import { isAdmin } from '../lib/permissions'
import { runJiraSyncFromStore } from '../lib/runJiraSync'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { useTrackerStore } from '../store/useTrackerStore'

/** Jira sync: admins use team PAT in Settings; members use their own PAT on the server. */
export function JiraHeaderSyncButton() {
  const ctx = useTeamContextNullable()
  const user = useCurrentUser()
  const exportSnapshotJson = useTrackerStore((s) => s.exportSnapshotJson)
  const importSnapshotJson = useTrackerStore((s) => s.importSnapshotJson)
  const addWorkItem = useTrackerStore((s) => s.addWorkItem)
  const updateWorkItem = useTrackerStore((s) => s.updateWorkItem)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [patOpen, setPatOpen] = useState(false)
  const [pendingAfterPat, setPendingAfterPat] = useState<'create' | 'link' | null>(
    null,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const hubRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const hasSyncServer = isTrackerSyncEnabled()
  if (!ctx || !hasSyncServer || !user) return null

  const teamId = ctx.teamId
  const admin = isAdmin(user)

  const syncCtx = useMemo(
    () =>
      admin
        ? { teamId, syncMode: 'admin' as const }
        : {
            teamId,
            syncMode: 'individual' as const,
            trackerUsername: user.username,
          },
    [admin, teamId, user.username],
  )

  const doSync = async (): Promise<void> => {
    const r = await runJiraSyncFromStore(
      exportSnapshotJson,
      importSnapshotJson,
      teamId,
      admin
        ? { syncMode: 'admin' }
        : { syncMode: 'individual', trackerUsername: user.username },
    )
    if (r.ok) {
      setToast(r.message)
      window.setTimeout(() => setToast(null), 4000)
    } else {
      window.alert(r.message)
    }
  }

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

  const openCreateHub = async () => {
    setMenuOpen(false)
    const gate = await ensurePatForHub()
    if (gate === 'navigate') return
    if (gate === 'needPat') {
      setPendingAfterPat('create')
      setPatOpen(true)
      return
    }
    setCreateOpen(true)
  }

  const openLinkHub = async () => {
    setMenuOpen(false)
    const gate = await ensurePatForHub()
    if (gate === 'navigate') return
    if (gate === 'needPat') {
      setPendingAfterPat('link')
      setPatOpen(true)
      return
    }
    setLinkOpen(true)
  }

  useEffect(() => {
    if (!menuOpen) return
    const fn = (e: MouseEvent) => {
      if (hubRef.current && !hubRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [menuOpen])

  return (
    <div ref={hubRef} className="relative inline-flex items-center">
      <div className="inline-flex h-9 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-600 dark:bg-slate-900">
        <button
          type="button"
          disabled={busy}
          title={
            admin
              ? 'Sync work items from Jira (team JQL and PAT in Settings)'
              : 'Sync from Jira: team sprint items plus issues you reported in the current sprint window'
          }
          aria-label="Sync from Jira"
          className="inline-flex h-9 items-center gap-1.5 border-0 bg-transparent px-2.5 text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800"
          onClick={async () => {
            setToast(null)
            setBusy(true)
            try {
              if (admin) {
                const tokenPayload = await fetchJiraTokenStatusPayload()
                if (!jiraTokenStatusAllowsSync(tokenPayload)) {
                  navigate('/settings#jira-integration')
                  return
                }
              } else {
                const tokenPayload = await fetchJiraUserTokenStatusPayload(
                  user.username,
                )
                if (!jiraTokenStatusAllowsSync(tokenPayload)) {
                  setPatOpen(true)
                  return
                }
              }
              await doSync()
            } finally {
              setBusy(false)
            }
          }}
        >
          <i className="fa-brands fa-jira text-[1.05rem] text-[#0052CC]" aria-hidden />
          <i
            className={`fa-solid fa-arrows-rotate text-xs text-slate-700 dark:text-slate-200 ${busy ? 'animate-spin' : ''}`}
            aria-hidden
          />
        </button>
        <span
          className="w-px shrink-0 self-stretch bg-slate-200 dark:bg-slate-600"
          aria-hidden
        />
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center border-0 bg-transparent text-sm font-bold text-[#0052CC] hover:bg-slate-50 dark:hover:bg-slate-800"
          title="Create or link a Jira issue"
          aria-label="Create or link Jira issue"
          aria-expanded={menuOpen}
          aria-haspopup="true"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <i className="fa-solid fa-plus text-xs" aria-hidden />
        </button>
      </div>

      {menuOpen ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-600 dark:bg-slate-900"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => void openCreateHub()}
          >
            <span className="font-semibold">Create new Jira issue</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
              New tracker row or link to an existing item
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => void openLinkHub()}
          >
            <span className="font-semibold">Link existing Jira issue</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
              Verify the key in Jira, then attach to a work item
            </span>
          </button>
        </div>
      ) : null}

      {toast ? (
        <span className="absolute right-0 top-full z-50 mt-1 max-w-[14rem] rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 shadow dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100">
          {toast}
        </span>
      ) : null}

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
        workItems={ctx.workItems}
        sprints={ctx.sprints}
        onApplyNewItem={(partial) => addWorkItem(teamId, partial)}
        onApplyLink={(itemId, jiraKey) => {
          const item = ctx.workItems.find((w) => w.id === itemId)
          if (!item) return
          updateWorkItem(teamId, itemId, {
            jiraKeys: mergeJiraKeysList(item.jiraKeys, jiraKey),
          })
        }}
      />

      <LinkJiraIssueModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        syncCtx={syncCtx}
        user={user}
        workItems={ctx.workItems}
        onApplyLink={(itemId, jiraKey) => {
          const item = ctx.workItems.find((w) => w.id === itemId)
          if (!item) return
          updateWorkItem(teamId, itemId, {
            jiraKeys: mergeJiraKeysList(item.jiraKeys, jiraKey),
          })
        }}
      />
    </div>
  )
}

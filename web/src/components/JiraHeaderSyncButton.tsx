import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [patOpen, setPatOpen] = useState(false)
  const navigate = useNavigate()

  const hasSyncServer = isTrackerSyncEnabled()
  if (!ctx || !hasSyncServer || !user) return null

  const teamId = ctx.teamId
  const admin = isAdmin(user)

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

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        disabled={busy}
        title={
          admin
            ? 'Sync work items from Jira (team JQL and PAT in Settings)'
            : 'Sync from Jira: team sprint items plus issues you reported in the current sprint window'
        }
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
          className={`fa-solid fa-arrows-rotate text-xs ${busy ? 'animate-spin' : ''}`}
          aria-hidden
        />
        <span className="hidden sm:inline">Jira sync</span>
      </button>
      {toast ? (
        <span className="absolute right-0 top-full z-50 mt-1 max-w-[14rem] rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 shadow dark:border-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-100">
          {toast}
        </span>
      ) : null}
      <JiraUserPatModal
        open={patOpen}
        onClose={() => setPatOpen(false)}
        username={user.username}
        onSaved={async () => {
          setPatOpen(false)
          setBusy(true)
          try {
            await doSync()
          } finally {
            setBusy(false)
          }
        }}
      />
    </div>
  )
}

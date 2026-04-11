import { useState } from 'react'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { runJiraSyncFromStore } from '../lib/runJiraSync'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { useTrackerStore } from '../store/useTrackerStore'

/** Admin-only: quick sync from Jira (same as Settings). Requires sync enabled in the build. */
export function JiraHeaderSyncButton() {
  const ctx = useTeamContextNullable()
  const exportSnapshotJson = useTrackerStore((s) => s.exportSnapshotJson)
  const importSnapshotJson = useTrackerStore((s) => s.importSnapshotJson)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const hasSyncServer = isTrackerSyncEnabled()
  if (!ctx || !hasSyncServer) return null

  const teamId = ctx.teamId

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        disabled={busy}
        title="Sync work items from Jira (uses JQL and PAT in Settings)"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        onClick={async () => {
          setToast(null)
          setBusy(true)
          const r = await runJiraSyncFromStore(
            exportSnapshotJson,
            importSnapshotJson,
            teamId,
          )
          setBusy(false)
          if (r.ok) {
            setToast(r.message)
            window.setTimeout(() => setToast(null), 4000)
          } else {
            window.alert(r.message)
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
        <span className="absolute right-0 top-full z-50 mt-1 max-w-[14rem] rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-900 shadow">
          {toast}
        </span>
      ) : null}
    </div>
  )
}

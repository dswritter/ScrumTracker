import { postJiraSync } from './jiraApi'

export type JiraSyncMode = 'admin' | 'individual'

export async function runJiraSyncFromStore(
  exportSnapshotJson: () => string,
  importSnapshotJson: (json: string) => { ok: true } | { ok: false; error: string },
  teamId: string,
  opts?: {
    syncMode?: JiraSyncMode
    trackerUsername?: string
    /** Tracker sprint id from the UI (Dashboard scope or default current sprint). */
    syncSprintId?: string
  },
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const snap = exportSnapshotJson()
  try {
    const res = await postJiraSync({
      snapshot: snap,
      teamId,
      syncMode: opts?.syncMode,
      trackerUsername: opts?.trackerUsername,
      syncSprintId: opts?.syncSprintId,
    })
    if (!res.ok) {
      return { ok: false, message: await res.text() }
    }
    const data = (await res.json()) as {
      snapshot?: string
      issueCount?: number
      commentFetchFailureCount?: number
    }
    if (!data.snapshot) {
      return { ok: false, message: 'No snapshot in response' }
    }
    const r = importSnapshotJson(data.snapshot)
    if (!r.ok) {
      return { ok: false, message: r.error }
    }
    const n = data.issueCount ?? 0
    const cf = data.commentFetchFailureCount ?? 0
    const warn =
      cf > 0
        ? ` ${cf} issue(s) had a Jira comment fetch error (previous Jira comments were kept where possible; check server logs and PAT permissions).`
        : ''
    return {
      ok: true,
      message: `Synced ${n} Jira issue(s); comments refreshed and sprints updated if Sprint field is configured.${warn}`,
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Sync failed',
    }
  }
}

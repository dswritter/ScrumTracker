import { postJiraSync } from './jiraApi'

export async function runJiraSyncFromStore(
  exportSnapshotJson: () => string,
  importSnapshotJson: (json: string) => { ok: true } | { ok: false; error: string },
  teamId: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const snap = exportSnapshotJson()
  try {
    const res = await postJiraSync({ snapshot: snap, teamId })
    if (!res.ok) {
      return { ok: false, message: await res.text() }
    }
    const data = (await res.json()) as {
      snapshot?: string
      issueCount?: number
    }
    if (!data.snapshot) {
      return { ok: false, message: 'No snapshot in response' }
    }
    const r = importSnapshotJson(data.snapshot)
    if (!r.ok) {
      return { ok: false, message: r.error }
    }
    return {
      ok: true,
      message: `Synced ${data.issueCount ?? 0} Jira issue(s); comments refreshed and sprints updated if Sprint field is configured.`,
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Sync failed',
    }
  }
}

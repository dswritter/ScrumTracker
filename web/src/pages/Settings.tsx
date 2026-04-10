import { useEffect, useRef, useState } from 'react'
import type { TrackerUserAccount } from '../types'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { getJiraTokenStatus, postJiraToken } from '../lib/jiraApi'
import { runJiraSyncFromStore } from '../lib/runJiraSync'
import { useTrackerStore } from '../store/useTrackerStore'

export function Settings() {
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const teamId = ctx?.teamId ?? ''
  const teamName = ctx?.teamName ?? ''

  const users = useTrackerStore((s) => s.users)
  const importSnapshotJson = useTrackerStore((s) => s.importSnapshotJson)
  const exportSnapshotJson = useTrackerStore((s) => s.exportSnapshotJson)
  const resetToSeed = useTrackerStore((s) => s.resetToSeed)
  const addTeamMemberAccount = useTrackerStore((s) => s.addTeamMemberAccount)
  const removeUser = useTrackerStore((s) => s.removeUser)
  const setUserRole = useTrackerStore((s) => s.setUserRole)
  const adminSetUserPassword = useTrackerStore((s) => s.adminSetUserPassword)
  const setTeamName = useTrackerStore((s) => s.setTeamName)
  const setJiraBaseUrl = useTrackerStore((s) => s.setJiraBaseUrl)
  const setJiraSyncJql = useTrackerStore((s) => s.setJiraSyncJql)
  const setJiraSprintFieldId = useTrackerStore((s) => s.setJiraSprintFieldId)

  const jiraBaseUrl = ctx?.jiraBaseUrl ?? ''
  const jiraSyncJql = ctx?.jiraSyncJql ?? ''
  const jiraSprintFieldId = ctx?.jiraSprintFieldId ?? ''

  const [newTeamName, setNewTeamName] = useState(teamName)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [jiraPat, setJiraPat] = useState('')
  const [jiraPatExpires, setJiraPatExpires] = useState('')
  const [jiraDraftJql, setJiraDraftJql] = useState(jiraSyncJql)
  const [jiraDraftSprintField, setJiraDraftSprintField] = useState(jiraSprintFieldId)
  const [jiraMsg, setJiraMsg] = useState<string | null>(null)
  const [jiraTokenStatus, setJiraTokenStatus] = useState<string | null>(null)
  const [jiraSyncing, setJiraSyncing] = useState(false)

  const hasSyncServer = Boolean(import.meta.env.VITE_SYNC_API_URL?.trim())

  useEffect(() => {
    setJiraDraftJql(jiraSyncJql)
  }, [jiraSyncJql])

  useEffect(() => {
    setJiraDraftSprintField(jiraSprintFieldId)
  }, [jiraSprintFieldId])

  useEffect(() => {
    if (!hasSyncServer || !teamId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await getJiraTokenStatus()
        if (!res.ok || cancelled) {
          setJiraTokenStatus(
            res.ok ? null : `Status HTTP ${res.status}`,
          )
          return
        }
        const j = (await res.json()) as {
          status?: string
          message?: string
          daysRemaining?: number | null
        }
        setJiraTokenStatus(
          `${j.status ?? '?'}${j.message ? ` — ${j.message}` : ''}${
            j.daysRemaining != null ? ` (${j.daysRemaining}d)` : ''
          }`,
        )
      } catch {
        if (!cancelled) setJiraTokenStatus('Could not reach sync server')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hasSyncServer, teamId])

  useEffect(() => {
    setNewTeamName(teamName)
  }, [teamName])
  const fileRef = useRef<HTMLInputElement>(null)

  const [uUsername, setUUsername] = useState('')
  const [uDisplay, setUDisplay] = useState('')
  const [uRole, setURole] = useState<TrackerUserAccount['role']>('member')
  const [userMsg, setUserMsg] = useState<string | null>(null)

  const field =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm'

  const teamUsers = users.filter((u) => u.teamId === teamId)

  const onCreateUser = () => {
    setUserMsg(null)
    const r = addTeamMemberAccount(teamId, {
      username: uUsername,
      displayName: uDisplay,
      role: uRole,
    })
    if (!r.ok) {
      setUserMsg(r.error)
      return
    }
    setUUsername('')
    setUDisplay('')
    setURole('member')
    setUserMsg(
      `Account created. Give this one-time master password to the teammate: ${r.generatedPassword}`,
    )
  }

  const exportFile = () => {
    const blob = new Blob([exportSnapshotJson()], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scrum-tracker-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const text = await f.text()
    const r = importSnapshotJson(text)
    setImportMsg(r.ok ? 'Imported successfully.' : r.error)
  }

  if (!user || !ctx) return null

  return (
    <div className="mx-auto w-full max-w-none space-y-8">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            className={`max-w-md flex-1 ${field}`}
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            onClick={() => {
              setTeamName(teamId, newTeamName)
            }}
          >
            Save
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={field}
            placeholder="Username"
            value={uUsername}
            onChange={(e) => setUUsername(e.target.value)}
          />
          <input
            className={field}
            placeholder="Display name (must match assignee name on items)"
            value={uDisplay}
            onChange={(e) => setUDisplay(e.target.value)}
          />
          <select
            className={field}
            value={uRole}
            onChange={(e) =>
              setURole(e.target.value as TrackerUserAccount['role'])
            }
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          onClick={onCreateUser}
        >
          Create account
        </button>
        {userMsg ? (
          <p className="text-sm font-medium text-slate-700">{userMsg}</p>
        ) : null}

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {teamUsers.map((u) => {
            const adminCount = teamUsers.filter((x) => x.role === 'admin').length
            return (
              <li
                key={u.id}
                className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:flex-wrap sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-900">
                    {u.displayName}
                  </span>
                  <span className="ml-2 text-slate-500">@{u.username}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      u.role === 'admin'
                        ? 'bg-indigo-100 text-indigo-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {u.role}
                  </span>
                  {u.mustChangePassword ? (
                    <span className="ml-2 text-[10px] font-semibold text-amber-700">
                      Must change password
                    </span>
                  ) : null}
                </div>
                <div className="font-mono text-xs text-slate-700">
                  <span className="text-slate-500">Password: </span>
                  {u.password}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => {
                      const pw = prompt(`New password for @${u.username} (min 8 chars):`)
                      if (pw !== null && pw.trim()) {
                        const r = adminSetUserPassword(
                          teamId,
                          u.id,
                          pw.trim(),
                          false,
                        )
                        if (!r.ok) alert(r.error)
                      }
                    }}
                  >
                    Set password
                  </button>
                  {u.role === 'member' ? (
                    <button
                      type="button"
                      className="rounded border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-50"
                      onClick={() => setUserRole(teamId, u.id, 'admin')}
                    >
                      Make admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      disabled={adminCount <= 1}
                      onClick={() => setUserRole(teamId, u.id, 'member')}
                    >
                      Remove admin
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-40"
                    disabled={u.role === 'admin' && adminCount <= 1}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete login for @${u.username}? They can no longer sign in.`,
                        )
                      )
                        removeUser(teamId, u.id)
                    }}
                  >
                    Delete account
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-600">
          Keys on work items open as <span className="font-mono">base + KEY</span>
          .
        </p>
        <input
          className={field}
          value={jiraBaseUrl}
          onChange={(e) => setJiraBaseUrl(teamId, e.target.value)}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Jira integration</h2>
        <p className="text-xs text-slate-600">
          PAT and sync run on the <strong>sync server</strong> only (
          <code className="rounded bg-slate-100 px-1">VITE_SYNC_API_URL</code>
          ). Tokens are never stored in the browser. See{' '}
          <code className="rounded bg-slate-100 px-1">docs/JIRA Integration Architecture.md</code>
          .
        </p>
        {!hasSyncServer ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Set <code className="font-mono">VITE_SYNC_API_URL</code> to your Node
            sync server (port 3847) to enable Jira sync.
          </p>
        ) : null}
        <label className="block text-xs font-semibold text-slate-700">
          JQL (issues to import)
        </label>
        <textarea
          className={`${field} min-h-[72px] font-mono text-xs`}
          placeholder='e.g. project = CTCACE AND sprint in openSprints()'
          value={jiraDraftJql}
          onChange={(e) => setJiraDraftJql(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
          onClick={() => {
            setJiraSyncJql(teamId, jiraDraftJql)
            setJiraMsg('JQL saved for this team.')
          }}
        >
          Save JQL
        </button>
        <label className="mt-2 block text-xs font-semibold text-slate-700">
          Jira Sprint field id (optional)
        </label>
        <p className="text-xs text-slate-600">
          Custom field id for the Sprint field (e.g.{' '}
          <code className="rounded bg-slate-100 px-1">customfield_10020</code>). Leave
          empty to skip sprint mapping. Find it in Jira issue JSON or Fields admin.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className={`${field} max-w-md font-mono text-xs`}
            placeholder="customfield_10020"
            value={jiraDraftSprintField}
            onChange={(e) => setJiraDraftSprintField(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
            onClick={() => {
              setJiraSprintFieldId(teamId, jiraDraftSprintField)
              setJiraMsg('Sprint field id saved. Re-run Jira sync to apply.')
            }}
          >
            Save sprint field
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="password"
            className={field}
            placeholder="New Personal Access Token (PAT)"
            autoComplete="off"
            value={jiraPat}
            onChange={(e) => setJiraPat(e.target.value)}
          />
          <input
            className={field}
            placeholder="Expiry (optional)"
            type="date"
            value={jiraPatExpires}
            onChange={(e) => setJiraPatExpires(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!hasSyncServer || !jiraPat.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={async () => {
              setJiraMsg(null)
              try {
                const exp = jiraPatExpires.trim()
                const res = await postJiraToken(
                  jiraPat.trim(),
                  exp ? `${exp}T12:00:00.000Z` : undefined,
                )
                if (!res.ok) {
                  setJiraMsg(await res.text())
                  return
                }
                setJiraPat('')
                setJiraMsg('Token saved on server.')
                const st = await getJiraTokenStatus()
                if (st.ok) {
                  const j = (await st.json()) as { status?: string; message?: string }
                  setJiraTokenStatus(`${j.status ?? ''} — ${j.message ?? ''}`)
                }
              } catch (e) {
                setJiraMsg(e instanceof Error ? e.message : 'Request failed')
              }
            }}
          >
            Save PAT on server
          </button>
          <button
            type="button"
            disabled={!hasSyncServer || jiraSyncing}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            onClick={async () => {
              setJiraMsg(null)
              setJiraSyncing(true)
              try {
                const r = await runJiraSyncFromStore(
                  exportSnapshotJson,
                  importSnapshotJson,
                  teamId,
                )
                setJiraMsg(r.message)
              } finally {
                setJiraSyncing(false)
              }
            }}
          >
            {jiraSyncing ? 'Syncing…' : 'Sync from Jira now'}
          </button>
        </div>
        {jiraTokenStatus ? (
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Token status:</span> {jiraTokenStatus}
          </p>
        ) : null}
        {jiraMsg ? (
          <p className="text-xs font-medium text-slate-700">{jiraMsg}</p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-600">
          Export is a <strong>full snapshot</strong> (schema v3): every team, each
          team&apos;s sprints, work items, roster, JIRA base URL, and all user
          accounts with passwords and flags. Import replaces the entire local
          database with the file contents so everything round-trips.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            onClick={exportFile}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            onClick={() => fileRef.current?.click()}
          >
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />
        </div>
        {importMsg ? (
          <p
            className={
              importMsg.includes('success')
                ? 'text-sm font-medium text-emerald-700'
                : 'text-sm font-medium text-rose-700'
            }
          >
            {importMsg}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs text-amber-950/80">
          Reset to built-in sample data (clears local changes for this browser).
        </p>
        <button
          type="button"
          className="mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
          onClick={() => {
            if (confirm('Reset all data to seed? This cannot be undone.'))
              resetToSeed()
          }}
        >
          Reset to seed data
        </button>
      </section>
    </div>
  )
}

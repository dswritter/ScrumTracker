import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { TrackerUserAccount } from '../types'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import { getJiraTokenStatus, postJiraToken } from '../lib/jiraApi'
import { copyTextToClipboard } from '../lib/copyToClipboard'
import { pushTrackerSnapshotNow } from '../lib/pushTrackerSnapshotNow'
import { runJiraSyncFromStore } from '../lib/runJiraSync'
import { isTrackerSyncEnabled } from '../lib/syncConfigured'
import { useTrackerStore } from '../store/useTrackerStore'

function MemberIdentityEditor({
  u,
  teamId,
  fieldClass,
  adminUpdateTeamMemberIdentity,
  onMessage,
}: {
  u: TrackerUserAccount
  teamId: string
  fieldClass: string
  adminUpdateTeamMemberIdentity: (
    teamId: string,
    userId: string,
    input: { username: string; displayName: string },
  ) => { ok: true } | { ok: false; error: string }
  onMessage: (msg: string | null) => void
}) {
  const [username, setUsername] = useState(u.username)
  const [displayName, setDisplayName] = useState(u.displayName)

  useEffect(() => {
    setUsername(u.username)
    setDisplayName(u.displayName)
  }, [u.id, u.username, u.displayName])

  return (
    <div className="flex w-full flex-col gap-2 border-b border-slate-100 pb-3 dark:border-slate-800 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[10rem] flex-1">
        <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
          Login username
        </label>
        <input
          className={`${fieldClass} mt-0.5 font-mono text-xs`}
          autoComplete="off"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="min-w-[12rem] flex-[2]">
        <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
          Full name (roster &amp; assignees)
        </label>
        <input
          className={`${fieldClass} mt-0.5`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        onClick={() => {
          onMessage(null)
          const r = adminUpdateTeamMemberIdentity(teamId, u.id, {
            username,
            displayName,
          })
          if (!r.ok) {
            onMessage(r.error)
            return
          }
          onMessage('Profile updated.')
        }}
      >
        Save username &amp; name
      </button>
    </div>
  )
}

function CollapsibleSettingsSection({
  id,
  title,
  subtitle,
  children,
  defaultOpen = false,
  openWhenHash,
}: {
  id?: string
  title: string
  subtitle?: string
  children: ReactNode
  defaultOpen?: boolean
  /** When location hash matches, expand (e.g. #jira-integration). */
  openWhenHash?: string
}) {
  const { hash } = useLocation()
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    if (openWhenHash && hash === openWhenHash) setOpen(true)
  }, [hash, openWhenHash])
  return (
    <section
      id={id}
      className="scroll-mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90"
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <i
          className={`fa-solid fa-chevron-${open ? 'down' : 'right'} mt-0.5 w-4 shrink-0 text-slate-500 dark:text-slate-400`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          ) : null}
        </div>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export function Settings() {
  const location = useLocation()
  const user = useCurrentUser()
  const ctx = useTeamContextNullable()
  const teamId = ctx?.teamId ?? ''
  const teamName = ctx?.teamName ?? ''

  const users = useTrackerStore((s) => s.users)
  const importSnapshotJson = useTrackerStore((s) => s.importSnapshotJson)
  const exportSnapshotJson = useTrackerStore((s) => s.exportSnapshotJson)
  const addTeamMemberAccount = useTrackerStore((s) => s.addTeamMemberAccount)
  const removeUser = useTrackerStore((s) => s.removeUser)
  const setUserRole = useTrackerStore((s) => s.setUserRole)
  const adminIssueTemporaryPassword = useTrackerStore(
    (s) => s.adminIssueTemporaryPassword,
  )
  const adminUpdateTeamMemberIdentity = useTrackerStore(
    (s) => s.adminUpdateTeamMemberIdentity,
  )
  const setTeamName = useTrackerStore((s) => s.setTeamName)
  const setJiraBaseUrl = useTrackerStore((s) => s.setJiraBaseUrl)
  const setJiraSyncJql = useTrackerStore((s) => s.setJiraSyncJql)
  const setJiraSprintFieldId = useTrackerStore((s) => s.setJiraSprintFieldId)
  const setUserSlackChatUrl = useTrackerStore((s) => s.setUserSlackChatUrl)

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

  const hasSyncServer = isTrackerSyncEnabled()

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

  useEffect(() => {
    if (location.hash !== '#jira-integration') return
    const el = document.getElementById('jira-integration')
    if (el) {
      window.requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    }
  }, [location.hash])

  const fileRef = useRef<HTMLInputElement>(null)
  const [uUsername, setUUsername] = useState('')
  const [uDisplay, setUDisplay] = useState('')
  const [uSlack, setUSlack] = useState('')
  const [uRole, setURole] = useState<TrackerUserAccount['role']>('member')
  const [userMsg, setUserMsg] = useState<string | null>(null)
  /** Copiable one-time password after create-account or temp reset. */
  const [credentialToShare, setCredentialToShare] = useState<{
    variant: 'new-account' | 'temp-reset'
    username: string
    displayName: string
    password: string
  } | null>(null)
  /** Expanded roster rows (compact by default). */
  const [rosterExpanded, setRosterExpanded] = useState<Record<string, boolean>>(
    {},
  )

  const field =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

  const teamUsers = users.filter((u) => u.teamId === teamId)

  const onCreateUser = () => {
    setUserMsg(null)
    const createdUsername = uUsername.trim()
    const createdDisplay = uDisplay.trim()
    const r = addTeamMemberAccount(teamId, {
      username: uUsername,
      displayName: uDisplay,
      role: uRole,
      slackChatUrl: uSlack.trim() || undefined,
    })
    if (!r.ok) {
      setUserMsg(r.error)
      return
    }
    setUUsername('')
    setUDisplay('')
    setUSlack('')
    setURole('member')
    setCredentialToShare({
      variant: 'new-account',
      username: createdUsername,
      displayName: createdDisplay,
      password: r.generatedPassword,
    })
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
    <div className="mx-auto w-full max-w-3xl space-y-3">
      <CollapsibleSettingsSection
        title="Team name"
        subtitle="Display name for this workspace"
        defaultOpen
      >
        <div className="flex flex-wrap gap-2">
          <input
            className={`max-w-md flex-1 ${field}`}
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            onClick={() => {
              setTeamName(teamId, newTeamName)
            }}
          >
            Save
          </button>
        </div>
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Accounts & roster"
        subtitle="Create logins, Slack URLs, roles, temporary passwords"
      >
        <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input
            className={field}
            placeholder="LDAP"
            value={uUsername}
            onChange={(e) => setUUsername(e.target.value)}
          />
          <input
            className={field}
            placeholder="Full name (must match assignee name on items)"
            value={uDisplay}
            onChange={(e) => setUDisplay(e.target.value)}
          />
          <input
            className={`${field} font-mono text-xs`}
            placeholder="Slack Chat URL (optional) Example: https://adobe.enterprise.slack.com/archives/D03LAMQPDEW"
            value={uSlack}
            onChange={(e) => setUSlack(e.target.value)}
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
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {userMsg}
          </p>
        ) : null}

        <p className="text-xs text-slate-600 dark:text-slate-400">
          Passwords are not shown here. When someone needs a reset, use{' '}
          <strong>Issue temp password</strong>—share the one-time code offline; they
          sign in and set their own password, then the temp code stops working.
        </p>

        {credentialToShare ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">
              {credentialToShare.variant === 'new-account'
                ? 'New account — temporary password'
                : 'One-time password (reset)'}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-900/90 dark:text-amber-200/90">
              @{credentialToShare.username} · {credentialToShare.displayName}. Copy and
              send securely. Only the latest code works if you issue again.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                readOnly
                aria-label="Temporary password"
                className="min-w-[12rem] flex-1 rounded border border-amber-300 bg-white px-2 py-1.5 font-mono text-sm text-slate-900 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-100"
                value={credentialToShare.password}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900 dark:bg-amber-700 dark:hover:bg-amber-600"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  void (async () => {
                    const ok = await copyTextToClipboard(credentialToShare.password)
                    setUserMsg(
                      ok
                        ? 'Copied to clipboard.'
                        : 'Could not copy—select the password field and copy manually.',
                    )
                  })()
                }}
              >
                Copy
              </button>
              <button
                type="button"
                className="text-xs font-medium text-amber-900/80 underline dark:text-amber-200/90"
                onClick={() => setCredentialToShare(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-600">
          {teamUsers.map((u) => {
            const adminCount = teamUsers.filter((x) => x.role === 'admin').length
            const expanded = rosterExpanded[u.id] ?? false
            return (
              <li key={u.id} className="text-sm">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-expanded={expanded}
                    title={expanded ? 'Collapse' : 'Expand'}
                    aria-label={expanded ? 'Collapse details' : 'Expand details'}
                    onClick={() =>
                      setRosterExpanded((prev) => ({
                        ...prev,
                        [u.id]: !expanded,
                      }))
                    }
                  >
                    <i
                      className={`fa-solid ${expanded ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs`}
                      aria-hidden
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {u.displayName}
                    </span>
                    <span className="ml-2 text-slate-500 dark:text-slate-400">
                      @{u.username}
                    </span>
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        u.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {u.role}
                    </span>
                    {u.mustChangePassword ? (
                      <span className="ml-2 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        Must change password
                      </span>
                    ) : null}
                  </div>
                </div>
                {expanded ? (
                  <div className="space-y-3 border-t border-slate-100 px-3 pb-3 pt-2 dark:border-slate-800">
                    <MemberIdentityEditor
                      u={u}
                      teamId={teamId}
                      fieldClass={field}
                      adminUpdateTeamMemberIdentity={
                        adminUpdateTeamMemberIdentity
                      }
                      onMessage={setUserMsg}
                    />
                    <div className="w-full max-w-lg">
                      <label className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        Slack Chat URL (optional)
                      </label>
                      <input
                        className={`${field} mt-0.5 max-w-full font-mono text-[11px]`}
                        defaultValue={u.slackChatUrl ?? ''}
                        key={`${u.id}-slack-${u.slackChatUrl ?? ''}`}
                        placeholder="Example: https://adobe.enterprise.slack.com/archives/D03LAMQPDEW"
                        onBlur={(e) => {
                          const r = setUserSlackChatUrl(
                            teamId,
                            u.id,
                            e.target.value,
                          )
                          if (!r.ok) setUserMsg(r.error)
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                        onClick={() => {
                          if (
                            !confirm(
                              `Issue a one-time temporary password for @${u.username}? Share it securely offline; they must choose a new password at sign-in.`,
                            )
                          ) {
                            return
                          }
                          const r = adminIssueTemporaryPassword(teamId, u.id)
                          if (!r.ok) {
                            setUserMsg(r.error)
                            return
                          }
                          setUserMsg(null)
                          setCredentialToShare({
                            variant: 'temp-reset',
                            username: u.username,
                            displayName: u.displayName,
                            password: r.temporaryPassword,
                          })
                          void pushTrackerSnapshotNow()
                        }}
                      >
                        Issue temp password
                      </button>
                      {u.role === 'member' ? (
                        <button
                          type="button"
                          className="rounded border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-200 dark:hover:bg-indigo-950/60"
                          onClick={() => setUserRole(teamId, u.id, 'admin')}
                        >
                          Make admin
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                          disabled={adminCount <= 1}
                          onClick={() => setUserRole(teamId, u.id, 'member')}
                        >
                          Remove admin
                        </button>
                      )}
                      <button
                        type="button"
                        className="rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/50"
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
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        </div>
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        id="jira-integration"
        title="Jira integration"
        subtitle="Base URL, JQL, PAT on server, sync"
        openWhenHash="#jira-integration"
      >
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Keys on work items open as <span className="font-mono">base + KEY</span>
          .
        </p>
        <input
          className={field}
          value={jiraBaseUrl}
          onChange={(e) => setJiraBaseUrl(teamId, e.target.value)}
          placeholder="https://jira.example.com/browse/"
        />
        <p className="text-xs text-slate-600 dark:text-slate-300">
          PAT and sync run on the <strong>Node server</strong> only (not in the
          browser). Production builds use{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
            VITE_SYNC_SAME_ORIGIN
          </code>{' '}
          so
          the UI and API share one public URL. See{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
            docs/JIRA Integration Architecture.md
          </code>
          .
        </p>
        {!hasSyncServer ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
            Enable sync in the build (<code className="font-mono">VITE_SYNC_SAME_ORIGIN=true</code>{' '}
            or <code className="font-mono">VITE_SYNC_API_URL</code>) so Jira sync can
            reach the server.
          </p>
        ) : null}
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
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
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          onClick={() => {
            setJiraSyncJql(teamId, jiraDraftJql)
            setJiraMsg('JQL saved for this team.')
          }}
        >
          Save JQL
        </button>
        <label className="mt-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">
          Jira Sprint field id (optional)
        </label>
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Custom field id for the Sprint field (e.g.{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
            customfield_11002
          </code>
          ). Leave
          empty to skip sprint mapping. Find it in Jira issue JSON or Fields admin.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <input
            className={`${field} max-w-md font-mono text-xs`}
            placeholder="customfield_11002"
            value={jiraDraftSprintField}
            onChange={(e) => setJiraDraftSprintField(e.target.value)}
          />
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
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
          <p className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">Token status:</span> {jiraTokenStatus}
          </p>
        ) : null}
        {jiraMsg ? (
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {jiraMsg}
          </p>
        ) : null}
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Export & import"
        subtitle="Full JSON backup / restore (includes passwords)"
      >
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Export is a <strong>full snapshot</strong> (schema v3): every team, each
          team&apos;s sprints, work items, roster, Slack DM map, JIRA
          base URL, and all user
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
            className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
                ? 'text-sm font-medium text-emerald-700 dark:text-emerald-400'
                : 'text-sm font-medium text-rose-700 dark:text-rose-400'
            }
          >
            {importMsg}
          </p>
        ) : null}
      </CollapsibleSettingsSection>

      <CollapsibleSettingsSection
        title="Your password"
        subtitle={`Signed in as @${user.username}`}
      >
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Change the password for your account.
        </p>
        <Link
          to="/change-password"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          Change password
        </Link>
      </CollapsibleSettingsSection>
    </div>
  )
}

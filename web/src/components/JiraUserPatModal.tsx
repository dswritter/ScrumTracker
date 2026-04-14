import { useCallback, useState } from 'react'
import { useDismissOnEscape } from '../hooks/useDismissOnEscape'
import { postJiraUserToken } from '../lib/jiraApi'

export function JiraUserPatModal({
  open,
  onClose,
  username,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  username: string
  onSaved: () => void | Promise<void>
}) {
  const close = useCallback(() => onClose(), [onClose])
  useDismissOnEscape(open, close)

  const [pat, setPat] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (!open) return null

  const field =
    'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Save Jira personal access token"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className="max-h-[min(90vh,520px)] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Your Jira access
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Save a Jira PAT for your login <span className="font-mono">{username}</span>.
            It is stored on the sync server (like the team admin token) and used only for
            your sync. Add an expiry date to get reminders when it is close.
          </p>
        </div>

        <div className="space-y-3 px-4 py-3 text-sm">
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Personal access token
            </label>
            <input
              className={`${field} font-mono text-xs`}
              type="password"
              autoComplete="off"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Paste PAT"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Expires (optional, for reminders)
            </label>
            <input
              className={field}
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          {msg ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">{msg}</p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={close}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !pat.trim()}
              className="rounded-lg border border-[#0052CC]/40 bg-[#0052CC]/10 px-3 py-2 text-xs font-semibold text-[#0052CC] hover:bg-[#0052CC]/15 disabled:opacity-50 dark:text-sky-300"
              onClick={async () => {
                setMsg(null)
                setSaving(true)
                try {
                  const exp = expiresAt.trim()
                  const res = await postJiraUserToken(
                    username,
                    pat.trim(),
                    exp ? `${exp}T12:00:00.000Z` : undefined,
                  )
                  if (!res.ok) {
                    setMsg(await res.text())
                    return
                  }
                  setPat('')
                  setExpiresAt('')
                  await onSaved()
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Request failed')
                } finally {
                  setSaving(false)
                }
              }}
            >
              {saving ? 'Saving…' : 'Save & sync'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

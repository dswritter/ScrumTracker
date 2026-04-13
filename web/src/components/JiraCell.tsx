import { useState } from 'react'
import type { WorkItem } from '../types'

function jiraHref(base: string, key: string): string {
  const b = base.trim().replace(/\/$/, '')
  if (!b) return '#'
  return `${b}/${key}`
}

const KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i

export function JiraCell({
  item,
  jiraBaseUrl,
  canEdit,
  onChangeKeys,
}: {
  item: WorkItem
  jiraBaseUrl: string
  canEdit: boolean
  onChangeKeys: (keys: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const removeKey = (key: string) => {
    onChangeKeys(item.jiraKeys.filter((k) => k !== key))
  }

  const addDraft = () => {
    const raw = draft.trim()
    if (!raw) return
    const parts = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)
    const merged = [...item.jiraKeys]
    for (const p of parts) {
      const k = p.toUpperCase()
      if (KEY_RE.test(k) && !merged.includes(k)) merged.push(k)
    }
    onChangeKeys(merged)
    setDraft('')
  }

  return (
    <div className="isolate max-w-[220px]">
      <div className="flex flex-wrap gap-1">
        {item.jiraKeys.map((k) => (
          <span
            key={k}
            className="group relative z-10 inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-900 ring-1 ring-indigo-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-600"
          >
            {jiraBaseUrl.trim() ? (
              <a
                href={jiraHref(jiraBaseUrl, k)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline dark:text-sky-100"
              >
                {k}
              </a>
            ) : (
              k
            )}
            {canEdit ? (
              <button
                type="button"
                title="Remove"
                className="absolute -right-1 -top-1 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-rose-600"
                onClick={() => removeKey(k)}
              >
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {canEdit ? (
        <div className="mt-1 flex gap-1">
          <input
            className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-900 shadow-sm"
            placeholder="JIRA ID"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDraft()
              }
            }}
          />
          <button
            type="button"
            className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-800 hover:bg-slate-100"
            onClick={addDraft}
          >
            Add
          </button>
        </div>
      ) : null}
    </div>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { useDismissOnEscape } from '../hooks/useDismissOnEscape'
import { sprintsSortedNewestFirst } from '../lib/sdates'
import type { Sprint, WorkItem } from '../types'

export function SprintPickerCell({
  item,
  sprints,
  canEdit,
  onChangeSprintIds,
}: {
  item: WorkItem
  sprints: Sprint[]
  canEdit: boolean
  onChangeSprintIds: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const close = useCallback(() => setOpen(false), [])
  useDismissOnEscape(open, close)

  const sorted = useMemo(() => sprintsSortedNewestFirst(sprints), [sprints])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return sorted
    return sorted.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        s.start.includes(t) ||
        s.end.includes(t),
    )
  }, [sorted, q])

  const selected = new Set(item.sprintIds)
  const selectedList = sorted.filter((s) => selected.has(s.id))
  const maxChips = 2
  const chips = selectedList.slice(0, maxChips)
  const more = Math.max(0, selectedList.length - maxChips)

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChangeSprintIds([...next])
  }

  return (
    <div className="relative max-w-[200px]">
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => canEdit && setOpen(true)}
        className="flex w-full flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-left text-[10px] text-slate-700 hover:bg-slate-100 disabled:cursor-default disabled:opacity-60"
      >
        {selectedList.length === 0 ? (
          <span className="text-slate-400">Sprints…</span>
        ) : (
          <>
            {chips.map((s) => (
              <span
                key={s.id}
                className="max-w-[72px] truncate rounded bg-white px-1 py-0.5 ring-1 ring-slate-200"
                title={s.name}
              >
                {s.emoji ?? ''} {s.name}
              </span>
            ))}
            {more > 0 ? (
              <span className="font-semibold text-slate-600">+{more}</span>
            ) : null}
          </>
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Select sprints"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div
            className="max-h-[min(80vh,520px)] w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900">Sprints</h3>
              <input
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                placeholder="Search by name or date…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-72 overflow-y-auto px-2 py-2">
              {filtered.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span>
                    <span className="font-semibold text-slate-900">
                      {s.emoji ?? ''} {s.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {s.start} → {s.end}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                onClick={close}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

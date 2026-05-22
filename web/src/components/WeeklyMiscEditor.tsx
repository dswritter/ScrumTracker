import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/ids'
import type { WeeklyMiscLine } from '../types'

function newLine(depth = 0): WeeklyMiscLine {
  return {
    id: `wml-${generateId().slice(0, 12)}`,
    text: '',
    done: false,
    depth: Math.max(0, Math.min(8, depth)),
  }
}

function cloneLines(lines: WeeklyMiscLine[]): WeeklyMiscLine[] {
  return lines.map((l) => ({ ...l }))
}

export function WeeklyMiscEditor({
  weekKey,
  personDisplayName,
  initialLines,
  readOnly,
  onSave,
  onPromoteLineToTask,
}: {
  weekKey: string
  personDisplayName: string
  initialLines: WeeklyMiscLine[]
  readOnly: boolean
  onSave: (lines: WeeklyMiscLine[]) => void
  /** When set, non-empty lines can be turned into tracker work items in one click. */
  onPromoteLineToTask?: (line: WeeklyMiscLine) => void
}) {
  const [lines, setLines] = useState<WeeklyMiscLine[]>(() =>
    initialLines.length ? cloneLines(initialLines) : [newLine(0)],
  )
  /**
   * Real browsers return a numeric handle; with `@types/node`, `window.setTimeout` is often
   * typed as `NodeJS.Timeout`, so we store an explicit `number` and cast the return value.
   */
  const saveTimer = useRef<number | null>(null)

  const flushSave = useCallback(
    (next: WeeklyMiscLine[]) => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null
        onSave(next)
      }, 450) as unknown as number
    },
    [onSave],
  )

  /** Reload local draft only when switching week or person (not on every persist from parent). */
  useEffect(() => {
    setLines(initialLines.length ? cloneLines(initialLines) : [newLine(0)])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialLines intentionally omitted
  }, [weekKey, personDisplayName])

  useEffect(
    () => () => {
      if (saveTimer.current != null) window.clearTimeout(saveTimer.current)
    },
    [],
  )

  const updateLine = (id: string, patch: Partial<WeeklyMiscLine>) => {
    if (readOnly) return
    setLines((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
      flushSave(next)
      return next
    })
  }

  const setLinesImmediate = (next: WeeklyMiscLine[]) => {
    if (readOnly) return
    setLines(next)
    flushSave(next)
  }

  const insertAfter = (index: number, depth: number) => {
    if (readOnly) return
    setLines((prev) => {
      const next = [...prev]
      next.splice(index + 1, 0, newLine(depth))
      flushSave(next)
      return next
    })
  }

  const removeAt = (index: number) => {
    if (readOnly) return
    setLines((prev) => {
      if (prev.length <= 1) {
        const next = [newLine(0)]
        flushSave(next)
        return next
      }
      const next = prev.filter((_, i) => i !== index)
      flushSave(next)
      return next
    })
  }

  return (
    <div className="mt-4 border-t border-slate-200/70 pt-3 dark:border-slate-600/60">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Miscellaneous (this week)
        </p>
        {!readOnly ? (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            Tab / Shift+Tab indent · Enter new line
            {onPromoteLineToTask ? ' · Arrow: make task' : ''}
          </span>
        ) : null}
      </div>
      <ul className="m-0 list-none space-y-1.5 p-0">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className="flex items-start gap-2"
            style={{ paddingLeft: `${line.depth * 14}px` }}
          >
            <input
              type="checkbox"
              className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[#00B050] focus:ring-[#00B050] dark:border-slate-600"
              checked={line.done}
              disabled={readOnly}
              onChange={(e) => updateLine(line.id, { done: e.target.checked })}
              aria-label={`Done: ${line.text || 'line'}`}
            />
            <input
              type="text"
              className="min-w-0 flex-1 rounded border border-transparent bg-white/80 px-1.5 py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#00B050]/50 focus:outline-none focus:ring-1 focus:ring-[#00B050]/30 disabled:bg-transparent dark:bg-slate-900/40 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Quick update…"
              value={line.text}
              disabled={readOnly}
              onChange={(e) => updateLine(line.id, { text: e.target.value })}
              onKeyDown={(e) => {
                if (readOnly) return
                if (e.key === 'Tab') {
                  e.preventDefault()
                  const delta = e.shiftKey ? -1 : 1
                  const nextDepth = Math.max(
                    0,
                    Math.min(8, line.depth + delta),
                  )
                  updateLine(line.id, { depth: nextDepth })
                  return
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  insertAfter(index, line.depth)
                  return
                }
                if (e.key === 'Backspace' && line.text === '') {
                  e.preventDefault()
                  removeAt(index)
                }
              }}
            />
            {!readOnly && onPromoteLineToTask && line.text.trim() ? (
              <button
                type="button"
                className="mt-1 shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold text-slate-500 opacity-80 hover:bg-slate-200/90 hover:text-[#00B050] hover:opacity-100 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-emerald-300"
                title="Create work item from this line — open it to link Jira"
                aria-label="Create work item from line"
                onClick={() => onPromoteLineToTask(line)}
              >
                <i className="fa-solid fa-square-arrow-up-right" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {!readOnly ? (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-[#00B050]/50 hover:bg-white/80 dark:border-slate-600 dark:text-slate-200 dark:hover:border-emerald-700/60"
          onClick={() =>
            setLinesImmediate([...lines, newLine(lines[lines.length - 1]?.depth ?? 0)])
          }
        >
          <i className="fa-solid fa-plus text-[10px]" aria-hidden />
          Add line
        </button>
      ) : null}
    </div>
  )
}

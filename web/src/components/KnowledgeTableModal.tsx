import { useState } from 'react'

/** rows = number of data rows (below header); cols = columns. */
function buildTableMarkdown(dataRows: number, cols: number): string {
  const dr = Math.min(30, Math.max(1, dataRows))
  const c = Math.min(12, Math.max(2, cols))
  const header = `| ${Array.from({ length: c }, (_, i) => `Col ${i + 1}`).join(' | ')} |`
  const sep = `| ${Array.from({ length: c }, () => '---').join(' | ')} |`
  const body = Array.from(
    { length: dr },
    () => `| ${Array.from({ length: c }, () => ' ').join(' | ')} |`,
  ).join('\n')
  return `\n${header}\n${sep}\n${body}\n\n`
}

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (markdown: string) => void
}

export function KnowledgeTableModal({ open, onClose, onInsert }: Props) {
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(3)

  if (!open) return null

  const insert = () => {
    onInsert(buildTableMarkdown(rows, cols))
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kb-table-dialog-title"
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="kb-table-dialog-title"
          className="text-sm font-bold text-slate-900 dark:text-slate-100"
        >
          Insert table
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Choose size. After inserting, edit cell text in the page—headings and quotes inside cells are cleaned automatically.
        </p>
        <div className="mt-3 flex gap-3">
          <label className="block flex-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
            Data rows
            <input
              type="number"
              min={1}
              max={30}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="block flex-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
            Columns
            <input
              type="number"
              min={2}
              max={12}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value) || 2)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={insert}
            className="rounded-lg bg-[#00B050] px-3 py-1.5 text-xs font-bold text-white"
          >
            Insert table
          </button>
        </div>
      </div>
    </div>
  )
}

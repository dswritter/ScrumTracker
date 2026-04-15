import { useMemo, useState } from 'react'

const MIN_COLS = 2
const MAX_COLS = 12
const MAX_DATA_ROWS = 30

function createGrid(dataRows: number, cols: number): string[][] {
  const c = Math.min(MAX_COLS, Math.max(MIN_COLS, cols))
  const dr = Math.min(MAX_DATA_ROWS, Math.max(1, dataRows))
  const header = Array.from({ length: c }, (_, i) => `Col ${i + 1}`)
  return [header, ...Array.from({ length: dr }, () => Array(c).fill(''))]
}

function gridToMarkdown(grid: string[][]): string {
  if (grid.length < 1) return '\n'
  const esc = (s: string) =>
    s
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ')
      .trim()
  const header = grid[0]!
  const lines: string[] = []
  lines.push(`| ${header.map((cell) => esc(cell)).join(' | ')} |`)
  lines.push(`| ${header.map(() => '---').join(' | ')} |`)
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!
    lines.push(`| ${row.map((cell) => esc(cell)).join(' | ')} |`)
  }
  return `\n${lines.join('\n')}\n\n`
}

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (markdown: string) => void
}

export function KnowledgeTableModal({ open, onClose, onInsert }: Props) {
  const [grid, setGrid] = useState<string[][]>(() => createGrid(3, 3))

  const colCount = grid[0]?.length ?? 0

  const canRemoveCol = colCount > MIN_COLS
  const canRemoveRow = grid.length > 2

  const updateCell = (row: number, col: number, value: string) => {
    setGrid((g) => {
      const next = g.map((r) => [...r])
      if (!next[row]) return g
      next[row]![col] = value
      return next
    })
  }

  const addRowAfter = (rowIndex: number) => {
    setGrid((g) => {
      const c = g[0]?.length ?? MIN_COLS
      const empty = Array(c).fill('')
      const next = g.map((r) => [...r])
      next.splice(rowIndex + 1, 0, empty)
      if (next.length > 1 + MAX_DATA_ROWS) return g
      return next
    })
  }

  const removeRow = (rowIndex: number) => {
    if (rowIndex < 1 || !canRemoveRow) return
    setGrid((g) => g.filter((_, i) => i !== rowIndex))
  }

  const addColAfter = (colIndex: number) => {
    setGrid((g) => {
      if ((g[0]?.length ?? 0) >= MAX_COLS) return g
      return g.map((row, ri) => {
        const copy = [...row]
        const insert =
          ri === 0 ? `Col ${copy.length + 1}` : ''
        copy.splice(colIndex + 1, 0, insert)
        return copy
      })
    })
  }

  const removeCol = (colIndex: number) => {
    if (!canRemoveCol) return
    setGrid((g) => g.map((row) => row.filter((_, j) => j !== colIndex)))
  }

  const insert = () => {
    onInsert(gridToMarkdown(grid))
    onClose()
  }

  const headerLabels = useMemo(
    () => grid[0]?.map((_, ci) => `Column ${ci + 1}`) ?? [],
    [grid],
  )

  if (!open) return null

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
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="kb-table-dialog-title"
          className="text-sm font-bold text-slate-900 dark:text-slate-100"
        >
          Insert table
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Edit cells below. Hover row or column edges for + / − to add or remove rows and columns.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-[#f8fdf9] p-3 dark:border-slate-600 dark:bg-emerald-950/30">
          <div className="min-w-0">
            {/* Column controls (top edge) */}
            <div
              className="mb-1 flex gap-0"
              style={{ paddingLeft: '2.25rem' }}
            >
              {headerLabels.map((label, ci) => (
                <div
                  key={ci}
                  className="group/col relative flex min-w-[5.5rem] flex-1 justify-center px-0.5"
                >
                  <span className="pointer-events-none text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {label}
                  </span>
                  <div className="pointer-events-auto absolute -top-0.5 left-1/2 z-10 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded-md border border-slate-200 bg-white px-0.5 py-0.5 opacity-0 shadow-sm transition-opacity group-hover/col:opacity-100 dark:border-slate-600 dark:bg-slate-800">
                    <button
                      type="button"
                      title="Remove column"
                      disabled={!canRemoveCol}
                      onClick={() => removeCol(ci)}
                      className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30 dark:text-rose-400 dark:hover:bg-rose-950/50"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      title="Add column after"
                      onClick={() => addColAfter(ci)}
                      className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-[#007a3d] hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <table className="w-full border-collapse text-sm">
              <tbody>
                {grid.map((row, ri) => (
                  <tr
                    key={ri}
                    className="group/row border-b border-slate-200/80 dark:border-slate-600/80"
                  >
                    <td className="w-9 align-middle pr-1">
                      {ri >= 1 ? (
                        <div className="flex flex-col items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
                          <button
                            type="button"
                            title="Remove row"
                            disabled={!canRemoveRow}
                            onClick={() => removeRow(ri)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-xs font-bold text-rose-600 shadow-sm hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-600 dark:bg-slate-800 dark:text-rose-400"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            title="Add row below"
                            onClick={() => addRowAfter(ri)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-xs font-bold text-[#007a3d] shadow-sm hover:bg-emerald-50 dark:border-slate-600 dark:bg-slate-800 dark:text-emerald-300"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          Row
                        </span>
                      )}
                    </td>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="min-w-[5.5rem] border-l border-slate-200/80 px-1 py-1 dark:border-slate-600/80"
                      >
                        <input
                          value={cell}
                          onChange={(e) => updateCell(ri, ci, e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-[#00B050]/50 focus:outline-none focus:ring-1 focus:ring-[#00B050]/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          aria-label={
                            ri === 0
                              ? `Header column ${ci + 1}`
                              : `Row ${ri} column ${ci + 1}`
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

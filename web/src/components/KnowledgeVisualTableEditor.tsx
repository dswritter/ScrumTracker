import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  equalColPct,
  gridToHtmlTable,
  normalizePct,
} from '../lib/knowledgeTableHtml'

const MIN_COLS = 2
const MAX_COLS = 12
const MAX_DATA_ROWS = 30
const MIN_COL_PCT = 8

function createGrid(dataRows: number, cols: number): string[][] {
  const c = Math.min(MAX_COLS, Math.max(MIN_COLS, cols))
  const dr = Math.min(MAX_DATA_ROWS, Math.max(1, dataRows))
  const header = Array.from({ length: c }, (_, i) => `Col ${i + 1}`)
  return [header, ...Array.from({ length: dr }, () => Array(c).fill(''))]
}

type Props = {
  onInsert: (html: string) => void
  onCancel: () => void
}

export function KnowledgeVisualTableEditor({ onInsert, onCancel }: Props) {
  const [grid, setGrid] = useState<string[][]>(() => createGrid(3, 3))
  const [colPct, setColPct] = useState<number[]>(() => equalColPct(3))
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    i: number
    startX: number
    startPct: number[]
  } | null>(null)

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
      const next = g.map((row, ri) => {
        const copy = [...row]
        const insert = ri === 0 ? `Col ${copy.length + 1}` : ''
        copy.splice(colIndex + 1, 0, insert)
        return copy
      })
      const n = next[0]!.length
      queueMicrotask(() => setColPct(equalColPct(n)))
      return next
    })
  }

  const removeCol = (colIndex: number) => {
    if (!canRemoveCol) return
    setGrid((g) => g.map((row) => row.filter((_, j) => j !== colIndex)))
    setColPct((p) => {
      const next = p.filter((_, j) => j !== colIndex)
      return normalizePct(next, next.length)
    })
  }

  const onResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = {
        i: colIndex,
        startX: e.clientX,
        startPct: [...normalizePct(colPct, colCount)],
      }
    },
    [colPct, colCount],
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      const wrap = tableWrapRef.current
      if (!d || !wrap) return
      const w = wrap.offsetWidth || 1
      const deltaPct = ((e.clientX - d.startX) / w) * 100
      const i = d.i
      const next = [...d.startPct]
      const a = next[i]! + deltaPct
      const b = next[i + 1]! - deltaPct
      if (a < MIN_COL_PCT || b < MIN_COL_PCT) return
      next[i] = a
      next[i + 1] = b
      setColPct(normalizePct(next, next.length))
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const headerLabels = useMemo(
    () => grid[0]?.map((_, ci) => `Column ${ci + 1}`) ?? [],
    [grid],
  )

  const insert = () => {
    onInsert(gridToHtmlTable(grid, colPct))
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Insert table
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Edit cells; hover column headers for + / −. Drag vertical lines between headers to resize columns. Hover row labels for row + / −.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={insert}
            className="rounded-lg px-3 py-1.5 text-xs font-bold text-[#007a3d] hover:underline dark:text-emerald-300"
          >
            Insert table
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-[#f8fdf9] p-3 dark:border-slate-600 dark:bg-emerald-950/30">
        <div className="min-w-0">
          <div
            className="mb-1 flex w-full min-w-0"
            style={{ paddingLeft: '2.25rem' }}
          >
            {headerLabels.map((label, ci) => {
              const p = normalizePct(colPct, colCount)[ci]!
              return (
                <div
                  key={ci}
                  className="group/col relative flex min-w-0 justify-center px-0.5"
                  style={{ width: `${p}%` }}
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
              )
            })}
          </div>

          <div ref={tableWrapRef}>
            <table className="w-full table-fixed border-collapse text-sm">
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
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30 dark:text-rose-400"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            title="Add row below"
                            onClick={() => addRowAfter(ri)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold text-[#007a3d] hover:bg-emerald-50 dark:text-emerald-300"
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
                        className="relative border-l border-slate-200/80 px-1 py-1 align-top dark:border-slate-600/80"
                        style={{ width: `${normalizePct(colPct, colCount)[ci]!}%` }}
                      >
                        {ri === 0 && ci < row.length - 1 ? (
                          <button
                            type="button"
                            aria-label={`Resize column ${ci + 1}`}
                            onMouseDown={(e) => onResizeStart(ci, e)}
                            className="absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize rounded-sm hover:bg-[#00B050]/25"
                          />
                        ) : null}
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
      </div>
    </div>
  )
}

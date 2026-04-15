/** Serialize grid to a sanitized HTML table (KB markdown / preview). */
export function gridToHtmlTable(grid: string[][], colPct: number[]): string {
  if (grid.length < 1) return '\n'
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  const header = grid[0]!
  const n = header.length
  const pct = normalizePct(colPct, n)
  const colgroup = `<colgroup>${pct.map((p) => `<col style="width:${p.toFixed(2)}%" />`).join('')}</colgroup>`
  const head = `<thead><tr>${header.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`
  const bodyRows = grid
    .slice(1)
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`,
    )
    .join('')
  return `\n<table class="kb-html-table">${colgroup}${head}<tbody>${bodyRows}</tbody></table>\n\n`
}

export function equalColPct(n: number): number[] {
  if (n <= 0) return []
  const base = 100 / n
  return Array.from({ length: n }, () => Math.round(base * 100) / 100)
}

export function normalizePct(pct: number[], n: number): number[] {
  if (pct.length !== n) return equalColPct(n)
  const sum = pct.reduce((a, b) => a + b, 0)
  if (sum <= 0) return equalColPct(n)
  return pct.map((p) => (p / sum) * 100)
}

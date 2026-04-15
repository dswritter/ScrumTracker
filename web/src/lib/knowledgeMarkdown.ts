/** Markdown helpers for team knowledge (tables, task lists, search ranking). */

const TABLE_ROW = /^\s*\|(.+)\|\s*$/
const TABLE_SEP = /^\s*\|[\s\-:|]+\|\s*$/

function isTableLine(line: string): boolean {
  return TABLE_ROW.test(line) && line.includes('|')
}

function extractTableRows(lines: string[], start: number): string[] {
  const chunk: string[] = []
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') break
    if (isTableLine(line) || TABLE_SEP.test(line)) chunk.push(line)
    else break
  }
  return chunk.length >= 2 ? chunk : []
}

function splitTableCells(row: string): string[] {
  const inner = row.replace(/^\s*\|/, '').replace(/\|\s*$/, '')
  return inner.split('|')
}

function sanitizeCellContent(raw: string): string {
  let s = raw.trim()
  s = s.replace(/^#{1,6}\s+/u, '')
  s = s.replace(/^>\s*/, '')
  if (/^(\*{3,}|-{3,}|_{3,})\s*$/u.test(s)) s = ''
  return s
}

function sanitizeTableRowLine(line: string, isSeparator: boolean): string {
  if (isSeparator || !TABLE_ROW.test(line)) return line
  const cells = splitTableCells(line)
  if (cells.length < 2) return line
  const next = cells.map((c) => sanitizeCellContent(c))
  return `| ${next.join(' | ')} |`
}

/**
 * Strips heading, blockquote, and HR-only patterns inside GFM pipe tables
 * (does not modify fenced code blocks).
 */
export function sanitizeTableCellsInMarkdown(body: string): string {
  const lines = body.split('\n')
  const out: string[] = []
  let i = 0
  let fence: string | null = null

  while (i < lines.length) {
    const line = lines[i]
    const fenceStart = line.match(/^(\s*)(```|~~~)/)
    if (fence) {
      out.push(line)
      if (fenceStart && fenceStart[2] === fence) fence = null
      i++
      continue
    }
    if (fenceStart) {
      fence = fenceStart[2]
      out.push(line)
      i++
      continue
    }

    if (isTableLine(line)) {
      const block = extractTableRows(lines, i)
      if (block.length >= 2) {
        block.forEach((row) => {
          const isSep = TABLE_SEP.test(row)
          out.push(sanitizeTableRowLine(row, isSep))
        })
        i += block.length
        continue
      }
    }

    out.push(line)
    i++
  }

  return out.join('\n')
}

const TASK_LINE = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/

/** Toggle the n-th GFM task list item (0-based among all task lines). */
export function toggleNthTaskListItem(source: string, n: number): string | null {
  const lines = source.split('\n')
  let seen = 0
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TASK_LINE)
    if (m) {
      if (seen === n) {
        const checked = m[2].toLowerCase() === 'x'
        const mark = checked ? ' ' : 'x'
        lines[i] = `${m[1]}- [${mark}] ${m[3]}`
        return lines.join('\n')
      }
      seen++
    }
  }
  return null
}

export function knowledgeMatchScore(
  query: string,
  title: string,
  body: string,
): number {
  const n = query.trim().toLowerCase()
  if (!n) return 0
  let s = 0
  const blob = `${title}\n${body}`.toLowerCase()
  const t = title.toLowerCase()
  if (blob.includes(n)) s += 100
  const words = n.split(/\s+/).filter((w) => w.length > 1)
  for (const w of words) {
    if (t.includes(w)) s += 8
    else if (blob.includes(w)) s += 2
  }
  for (let i = 0; i <= n.length - 3; i++) {
    const tri = n.slice(i, i + 3)
    if (tri.length === 3 && /\S/.test(tri) && blob.includes(tri)) s += 1.5
  }
  return s
}

export function rankKnowledgePagesByQuery<
  T extends { title: string; body: string },
>(query: string, pages: T[], limit = 6): { page: T; score: number }[] {
  const scored = pages
    .map((page) => ({
      page,
      score: knowledgeMatchScore(query, page.title, page.body),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

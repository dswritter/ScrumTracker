import {
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { jsPDF } from 'jspdf'
import { itemDetailPath } from './workItemRoutes'
import {
  buildBulletTree,
  isCommentSeparator,
  type BulletTreeNode,
  type WeeklyProgressCard,
  type WeeklyProgressPersonBundle,
} from './weeklyProgress'

export type WeeklyReportMeta = {
  weekLabel: string
  teamName?: string
  scopeLabel?: string
}

function authorLineVisible(authorRaw: string, personName: string): boolean {
  const chunks = authorRaw
    .split('·')
    .map((s) => s.trim())
    .filter(Boolean)
  if (chunks.length > 1) return true
  return chunks[0] !== personName.trim()
}

function sourceLabel(c: WeeklyProgressCard): string {
  if (c.source === 'mixed') return 'Jira + Tracker'
  return c.source === 'jira' ? 'Jira' : 'Tracker'
}

function segmentsFromBulletLines(
  lines: WeeklyProgressCard['bulletLines'],
): Array<Array<{ depth: number; text: string }>> {
  const segments: Array<Array<{ depth: number; text: string }>> = []
  let cur: Array<{ depth: number; text: string }> = []
  for (const L of lines) {
    if (isCommentSeparator(L)) {
      if (cur.length) segments.push(cur)
      cur = []
    } else {
      cur.push(L)
    }
  }
  if (cur.length) segments.push(cur)
  return segments
}

function bulletTreeToDocxParagraphs(
  nodes: BulletTreeNode[],
  depth: number,
): Paragraph[] {
  const out: Paragraph[] = []
  const dxa = Math.min(depth, 8) * 360
  for (const n of nodes) {
    out.push(
      new Paragraph({
        indent: { left: dxa },
        children: [new TextRun({ text: `• ${n.text}` })],
      }),
    )
    out.push(...bulletTreeToDocxParagraphs(n.children, depth + 1))
  }
  return out
}

function bulletTreeToPdfLines(nodes: BulletTreeNode[], depth: number): string[] {
  const lines: string[] = []
  for (const n of nodes) {
    lines.push(`${'  '.repeat(depth)}• ${n.text}`)
    lines.push(...bulletTreeToPdfLines(n.children, depth + 1))
  }
  return lines
}

function workItemUrl(origin: string, itemId: string): string {
  const base = origin.trim().replace(/\/$/, '')
  return `${base}${itemDetailPath(itemId)}`
}

function sanitizeFilenamePart(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'report'
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function downloadWeeklyProgressDocx(
  bundles: WeeklyProgressPersonBundle[],
  meta: WeeklyReportMeta,
  origin: string,
  weekKeyForName: string,
): Promise<void> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: 'Weekly progress report' })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Week: ${meta.weekLabel}`, bold: true }),
      ],
    }),
  ]
  if (meta.teamName?.trim()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Team: ${meta.teamName.trim()}` })],
      }),
    )
  }
  if (meta.scopeLabel?.trim()) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Scope: ${meta.scopeLabel.trim()}` })],
      }),
    )
  }
  children.push(new Paragraph({ children: [] }))

  for (const b of bundles) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: b.personName })],
      }),
    )

    for (const c of b.tasks) {
      if (b.tasks.length > 1) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Date: ${c.dateLabel}`, italics: true }),
            ],
          }),
        )
      }
      if (authorLineVisible(c.authorRaw, c.personName)) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Comment by ${c.authorRaw}`,
                italics: true,
              }),
            ],
          }),
        )
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Section: ${c.section || '—'} · ` }),
            new TextRun({ text: sourceLabel(c), bold: true }),
          ],
        }),
      )

      const taskUrl = workItemUrl(origin, c.itemId)
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Task: ' }),
            new ExternalHyperlink({
              link: taskUrl,
              children: [
                new TextRun({
                  text: c.itemTitle.trim() || '(untitled)',
                  style: 'Hyperlink',
                }),
              ],
            }),
          ],
        }),
      )

      const segments = segmentsFromBulletLines(c.bulletLines)
      for (let si = 0; si < segments.length; si++) {
        if (si > 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: '—' })] }))
        }
        const tree = buildBulletTree(segments[si]!)
        children.push(...bulletTreeToDocxParagraphs(tree, 0))
      }

      if (c.jiraLinks.length > 0) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: 'Jira:', bold: true })],
          }),
        )
        for (const j of c.jiraLinks) {
          if (j.href && j.href !== '#') {
            children.push(
              new Paragraph({
                children: [
                  new ExternalHyperlink({
                    link: j.href,
                    children: [
                      new TextRun({ text: j.key, style: 'Hyperlink' }),
                    ],
                  }),
                ],
              }),
            )
          } else {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: j.key })],
              }),
            )
          }
        }
      }
      children.push(new Paragraph({ children: [] }))
    }
  }

  const doc = new Document({
    sections: [{ children }],
  })
  const blob = await Packer.toBlob(doc)
  const name = `weekly-report-${sanitizeFilenamePart(weekKeyForName)}.docx`
  triggerDownload(blob, name)
}

export function downloadWeeklyProgressPdf(
  bundles: WeeklyProgressPersonBundle[],
  meta: WeeklyReportMeta,
  origin: string,
  weekKeyForName: string,
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const margin = 48
  const pageH = doc.internal.pageSize.getHeight()
  const pageW = doc.internal.pageSize.getWidth()
  const maxW = pageW - 2 * margin
  let y = margin
  const lineH = 13
  const titleH = 18

  function ensureSpace(h: number) {
    if (y + h > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  function addParagraph(text: string, opts?: { bold?: boolean; size?: number }) {
    const size = opts?.size ?? 10
    doc.setFontSize(size)
    if (opts?.bold) doc.setFont('helvetica', 'bold')
    else doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, maxW) as string[]
    for (const line of lines) {
      ensureSpace(lineH)
      doc.text(line, margin, y)
      y += lineH
    }
  }

  addParagraph('Weekly progress report', { bold: true, size: 16 })
  y += 4
  addParagraph(`Week: ${meta.weekLabel}`, { bold: true })
  if (meta.teamName?.trim()) addParagraph(`Team: ${meta.teamName.trim()}`)
  if (meta.scopeLabel?.trim()) addParagraph(`Scope: ${meta.scopeLabel.trim()}`)
  y += 6

  for (const b of bundles) {
    ensureSpace(titleH)
    addParagraph(b.personName, { bold: true, size: 13 })
    y += 4

    for (const c of b.tasks) {
      if (b.tasks.length > 1) {
        addParagraph(`Date: ${c.dateLabel}`, { size: 9 })
      }
      if (authorLineVisible(c.authorRaw, c.personName)) {
        addParagraph(`Comment by ${c.authorRaw}`, { size: 9 })
      }
      addParagraph(
        `Section: ${c.section || '—'} · ${sourceLabel(c)}`,
        { size: 10 },
      )
      const taskUrl = workItemUrl(origin, c.itemId)
      addParagraph(`Task: ${c.itemTitle.trim() || '(untitled)'}`, {
        bold: true,
      })
      addParagraph(taskUrl, { size: 9 })

      const segments = segmentsFromBulletLines(c.bulletLines)
      for (let si = 0; si < segments.length; si++) {
        if (si > 0) {
          addParagraph('—')
        }
        const tree = buildBulletTree(segments[si]!)
        const blines = bulletTreeToPdfLines(tree, 0)
        for (const bl of blines) {
          addParagraph(bl, { size: 10 })
        }
      }

      if (c.jiraLinks.length > 0) {
        addParagraph('Jira:', { bold: true })
        for (const j of c.jiraLinks) {
          const line = j.href && j.href !== '#' ? `${j.key} — ${j.href}` : j.key
          addParagraph(line, { size: 9 })
        }
      }
      y += 8
    }
  }

  const name = `weekly-report-${sanitizeFilenamePart(weekKeyForName)}.pdf`
  doc.save(name)
}

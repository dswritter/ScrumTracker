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
  workStatusLabel,
  type BulletTreeNode,
  type WeeklyProgressCard,
  type WeeklyProgressPersonBundle,
} from './weeklyProgress'
import type { WeeklyMiscChecklist, WeeklyMiscLine } from '../types'

export type WeeklyReportMeta = {
  weekLabel: string
  teamName?: string
  scopeLabel?: string
}

export type WeeklyReportExportOptions = {
  /** Monday key (YYYY-MM-DD) matching weekly UI */
  weekMondayKey: string
  weeklyMiscChecklists?: WeeklyMiscChecklist[]
}

/** Light fills aligned with weekly card shell tints (DOCX hex without #). */
const MEMBER_SECTION_DOCX_FILLS = [
  'EDE9FE',
  'E0F2FE',
  'D1FAE5',
  'FCE7F3',
  'FEF3C7',
]

/** PDF RGB band colors behind each member heading (pastel). */
const MEMBER_SECTION_PDF_RGB: Array<[number, number, number]> = [
  [237, 233, 254],
  [224, 242, 254],
  [209, 250, 229],
  [252, 231, 243],
  [254, 243, 199],
]

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

/** Skip work items with nothing to say for this week (no bullets, no resolved stamp). */
export function weeklyCardHasExportableContent(c: WeeklyProgressCard): boolean {
  if (c.jiraResolvedStampKey) return true
  for (const L of c.bulletLines) {
    if (!isCommentSeparator(L) && L.text.trim()) return true
  }
  return false
}

export function miscLinesForPersonExport(
  checklists: WeeklyMiscChecklist[] | undefined,
  weekMondayKey: string,
  personName: string,
): WeeklyMiscLine[] {
  const needle = personName.trim().toLowerCase()
  const hit = checklists?.find(
    (m) =>
      m.weekMondayKey === weekMondayKey &&
      m.personName.trim().toLowerCase() === needle,
  )
  return hit?.lines ?? []
}

function miscLinesNonEmpty(lines: WeeklyMiscLine[]): WeeklyMiscLine[] {
  return lines.filter((l) => l.text.trim() || l.done)
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

function pushConsolidatedItemDocx(
  children: Paragraph[],
  c: WeeklyProgressCard,
  origin: string,
  personName: string,
): void {
  const taskUrl = workItemUrl(origin, c.itemId)
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Work item: ', bold: true }),
        new ExternalHyperlink({
          link: taskUrl,
          children: [
            new TextRun({
              text: c.itemTitle.trim() || '(untitled)',
              style: 'Hyperlink',
            }),
          ],
        }),
        new TextRun({
          text: `  ·  ${sourceLabel(c)}  ·  ${c.section || 'General'}`,
        }),
      ],
    }),
  )

  const statusBits = [
    `Tracker: ${workStatusLabel(c.itemStatus)}`,
    c.jiraStatusName ? `Jira: ${c.jiraStatusName}` : '',
  ].filter(Boolean)
  children.push(
    new Paragraph({
      children: [new TextRun({ text: statusBits.join(' · '), size: 20 })],
    }),
  )

  if (authorLineVisible(c.authorRaw, personName)) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Comment thread: ${c.authorRaw}`,
            italics: true,
            size: 20,
          }),
        ],
      }),
    )
  }

  if (c.jiraResolvedStampKey) {
    const j = c.jiraLinks.find((x) => x.key === c.jiraResolvedStampKey)
    if (j?.href && j.href !== '#') {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Jira closed · ', size: 20 }),
            new ExternalHyperlink({
              link: j.href,
              children: [
                new TextRun({ text: j.key, style: 'Hyperlink', size: 20 }),
              ],
            }),
          ],
        }),
      )
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Jira closed · ${c.jiraResolvedStampKey}`,
              size: 20,
            }),
          ],
        }),
      )
    }
  }

  const segments = segmentsFromBulletLines(c.bulletLines)
  for (let si = 0; si < segments.length; si++) {
    if (si > 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: '—', italics: true, size: 18 })],
        }),
      )
    }
    const tree = buildBulletTree(segments[si]!)
    children.push(...bulletTreeToDocxParagraphs(tree, 0))
  }

  if (c.jiraLinks.length > 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Jira keys:', bold: true, size: 20 })],
      }),
    )
    for (const j of c.jiraLinks) {
      if (j.href && j.href !== '#') {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            children: [
              new ExternalHyperlink({
                link: j.href,
                children: [
                  new TextRun({ text: j.key, style: 'Hyperlink', size: 20 }),
                ],
              }),
            ],
          }),
        )
      } else {
        children.push(
          new Paragraph({
            indent: { left: 360 },
            children: [new TextRun({ text: j.key, size: 20 })],
          }),
        )
      }
    }
  }

  children.push(new Paragraph({ children: [] }))
}

function pushMiscDocx(children: Paragraph[], lines: WeeklyMiscLine[]): void {
  if (lines.length === 0) return
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun({ text: 'Miscellaneous (this week)', bold: true })],
    }),
  )
  for (const line of lines) {
    const prefix = line.done ? '☑ ' : '☐ '
    const pad = '  '.repeat(Math.min(line.depth, 8))
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${pad}${prefix}${line.text.trim() || '(empty line)'}`,
          }),
        ],
      }),
    )
  }
  children.push(new Paragraph({ children: [] }))
}

export async function downloadWeeklyProgressDocx(
  bundles: WeeklyProgressPersonBundle[],
  meta: WeeklyReportMeta,
  origin: string,
  weekKeyForName: string,
  opts?: WeeklyReportExportOptions,
): Promise<void> {
  const weekMondayKey = opts?.weekMondayKey ?? weekKeyForName
  const miscAll = opts?.weeklyMiscChecklists

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

  let memberIdx = 0
  for (const b of bundles) {
    const tasks = b.tasks
      .filter(weeklyCardHasExportableContent)
      .sort((a, x) => a.createdAt.localeCompare(x.createdAt))
    const misc = miscLinesNonEmpty(
      miscLinesForPersonExport(miscAll, weekMondayKey, b.personName),
    )
    if (tasks.length === 0 && misc.length === 0) continue

    const fill = MEMBER_SECTION_DOCX_FILLS[memberIdx % MEMBER_SECTION_DOCX_FILLS.length]!
    memberIdx++

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        shading: { fill },
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: b.personName, bold: true, size: 28 })],
      }),
    )

    for (const c of tasks) {
      pushConsolidatedItemDocx(children, c, origin, b.personName)
    }
    pushMiscDocx(children, misc)
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
  opts?: WeeklyReportExportOptions,
): void {
  const weekMondayKey = opts?.weekMondayKey ?? weekKeyForName
  const miscAll = opts?.weeklyMiscChecklists

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
      doc.setTextColor(0, 0, 0)
      doc.text(line, margin, y)
      y += lineH
    }
  }

  function addMemberBanner(name: string, rgb: [number, number, number]) {
    ensureSpace(titleH + 8)
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.rect(margin, y - 2, maxW, titleH + 6, 'F')
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(name, margin + 6, y + titleH - 2)
    y += titleH + 10
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)
  }

  addParagraph('Weekly progress report', { bold: true, size: 16 })
  y += 4
  addParagraph(`Week: ${meta.weekLabel}`, { bold: true })
  if (meta.teamName?.trim()) addParagraph(`Team: ${meta.teamName.trim()}`)
  if (meta.scopeLabel?.trim()) addParagraph(`Scope: ${meta.scopeLabel.trim()}`)
  y += 6

  let memberIdx = 0
  for (const b of bundles) {
    const tasks = b.tasks
      .filter(weeklyCardHasExportableContent)
      .sort((a, x) => a.createdAt.localeCompare(x.createdAt))
    const misc = miscLinesNonEmpty(
      miscLinesForPersonExport(miscAll, weekMondayKey, b.personName),
    )
    if (tasks.length === 0 && misc.length === 0) continue

    const rgb = MEMBER_SECTION_PDF_RGB[memberIdx % MEMBER_SECTION_PDF_RGB.length]!
    memberIdx++
    addMemberBanner(b.personName, rgb)

    for (const c of tasks) {
      const statusBits = [
        `Tracker: ${workStatusLabel(c.itemStatus)}`,
        c.jiraStatusName ? `Jira: ${c.jiraStatusName}` : '',
      ].filter(Boolean)
      addParagraph(
        `Work item (${sourceLabel(c)} · ${c.section || 'General'}): ${c.itemTitle.trim() || '(untitled)'}`,
        { bold: true, size: 11 },
      )
      addParagraph(statusBits.join(' · '), { size: 9 })
      if (authorLineVisible(c.authorRaw, b.personName)) {
        addParagraph(`Comment thread: ${c.authorRaw}`, { size: 9 })
      }
      const taskUrl = workItemUrl(origin, c.itemId)
      addParagraph(taskUrl, { size: 8 })

      if (c.jiraResolvedStampKey) {
        const j = c.jiraLinks.find((x) => x.key === c.jiraResolvedStampKey)
        const line =
          j?.href && j.href !== '#'
            ? `Jira closed · ${j.key} — ${j.href}`
            : `Jira closed · ${c.jiraResolvedStampKey}`
        addParagraph(line, { size: 9 })
      }
      const segments = segmentsFromBulletLines(c.bulletLines)
      for (let si = 0; si < segments.length; si++) {
        if (si > 0) addParagraph('—', { size: 9 })
        const tree = buildBulletTree(segments[si]!)
        const blines = bulletTreeToPdfLines(tree, 0)
        for (const bl of blines) {
          addParagraph(bl, { size: 10 })
        }
      }
      if (c.jiraLinks.length > 0) {
        const keys = c.jiraLinks.map((j) => j.key).join(', ')
        addParagraph(`Jira keys: ${keys}`, { size: 9 })
      }
      y += 6
    }

    if (misc.length > 0) {
      addParagraph('Miscellaneous (this week)', { bold: true, size: 11 })
      for (const line of misc) {
        const prefix = line.done ? '[x] ' : '[ ] '
        const pad = '  '.repeat(Math.min(line.depth, 8))
        addParagraph(`${pad}${prefix}${line.text.trim() || '—'}`, { size: 10 })
      }
      y += 6
    }
  }

  const name = `weekly-report-${sanitizeFilenamePart(weekKeyForName)}.pdf`
  doc.save(name)
}

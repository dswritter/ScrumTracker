import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { jsPDF } from 'jspdf'
import { itemDetailPath } from './workItemRoutes'
import {
  buildBulletTree,
  isCommentSeparator,
  parseMondayKey,
  type BulletTreeNode,
  type WeeklyProgressCard,
  type WeeklyProgressPersonBundle,
} from './weeklyProgress'
import type { WeeklyMiscChecklist, WeeklyMiscLine } from '../types'

export type WeeklyReportMeta = {
  weekLabel: string
  teamName?: string
  scopeLabel?: string
  /** Heading shown at top of the document; defaults to "Weekly progress report". */
  reportTitle?: string
  /** Prefix label before weekLabel; defaults to "Week:". Used to say "Sprint:" for sprint exports. */
  rangeLabelPrefix?: string
  /** Filename prefix; defaults to "weekly-report". */
  filenamePrefix?: string
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
): void {
  const taskUrl = workItemUrl(origin, c.itemId)
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new ExternalHyperlink({
          link: taskUrl,
          children: [
            new TextRun({
              text: c.itemTitle.trim() || '(untitled)',
              style: 'Hyperlink',
              bold: true,
              size: 22,
            }),
          ],
        }),
      ],
    }),
  )

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
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'Other updates',
          bold: true,
          color: '007A3D',
        }),
      ],
    }),
  )
  for (const line of lines) {
    const pad = '  '.repeat(Math.min(line.depth, 8))
    const mark = line.done ? '[x] ' : '[ ] '
    const markColor = line.done ? '007A3D' : '94A3B8'
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${pad}${mark}`, color: markColor }),
          new TextRun({
            text: line.text.trim() || '(empty line)',
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

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({ text: meta.reportTitle || 'Weekly progress report' }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${meta.rangeLabelPrefix || 'Week:'} ${meta.weekLabel}`,
          bold: true,
        }),
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

    const inner: Paragraph[] = [
      new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: b.personName, bold: true, size: 28 })],
      }),
    ]
    for (const c of tasks) {
      pushConsolidatedItemDocx(inner, c, origin)
    }
    pushMiscDocx(inner, misc)

    const cellBorder = {
      style: BorderStyle.SINGLE,
      size: 1,
      color: '94A3B8',
    }
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [9360],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { fill },
                margins: { top: 240, bottom: 240, left: 280, right: 280 },
                borders: {
                  top: cellBorder,
                  bottom: cellBorder,
                  left: cellBorder,
                  right: cellBorder,
                },
                children: inner,
              }),
            ],
          }),
        ],
      }),
    )
    children.push(new Paragraph({ children: [] }))
  }

  const doc = new Document({
    sections: [{ children }],
  })
  const blob = await Packer.toBlob(doc)
  const namePrefix = meta.filenamePrefix || 'weekly-report'
  const name = `${namePrefix}-${sanitizeFilenamePart(weekKeyForName)}.docx`
  triggerDownload(blob, name)
}

function dateOnlyKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

/** Top-right mini month grid; highlights Mon–Fri of the report week. Returns total height used. */
function drawPdfWeekCalendar(
  doc: jsPDF,
  weekMondayKey: string,
  anchorRight: number,
  topY: number,
): number {
  const mon = parseMondayKey(weekMondayKey)
  const fri = new Date(mon)
  fri.setDate(fri.getDate() + 4)
  const monKey = dateOnlyKey(mon)
  const friKey = dateOnlyKey(fri)
  const calYear = mon.getFullYear()
  const calMonth = mon.getMonth()
  const first = new Date(calYear, calMonth, 1)
  const firstDow = first.getDay()
  const startOffset = (firstDow + 6) % 7
  const gridStart = new Date(first)
  gridStart.setDate(gridStart.getDate() - startOffset)

  const cell = 13
  const titleBand = 12
  const labelRow = 9
  const gridH = 6 * cell
  const gridW = 7 * cell
  const x0 = anchorRight - gridW

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(0, 100, 55)
  const monthTitle = mon.toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  })
  doc.text(monthTitle, x0 + gridW / 2, topY + 8, { align: 'center' })

  doc.setFontSize(7)
  const wd = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  for (let c = 0; c < 7; c++) {
    doc.text(wd[c]!, x0 + c * cell + 3, topY + titleBand + labelRow)
  }

  doc.setFont('helvetica', 'normal')
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const idx = r * 7 + c
      const d = new Date(gridStart)
      d.setDate(d.getDate() + idx)
      const inMonth = d.getMonth() === calMonth
      const dk = dateOnlyKey(d)
      const inWorkWeek = dk >= monKey && dk <= friKey
      const x = x0 + c * cell
      const yCell = topY + titleBand + labelRow + 4 + r * cell
      if (inWorkWeek) {
        doc.setFillColor(198, 242, 212)
      } else {
        doc.setFillColor(248, 250, 252)
      }
      doc.rect(x + 0.5, yCell - 1, cell - 1, cell - 2, 'F')
      doc.setDrawColor(200, 200, 210)
      doc.rect(x + 0.5, yCell - 1, cell - 1, cell - 2, 'S')
      doc.setTextColor(
        inMonth ? (inWorkWeek ? 15 : 55) : 170,
        inMonth ? (inWorkWeek ? 85 : 55) : 175,
        inMonth ? (inWorkWeek ? 50 : 55) : 180,
      )
      doc.text(String(d.getDate()), x + cell / 2, yCell + cell / 2 - 2, {
        align: 'center',
      })
    }
  }
  doc.setTextColor(0, 0, 0)
  return titleBand + labelRow + 4 + gridH + 6
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

  type PdfLineSpec = {
    indent: number
    size: number
    bold: boolean
    text: string
    linkUrl?: string
    textColor?: [number, number, number]
  }

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const margin = 48
  const pageH = doc.internal.pageSize.getHeight()
  const pageW = doc.internal.pageSize.getWidth()
  const maxW = pageW - 2 * margin
  let y = margin
  const lineH = 13
  const innerPad = 14
  const ix = margin + innerPad
  const innerW = maxW - innerPad * 2

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

  function measureSpecs(specs: PdfLineSpec[]): number {
    let total = 0
    for (const s of specs) {
      doc.setFontSize(s.size)
      doc.setFont('helvetica', s.bold ? 'bold' : 'normal')
      const w = Math.max(40, innerW - s.indent)
      const split = doc.splitTextToSize(s.text, w) as string[]
      total += split.length * lineH
    }
    return total
  }

  function drawSpecs(specs: PdfLineSpec[], rgb: [number, number, number]) {
    const padV = 12
    const contentH = measureSpecs(specs)
    const blockH = contentH + padV * 2
    ensureSpace(blockH + 14)
    const y0 = y
    doc.setFillColor(rgb[0], rgb[1], rgb[2])
    doc.roundedRect(margin, y0 - 4, maxW, blockH + 8, 8, 8, 'F')
    doc.setDrawColor(160, 175, 190)
    doc.setLineWidth(0.6)
    doc.roundedRect(margin, y0 - 4, maxW, blockH + 8, 8, 8, 'S')
    doc.setLineWidth(1)
    y = y0 + padV

    for (const s of specs) {
      doc.setFontSize(s.size)
      doc.setFont('helvetica', s.bold ? 'bold' : 'normal')
      const w = Math.max(40, innerW - s.indent)
      const x = ix + s.indent
      const split = doc.splitTextToSize(s.text, w) as string[]
      const tc = s.textColor ?? [0, 0, 0]
      doc.setTextColor(tc[0], tc[1], tc[2])
      for (let i = 0; i < split.length; i++) {
        const line = split[i]!
        ensureSpace(lineH)
        doc.text(line, x, y)
        if (s.linkUrl) {
          const tw = doc.getTextWidth(line)
          doc.link(x, y - s.size + 2, tw, lineH + 2, { url: s.linkUrl })
        }
        y += lineH
      }
    }
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    y = y0 + blockH + 14
  }

  function buildMemberSpecs(
    b: WeeklyProgressPersonBundle,
    tasks: WeeklyProgressCard[],
    misc: WeeklyMiscLine[],
  ): PdfLineSpec[] {
    const specs: PdfLineSpec[] = [
      { indent: 0, size: 13, bold: true, text: b.personName },
    ]
    for (const c of tasks) {
      const taskUrl = workItemUrl(origin, c.itemId)
      specs.push({
        indent: 0,
        size: 11,
        bold: true,
        text: c.itemTitle.trim() || '(untitled)',
        linkUrl: taskUrl,
      })
      if (c.jiraResolvedStampKey) {
        const j = c.jiraLinks.find((x) => x.key === c.jiraResolvedStampKey)
        const t =
          j?.href && j.href !== '#'
            ? `Jira closed · ${j.key}`
            : `Jira closed · ${c.jiraResolvedStampKey}`
        specs.push({ indent: 0, size: 9, bold: false, text: t })
      }
      const segments = segmentsFromBulletLines(c.bulletLines)
      for (let si = 0; si < segments.length; si++) {
        if (si > 0) {
          specs.push({
            indent: 0,
            size: 9,
            bold: false,
            text: '—',
            textColor: [130, 130, 130],
          })
        }
        const tree = buildBulletTree(segments[si]!)
        for (const bl of bulletTreeToPdfLines(tree, 0)) {
          specs.push({ indent: 0, size: 10, bold: false, text: bl })
        }
      }
      if (c.jiraLinks.length > 0) {
        specs.push({
          indent: 0,
          size: 9,
          bold: false,
          text: `Jira keys: ${c.jiraLinks.map((j) => j.key).join(', ')}`,
        })
      }
      specs.push({ indent: 0, size: 5, bold: false, text: ' ' })
    }
    if (misc.length > 0) {
      specs.push({
        indent: 0,
        size: 11,
        bold: true,
        text: 'Other updates',
        textColor: [0, 122, 61],
      })
      for (const line of misc) {
        const pad = '  '.repeat(Math.min(line.depth, 8))
        const mark = line.done ? '[x] ' : '[ ] '
        const body = line.text.trim() || '—'
        specs.push({
          indent: 0,
          size: 10,
          bold: false,
          text: `${pad}${mark}${body}`,
          textColor: line.done ? [0, 110, 65] : [71, 85, 105],
        })
      }
    }
    return specs
  }

  const calH = drawPdfWeekCalendar(doc, weekKeyForName, pageW - margin, margin)
  const calW = 7 * 13 + 6
  const titleMaxW = Math.max(160, maxW - calW - 16)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 0, 0)
  const titleLines = doc.splitTextToSize(
    meta.reportTitle || 'Weekly progress report',
    titleMaxW,
  ) as string[]
  let yTitle = margin + 14
  for (const tl of titleLines) {
    ensureSpace(18)
    doc.text(tl, margin, yTitle)
    yTitle += 18
  }
  y = Math.max(yTitle + 4, margin + calH + 8)

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
    const specs = buildMemberSpecs(b, tasks, misc)
    drawSpecs(specs, rgb)
  }

  const namePrefix = meta.filenamePrefix || 'weekly-report'
  const name = `${namePrefix}-${sanitizeFilenamePart(weekKeyForName)}.pdf`
  doc.save(name)
}

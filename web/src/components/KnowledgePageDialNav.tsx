import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ConfluencePageRef, TeamKnowledgePage } from '../types'

/** Matches article width + dial container in KnowledgeBase (~85vw + 15%). */
export const KB_PAGE_WIDTH_CLASS = 'mx-auto w-[min(100%,97.75vw)]'

function previewSnippet(body: string, max = 120): string {
  const t = body.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t || '—'
  return `${t.slice(0, max - 1)}…`
}

type Props = {
  pages: TeamKnowledgePage[]
  currentId: string
  windowRadius?: number
  onHorizontalStep?: (direction: -1 | 1) => void
  pageHref?: (pageId: string) => string
  matchMode?: boolean
  confluencePages?: ConfluencePageRef[]
  cfPageId?: string | null
  onCfPageClick?: (pageId: string) => void
  cfQuery?: string
  /** Called whenever the user switches the active pane, so the host can adjust key handling. */
  onActivePaneChange?: (pane: 'kb' | 'wiki') => void
}

export function KnowledgePageDialNav({
  pages,
  currentId,
  windowRadius = 2,
  onHorizontalStep,
  pageHref = (id) => `/kb/${id}`,
  matchMode = false,
  confluencePages = [],
  cfPageId = null,
  onCfPageClick,
  cfQuery,
  onActivePaneChange,
}: Props) {
  const hasCf = confluencePages.length > 0
  const [activePane, setActivePane] = useState<'kb' | 'wiki'>('kb')

  // Notify host whenever active pane changes
  useEffect(() => {
    onActivePaneChange?.(activePane)
  }, [activePane, onActivePaneChange])

  const idx = useMemo(
    () => pages.findIndex((p) => p.id === currentId),
    [pages, currentId],
  )

  const kbScrollerRef = useRef<HTMLDivElement | null>(null)
  const wikiScrollerRef = useRef<HTMLDivElement | null>(null)
  const activeCardRef = useRef<HTMLDivElement | null>(null)

  const filteredCfPages = useMemo(() => {
    if (!cfQuery) return confluencePages
    const q = cfQuery.toLowerCase()
    return confluencePages.filter((p) => p.title.toLowerCase().includes(q))
  }, [cfQuery, confluencePages])

  const windowSlice = useMemo(() => {
    if (idx < 0 || pages.length === 0) return []
    if (!hasCf && pages.length <= 1) return []
    const start = Math.max(0, idx - windowRadius)
    const end = Math.min(pages.length, idx + windowRadius + 1)
    return pages.slice(start, end).map((page, i) => ({ page, indexInTeam: start + i }))
  }, [pages, idx, windowRadius, hasCf])

  const cfIdx = useMemo(
    () => (cfPageId ? filteredCfPages.findIndex((p) => p.pageId === cfPageId) : -1),
    [filteredCfPages, cfPageId],
  )

  const cfWindowSlice = useMemo(() => {
    if (filteredCfPages.length === 0) return []
    const centerIdx = cfIdx >= 0 ? cfIdx : 0
    const start = Math.max(0, centerIdx - windowRadius)
    const end = Math.min(filteredCfPages.length, centerIdx + windowRadius + 1)
    return filteredCfPages.slice(start, end).map((page, i) => ({ page, indexInAll: start + i }))
  }, [filteredCfPages, cfIdx, windowRadius])

  // Scroll the active card into view in its pane
  useLayoutEffect(() => {
    const scroller = (hasCf && activePane === 'wiki') ? wikiScrollerRef.current : kbScrollerRef.current
    const card = activeCardRef.current
    if (!scroller || !card) return
    const id = window.requestAnimationFrame(() => {
      const target = card.offsetLeft - scroller.clientWidth / 2 + card.offsetWidth / 2
      scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [currentId, cfPageId, activePane, hasCf])

  // ── KB pane: trackpad/wheel → navigate KB articles ────────────────────────
  useEffect(() => {
    const el = kbScrollerRef.current
    if (!el || !onHorizontalStep || (hasCf && activePane !== 'kb')) return
    let accum = 0
    let cooldownUntil = 0
    const COOLDOWN_MS = 480
    const THRESHOLD = 95
    const onWheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now < cooldownUntil) { e.preventDefault(); accum = 0; return }
      const dx = e.deltaX
      const dy = e.deltaY
      const dominant =
        Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 1.5
          ? dx
          : e.shiftKey && Math.abs(dy) > Math.abs(dx) * 1.2
            ? dy
            : 0
      if (Math.abs(dominant) < 0.5) return
      accum += dominant
      if (accum > THRESHOLD) {
        accum = 0; cooldownUntil = now + COOLDOWN_MS
        onHorizontalStep(1); e.preventDefault()
      } else if (accum < -THRESHOLD) {
        accum = 0; cooldownUntil = now + COOLDOWN_MS
        onHorizontalStep(-1); e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onHorizontalStep, currentId, pages.length, activePane, hasCf])

  // ── Wiki pane: trackpad/wheel → scroll the card strip horizontally ─────────
  useEffect(() => {
    const el = wikiScrollerRef.current
    if (!el || !hasCf || activePane !== 'wiki') return
    let accum = 0
    let cooldownUntil = 0
    const COOLDOWN_MS = 200
    const THRESHOLD = 60
    const CARD_W = 190 // approx px per card scroll step
    const onWheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now < cooldownUntil) { e.preventDefault(); accum = 0; return }
      const dx = e.deltaX
      const dy = e.deltaY
      const dominant =
        Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 1.5
          ? dx
          : e.shiftKey && Math.abs(dy) > Math.abs(dx) * 1.2
            ? dy
            : 0
      if (Math.abs(dominant) < 0.5) return
      accum += dominant
      if (accum > THRESHOLD) {
        accum = 0; cooldownUntil = now + COOLDOWN_MS
        el.scrollBy({ left: CARD_W, behavior: 'smooth' }); e.preventDefault()
      } else if (accum < -THRESHOLD) {
        accum = 0; cooldownUntil = now + COOLDOWN_MS
        el.scrollBy({ left: -CARD_W, behavior: 'smooth' }); e.preventDefault()
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [hasCf, activePane])

  // ── Wiki pane: arrow keys → scroll the card strip ────────────────────────
  useEffect(() => {
    if (!hasCf || activePane !== 'wiki') return
    const CARD_W = 190
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return
      if (t instanceof HTMLElement && t.closest('[contenteditable="true"]')) return
      const dir = e.key === 'ArrowLeft' ? -1 : 1
      wikiScrollerRef.current?.scrollBy({ left: dir * CARD_W, behavior: 'smooth' })
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasCf, activePane])

  const kbValid = pages.length > 1 && idx >= 0
  if (!kbValid && !hasCf) return null
  if (kbValid && !hasCf && windowSlice.length === 0) return null

  // ── Card builders ─────────────────────────────────────────────────────────

  const cardW = hasCf ? 'w-[min(11rem,36vw)]' : 'w-[min(14rem,72vw)]'

  const kbCards = windowSlice.map(({ page, indexInTeam }) => {
    const dist = Math.abs(indexInTeam - idx)
    const isCurrent = page.id === currentId
    const scale = dist === 0 ? 1 : dist === 1 ? 0.94 : Math.max(0.88, 0.88 - (dist - 2) * 0.02)
    const baseOpacity = dist === 0 ? 1 : dist === 1 ? 0.92 : 0.86
    const opacity = (hasCf && activePane !== 'kb') ? baseOpacity * 0.35 : baseOpacity
    const blurPx = dist >= windowRadius ? 0.35 : 0
    const cardInner = (
      <>
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
          {isCurrent ? 'Current' : matchMode ? `Match ${indexInTeam + 1}` : `Page ${indexInTeam + 1}`}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
          {page.title}
        </span>
        <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          {previewSnippet(page.body, 80)}
        </span>
      </>
    )
    const cardClass = [
      `kb-dial-card flex ${cardW} shrink-0 snap-center flex-col rounded-lg border bg-slate-50/90 p-2.5 text-left shadow-sm dark:bg-slate-800/60`,
      isCurrent
        ? 'z-10 border-[#00B050]/70 shadow-md ring-2 ring-[#00B050]/25 dark:border-emerald-500/50'
        : 'border-slate-200 hover:border-[#00B050]/50 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800',
    ].join(' ')
    return (
      <div
        key={page.id}
        ref={isCurrent && (!hasCf || activePane === 'kb') ? activeCardRef : undefined}
        className="kb-dial-item flex shrink-0 justify-center pb-0.5 will-change-transform"
        style={{ transform: `scale(${scale})`, opacity, filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
      >
        {isCurrent ? (
          <div className={cardClass} aria-current="page" tabIndex={0}>{cardInner}</div>
        ) : (
          <Link to={pageHref(page.id)} className={cardClass}>{cardInner}</Link>
        )}
      </div>
    )
  })

  const cfCards = cfWindowSlice.map(({ page, indexInAll }) => {
    const centerI = cfIdx >= 0 ? cfIdx : 0
    const dist = Math.abs(indexInAll - centerI)
    const isCurrent = page.pageId === cfPageId
    const scale = dist === 0 ? 1 : dist === 1 ? 0.94 : Math.max(0.88, 0.88 - (dist - 2) * 0.02)
    const baseOpacity = dist === 0 ? 1 : dist === 1 ? 0.92 : 0.86
    const opacity = activePane !== 'wiki' ? baseOpacity * 0.35 : baseOpacity
    const blurPx = dist >= windowRadius ? 0.35 : 0
    const cardInner = (
      <>
        <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          {isCurrent ? 'Current' : cfQuery ? `Match ${indexInAll + 1}` : `Wiki ${indexInAll + 1}`}
        </span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
          {page.title}
        </span>
        <span className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
          {page.spaceKey}
          {page.lastSyncedAt ? ` · ${new Date(page.lastSyncedAt).toLocaleDateString()}` : ''}
          {page.syncError ? ' · ⚠' : ''}
        </span>
      </>
    )
    const cardClass = [
      `kb-dial-card flex ${cardW} shrink-0 snap-center flex-col rounded-lg border bg-blue-50/90 p-2.5 text-left shadow-sm dark:bg-blue-950/40`,
      isCurrent
        ? 'z-10 border-blue-400/70 shadow-md ring-2 ring-blue-400/25 dark:border-blue-500/50'
        : 'border-blue-200/60 hover:border-blue-400/60 hover:bg-blue-100/80 dark:border-blue-900/40 dark:hover:bg-blue-900/30',
    ].join(' ')
    return (
      <div
        key={page.pageId}
        ref={isCurrent && activePane === 'wiki' ? activeCardRef : undefined}
        className="kb-dial-item flex shrink-0 justify-center pb-0.5 will-change-transform"
        style={{ transform: `scale(${scale})`, opacity, filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
      >
        <button type="button" className={cardClass} onClick={() => onCfPageClick?.(page.pageId)}>
          {cardInner}
        </button>
      </div>
    )
  })

  // ── Render ────────────────────────────────────────────────────────────────

  const maskStyle = { maskImage: 'linear-gradient(to right, transparent, black 6%, black 94%, transparent)' }

  if (!hasCf) {
    return (
      <nav
        className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
        aria-label="Knowledge pages"
      >
        <div className={`${KB_PAGE_WIDTH_CLASS} relative px-2 py-2`} style={maskStyle}>
          <div
            ref={kbScrollerRef}
            className="kb-dial-scroll flex snap-x snap-mandatory items-end justify-center gap-3 overflow-x-auto overflow-y-visible py-1 [scrollbar-width:thin]"
          >
            {kbCards}
          </div>
        </div>
      </nav>
    )
  }

  const kbActive = activePane === 'kb'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
      aria-label="Knowledge pages"
    >
      <div className={`${KB_PAGE_WIDTH_CLASS} flex items-stretch`}>

        {/* ── KB pane ──────────────────────────────────────────── */}
        <button
          type="button"
          className={`flex min-w-0 flex-1 flex-col py-1.5 text-left transition-opacity ${kbActive ? 'opacity-100' : 'opacity-40'}`}
          onClick={() => setActivePane('kb')}
          aria-label="Switch to KB navigation"
        >
          <div className={`flex items-center gap-1.5 px-3 pb-1 ${kbActive ? 'border-b-2 border-[#00B050]' : ''}`}>
            <i className="fa-solid fa-book-bookmark text-[9px] text-[#007a3d] dark:text-emerald-400" aria-hidden />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${kbActive ? 'text-[#007a3d] dark:text-emerald-300' : 'text-slate-500'}`}>
              KB
            </span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold ${
              kbActive
                ? 'bg-[#00B050]/15 text-[#007a3d] dark:bg-emerald-900/30 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            }`}>
              {pages.length}
            </span>
          </div>
          <div className="relative min-w-0 overflow-hidden" style={maskStyle}>
            <div
              ref={kbScrollerRef}
              className="kb-dial-scroll flex snap-x snap-mandatory items-end justify-center gap-2 overflow-x-auto overflow-y-visible px-2 py-1 [scrollbar-width:none]"
            >
              {kbCards.length > 0 ? kbCards : (
                <p className="py-2 text-[11px] text-slate-400 dark:text-slate-500">1 page</p>
              )}
            </div>
          </div>
        </button>

        {/* ── Divider + toggle ─────────────────────────────────── */}
        <div className="relative flex flex-col items-center justify-center px-0.5 py-1.5">
          <div className="h-full w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setActivePane((p) => (p === 'kb' ? 'wiki' : 'kb'))
            }}
            className="absolute flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white shadow-md transition-colors dark:bg-slate-800 dark:text-slate-200"
            style={{
              borderColor: kbActive ? '#00B050' : '#3b82f6',
              color: kbActive ? '#007a3d' : '#2563eb',
            }}
            title={kbActive ? 'Switch to Wiki navigation (or click Wiki pane)' : 'Switch to KB navigation (or click KB pane)'}
            aria-label="Toggle active navigation pane"
          >
            <i
              className={`fa-solid text-[10px] ${kbActive ? 'fa-chevron-right' : 'fa-chevron-left'}`}
              aria-hidden
            />
          </button>
        </div>

        {/* ── Wiki pane ────────────────────────────────────────── */}
        <button
          type="button"
          className={`flex min-w-0 flex-1 flex-col py-1.5 text-left transition-opacity ${!kbActive ? 'opacity-100' : 'opacity-40'}`}
          onClick={() => setActivePane('wiki')}
          aria-label="Switch to Wiki navigation"
        >
          <div className={`flex items-center gap-1.5 px-3 pb-1 ${!kbActive ? 'border-b-2 border-blue-500' : ''}`}>
            <i className="fa-solid fa-book-open text-[9px] text-blue-500 dark:text-blue-400" aria-hidden />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${!kbActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
              Wiki
            </span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold ${
              !kbActive
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
            }`}>
              {cfQuery && filteredCfPages.length !== confluencePages.length
                ? `${filteredCfPages.length}/${confluencePages.length}`
                : confluencePages.length}
            </span>
          </div>
          <div className="relative min-w-0 overflow-hidden" style={maskStyle}>
            <div
              ref={wikiScrollerRef}
              className="kb-dial-scroll flex snap-x snap-mandatory items-end justify-center gap-2 overflow-x-auto overflow-y-visible px-2 py-1 [scrollbar-width:none]"
            >
              {cfCards.length > 0 ? cfCards : (
                <p className="py-2 text-[11px] text-slate-400 dark:text-slate-500">
                  {cfQuery ? 'No match.' : 'Not synced.'}
                </p>
              )}
            </div>
          </div>
        </button>

      </div>
    </nav>
  )
}

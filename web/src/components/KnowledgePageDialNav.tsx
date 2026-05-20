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
  /** Neighbors on each side of current (default 2 → up to 5 cards). */
  windowRadius?: number
  /** Two-finger horizontal scroll / trackpad: move to previous (-1) or next (+1) page. */
  onHorizontalStep?: (direction: -1 | 1) => void
  /** Preserve URL params (e.g. search highlight) on page links. */
  pageHref?: (pageId: string) => string
  /** When true, KB cards use "Match n" instead of global page index (search-filtered dial). */
  matchMode?: boolean
  /** Confluence pages for the Wiki tab. */
  confluencePages?: ConfluencePageRef[]
  /** Currently-open Confluence page ID, if any. */
  cfPageId?: string | null
  /** Called when user clicks a Confluence page card. */
  onCfPageClick?: (pageId: string) => void
  /** Filter Confluence cards by title (e.g. current search query). */
  cfQuery?: string
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
}: Props) {
  const hasCf = confluencePages.length > 0
  const [activeTab, setActiveTab] = useState<'kb' | 'wiki'>('kb')

  const idx = useMemo(
    () => pages.findIndex((p) => p.id === currentId),
    [pages, currentId],
  )
  const activeRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const filteredCfPages = useMemo(() => {
    if (!cfQuery) return confluencePages
    const q = cfQuery.toLowerCase()
    return confluencePages.filter((p) => p.title.toLowerCase().includes(q))
  }, [cfQuery, confluencePages])

  const windowSlice = useMemo(() => {
    if (activeTab !== 'kb' || idx < 0 || pages.length <= 1) return []
    const start = Math.max(0, idx - windowRadius)
    const end = Math.min(pages.length, idx + windowRadius + 1)
    return pages.slice(start, end).map((page, i) => ({ page, indexInTeam: start + i }))
  }, [pages, idx, windowRadius, activeTab])

  const cfIdx = useMemo(
    () => (cfPageId ? filteredCfPages.findIndex((p) => p.pageId === cfPageId) : -1),
    [filteredCfPages, cfPageId],
  )

  const cfWindowSlice = useMemo(() => {
    if (activeTab !== 'wiki' || filteredCfPages.length === 0) return []
    const centerIdx = cfIdx >= 0 ? cfIdx : 0
    const start = Math.max(0, centerIdx - windowRadius)
    const end = Math.min(filteredCfPages.length, centerIdx + windowRadius + 1)
    return filteredCfPages.slice(start, end).map((page, i) => ({ page, indexInAll: start + i }))
  }, [filteredCfPages, cfIdx, windowRadius, activeTab])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const card = activeRef.current
    if (!scroller || !card) return
    const id = window.requestAnimationFrame(() => {
      const target = card.offsetLeft - scroller.clientWidth / 2 + card.offsetWidth / 2
      scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [currentId, cfPageId, activeTab])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !onHorizontalStep || activeTab !== 'kb') return

    let accum = 0
    let cooldownUntil = 0
    const COOLDOWN_MS = 480
    const THRESHOLD = 95

    const onWheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now < cooldownUntil) {
        e.preventDefault()
        accum = 0
        return
      }
      const dx = e.deltaX
      const dy = e.deltaY
      const horizontalIntent = Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 1.5
      const shiftVertical = e.shiftKey && Math.abs(dy) > Math.abs(dx) * 1.2
      const dominant = horizontalIntent ? dx : shiftVertical ? dy : 0
      if (Math.abs(dominant) < 0.5) return
      accum += dominant
      if (accum > THRESHOLD) {
        accum = 0
        cooldownUntil = now + COOLDOWN_MS
        onHorizontalStep(1)
        e.preventDefault()
      } else if (accum < -THRESHOLD) {
        accum = 0
        cooldownUntil = now + COOLDOWN_MS
        onHorizontalStep(-1)
        e.preventDefault()
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onHorizontalStep, currentId, pages.length, activeTab])

  const kbValid = pages.length > 1 && idx >= 0
  if (!kbValid && !hasCf) return null
  if (kbValid && !hasCf && windowSlice.length === 0) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
      aria-label="Knowledge pages"
    >
      <div className={`${KB_PAGE_WIDTH_CLASS} relative px-2`}>
        {/* Tab strip — only when Confluence pages are present */}
        {hasCf && (
          <div className="flex items-center gap-0.5 border-b border-slate-100 pt-1.5 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('kb')}
              className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                activeTab === 'kb'
                  ? 'text-[#007a3d] shadow-[inset_0_-2px_0_#00B050] dark:text-emerald-300'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <i className="fa-solid fa-book-bookmark text-[9px]" aria-hidden />
              KB
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  activeTab === 'kb'
                    ? 'bg-[#00B050]/15 text-[#007a3d] dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {pages.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wiki')}
              className={`flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                activeTab === 'wiki'
                  ? 'text-blue-600 shadow-[inset_0_-2px_0_#3b82f6] dark:text-blue-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              <i className="fa-solid fa-book-open text-[9px]" aria-hidden />
              Wiki
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                  activeTab === 'wiki'
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                {cfQuery && filteredCfPages.length !== confluencePages.length
                  ? `${filteredCfPages.length}/${confluencePages.length}`
                  : confluencePages.length}
              </span>
            </button>
          </div>
        )}

        {/* Card strip */}
        <div
          className="py-2"
          style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}
        >
          <div
            ref={scrollerRef}
            className="kb-dial-scroll flex snap-x snap-mandatory items-end justify-center gap-3 overflow-x-auto overflow-y-visible py-1 [scrollbar-width:thin]"
          >
            {/* ── KB cards ── */}
            {activeTab === 'kb' &&
              windowSlice.map(({ page, indexInTeam }) => {
                const dist = Math.abs(indexInTeam - idx)
                const isCurrent = page.id === currentId
                const scale = dist === 0 ? 1 : dist === 1 ? 0.94 : Math.max(0.88, 0.88 - (dist - 2) * 0.02)
                const opacity = dist === 0 ? 1 : dist === 1 ? 0.92 : 0.86
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
                      {previewSnippet(page.body, 100)}
                    </span>
                  </>
                )
                const cardClass = [
                  'kb-dial-card flex w-[min(14rem,72vw)] shrink-0 snap-center flex-col rounded-lg border bg-slate-50/90 p-2.5 text-left shadow-sm dark:bg-slate-800/60',
                  isCurrent
                    ? 'z-10 border-[#00B050]/70 shadow-md ring-2 ring-[#00B050]/25 dark:border-emerald-500/50'
                    : 'border-slate-200 hover:border-[#00B050]/50 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800',
                ].join(' ')
                return (
                  <div
                    key={page.id}
                    ref={isCurrent ? activeRef : undefined}
                    className="kb-dial-item flex shrink-0 justify-center pb-0.5 will-change-transform"
                    style={{ transform: `scale(${scale})`, opacity, filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
                  >
                    {isCurrent ? (
                      <div className={cardClass} aria-current="page" tabIndex={0}>
                        {cardInner}
                      </div>
                    ) : (
                      <Link to={pageHref(page.id)} className={cardClass}>
                        {cardInner}
                      </Link>
                    )}
                  </div>
                )
              })}

            {/* ── Confluence (Wiki) cards ── */}
            {activeTab === 'wiki' &&
              cfWindowSlice.map(({ page, indexInAll }) => {
                const centerI = cfIdx >= 0 ? cfIdx : 0
                const dist = Math.abs(indexInAll - centerI)
                const isCurrent = page.pageId === cfPageId
                const scale = dist === 0 ? 1 : dist === 1 ? 0.94 : Math.max(0.88, 0.88 - (dist - 2) * 0.02)
                const opacity = dist === 0 ? 1 : dist === 1 ? 0.92 : 0.86
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
                  'kb-dial-card flex w-[min(14rem,72vw)] shrink-0 snap-center flex-col rounded-lg border bg-blue-50/90 p-2.5 text-left shadow-sm dark:bg-blue-950/40',
                  isCurrent
                    ? 'z-10 border-blue-400/70 shadow-md ring-2 ring-blue-400/25 dark:border-blue-500/50'
                    : 'border-blue-200/60 hover:border-blue-400/60 hover:bg-blue-100/80 dark:border-blue-900/40 dark:hover:bg-blue-900/30',
                ].join(' ')
                return (
                  <div
                    key={page.pageId}
                    ref={isCurrent ? activeRef : undefined}
                    className="kb-dial-item flex shrink-0 justify-center pb-0.5 will-change-transform"
                    style={{ transform: `scale(${scale})`, opacity, filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}
                  >
                    <button type="button" className={cardClass} onClick={() => onCfPageClick?.(page.pageId)}>
                      {cardInner}
                    </button>
                  </div>
                )
              })}

            {/* Wiki empty state */}
            {activeTab === 'wiki' && filteredCfPages.length === 0 && (
              <p className="py-3 text-xs text-slate-400 dark:text-slate-500">
                {cfQuery ? 'No Wiki pages match the search.' : 'No Wiki pages synced yet.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

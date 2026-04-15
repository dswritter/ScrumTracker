import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { TeamKnowledgePage } from '../types'

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
  /** When true, cards use “Match n” instead of global page index (search-filtered dial). */
  matchMode?: boolean
}

export function KnowledgePageDialNav({
  pages,
  currentId,
  windowRadius = 2,
  onHorizontalStep,
  pageHref = (id) => `/kb/${id}`,
  matchMode = false,
}: Props) {
  const idx = useMemo(
    () => pages.findIndex((p) => p.id === currentId),
    [pages, currentId],
  )
  const activeRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const windowSlice = useMemo(() => {
    if (idx < 0 || pages.length <= 1) return []
    const start = Math.max(0, idx - windowRadius)
    const end = Math.min(pages.length, idx + windowRadius + 1)
    return pages.slice(start, end).map((page, i) => ({
      page,
      indexInTeam: start + i,
    }))
  }, [pages, idx, windowRadius])

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const card = activeRef.current
    if (!scroller || !card) return
    const id = window.requestAnimationFrame(() => {
      const target =
        card.offsetLeft - scroller.clientWidth / 2 + card.offsetWidth / 2
      scroller.scrollTo({
        left: Math.max(0, target),
        behavior: 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(id)
  }, [currentId, windowSlice])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el || !onHorizontalStep) return

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
      const horizontalIntent =
        Math.abs(dx) > Math.abs(dy) * 1.15 && Math.abs(dx) > 1.5
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
  }, [onHorizontalStep, currentId, pages.length])

  if (pages.length <= 1 || idx < 0 || windowSlice.length === 0) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95"
      aria-label="Knowledge pages"
    >
      <div
        className={`${KB_PAGE_WIDTH_CLASS} relative px-2 py-2`}
        style={{
          maskImage:
            'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        }}
      >
        <div
          ref={scrollerRef}
          className="kb-dial-scroll flex snap-x snap-mandatory items-end justify-center gap-3 overflow-x-auto overflow-y-visible py-1 [scrollbar-width:thin]"
        >
          {windowSlice.map(({ page, indexInTeam }) => {
            const dist = Math.abs(indexInTeam - idx)
            const isCurrent = page.id === currentId
            const scale =
              dist === 0 ? 1 : dist === 1 ? 0.94 : Math.max(0.88, 0.88 - (dist - 2) * 0.02)
            const opacity = dist === 0 ? 1 : dist === 1 ? 0.92 : 0.86
            const blurPx = dist >= windowRadius ? 0.35 : 0

            const cardInner = (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#007a3d] dark:text-emerald-300">
                  {isCurrent
                    ? 'Current'
                    : matchMode
                      ? `Match ${indexInTeam + 1}`
                      : `Page ${indexInTeam + 1}`}
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
                style={{
                  transform: `scale(${scale})`,
                  opacity,
                  filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
                }}
              >
                {isCurrent ? (
                  <div
                    className={cardClass}
                    aria-current="page"
                    tabIndex={0}
                  >
                    {cardInner}
                  </div>
                ) : (
                  <Link
                    to={pageHref(page.id)}
                    className={cardClass}
                  >
                    {cardInner}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

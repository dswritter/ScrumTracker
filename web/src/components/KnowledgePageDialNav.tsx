import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { TeamKnowledgePage } from '../types'

/** Matches article width + dial container in KnowledgeBase */
export const KB_PAGE_WIDTH_CLASS = 'mx-auto w-[min(100%,85vw)]'

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
}

export function KnowledgePageDialNav({
  pages,
  currentId,
  windowRadius = 2,
}: Props) {
  const idx = useMemo(
    () => pages.findIndex((p) => p.id === currentId),
    [pages, currentId],
  )
  const activeRef = useRef<HTMLDivElement | null>(null)

  const windowSlice = useMemo(() => {
    if (idx < 0 || pages.length <= 1) return []
    const start = Math.max(0, idx - windowRadius)
    const end = Math.min(pages.length, idx + windowRadius + 1)
    return pages.slice(start, end).map((page, i) => ({
      page,
      indexInTeam: start + i,
    }))
  }, [pages, idx, windowRadius])

  useEffect(() => {
    if (!activeRef.current) return
    activeRef.current.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: 'smooth',
    })
  }, [currentId, windowSlice.length])

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
            'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        }}
      >
        <div className="flex snap-x snap-mandatory items-end justify-center gap-3 overflow-x-auto overflow-y-visible py-1 [scrollbar-width:thin]">
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
                  {isCurrent ? 'Current' : `Page ${indexInTeam + 1}`}
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
              'flex w-[min(14rem,72vw)] shrink-0 snap-center flex-col rounded-lg border bg-slate-50/90 p-2.5 text-left shadow-sm transition-[transform,opacity,box-shadow,border-color] duration-300 ease-out dark:bg-slate-800/60',
              isCurrent
                ? 'z-10 border-[#00B050]/70 shadow-md ring-2 ring-[#00B050]/25 dark:border-emerald-500/50'
                : 'border-slate-200 hover:border-[#00B050]/50 hover:bg-white dark:border-slate-600 dark:hover:bg-slate-800',
            ].join(' ')

            return (
              <div
                key={page.id}
                ref={isCurrent ? activeRef : undefined}
                className="flex shrink-0 justify-center pb-0.5"
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
                    to={`/kb/${page.id}`}
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

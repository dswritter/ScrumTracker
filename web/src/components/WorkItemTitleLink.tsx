import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { formatIsoDateTime } from '../lib/formatIso'
import { itemDetailPath } from '../lib/workItemRoutes'
import type { WorkItem } from '../types'

const HOVER_HIDE_MS = 120

/**
 * Title link to the item detail page. Optional hover panel with recent comments,
 * intended for admin views (Dashboard / People / profiles). Uses a fixed-position portal
 * so comments are not clipped by parent scroll areas.
 */
export function WorkItemTitleLink({
  item,
  className = '',
  showCommentHover = false,
}: {
  item: WorkItem
  className?: string
  showCommentHover?: boolean
}) {
  const title = item.title || '(untitled)'
  const anchorRef = useRef<HTMLSpanElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const sortedComments = useMemo(
    () =>
      [...item.comments].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
    [item.comments],
  )

  const clearHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = useCallback(() => {
    clearHide()
    hideTimer.current = setTimeout(() => setOpen(false), HOVER_HIDE_MS)
  }, [clearHide])

  const updatePosition = useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const maxW = Math.min(320, window.innerWidth - 16)
    let left = r.left
    if (left + maxW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - maxW)
    }
    setPos({
      top: r.bottom + 6,
      left,
    })
  }, [])

  const onEnterAnchor = useCallback(() => {
    if (!showCommentHover) return
    clearHide()
    updatePosition()
    setOpen(true)
  }, [showCommentHover, clearHide, updatePosition])

  const onEnterPanel = useCallback(() => {
    clearHide()
  }, [clearHide])

  useEffect(() => {
    if (!open || !showCommentHover) return
    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open, showCommentHover, updatePosition])

  useEffect(() => () => clearHide(), [clearHide])

  const panel =
    showCommentHover && open ? (
      <div
        className="fixed z-[100] w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-slate-200 bg-white p-2 text-left shadow-lg"
        style={{ top: pos.top, left: pos.left }}
        role="tooltip"
        onMouseEnter={onEnterPanel}
        onMouseLeave={scheduleHide}
      >
        {sortedComments.length === 0 ? (
          <p className="text-[11px] text-slate-500">No comments yet.</p>
        ) : (
          <>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-[11px] text-slate-800">
              {sortedComments.map((c) => (
                <li
                  key={c.id}
                  className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <span className="block font-medium leading-snug">{c.body}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">
                    {c.authorName} · {formatIsoDateTime(c.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    ) : null

  return (
    <span
      ref={anchorRef}
      className="inline-flex min-w-0 max-w-full"
      onMouseEnter={onEnterAnchor}
      onMouseLeave={scheduleHide}
    >
      <Link to={itemDetailPath(item.id)} className={className}>
        {title}
      </Link>
      {panel ? createPortal(panel, document.body) : null}
    </span>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDismissOnEscape } from '../hooks/useDismissOnEscape'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { isAdmin } from '../lib/permissions'
import { useAuthStore } from '../store/useAuthStore'

export function UserMenu() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const setCurrentUserId = useAuthStore((s) => s.setCurrentUserId)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])
  useDismissOnEscape(open, close)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!user) return null

  return (
    <div className="flex items-center gap-1">
      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          className="flex max-w-[min(100vw-8rem,16rem)] items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 sm:max-w-none"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="font-medium text-slate-800">{user.displayName}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            {isAdmin(user) ? 'Administrator' : 'Member'}
          </span>
          <span className="text-slate-400" aria-hidden>
            ▾
          </span>
        </button>
        {open ? (
          <div
            className="absolute right-0 top-full z-50 mt-1 min-w-[12rem] rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
            role="menu"
          >
            {isAdmin(user) ? (
              <Link
                to="/settings"
                role="menuitem"
                className="block px-3 py-2 text-slate-800 hover:bg-slate-50"
                onClick={close}
              >
                Settings
              </Link>
            ) : null}
            <Link
              to="/change-password"
              role="menuitem"
              className="block px-3 py-2 text-slate-800 hover:bg-slate-50"
              onClick={close}
            >
              Change password
            </Link>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        title="Log out"
        aria-label="Log out"
        onClick={() => {
          setCurrentUserId(null)
          navigate('/login', { replace: true })
        }}
      >
        <i className="fa-solid fa-right-from-bracket text-base" aria-hidden />
      </button>
    </div>
  )
}

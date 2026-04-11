import { useEffect, useState } from 'react'

/**
 * Shown when opening the Chat page until the user grants browser notifications.
 * If permission is already `granted`, the dialog never appears. Otherwise it appears
 * on every visit to Chat until they allow (or the browser permanently denies).
 */
export function ChatNotificationPrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof Notification === 'undefined') {
      setOpen(false)
      return
    }
    if (Notification.permission === 'granted') {
      setOpen(false)
      return
    }
    setOpen(true)
  }, [])

  if (!open) return null

  const denied = Notification.permission === 'denied'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chat-notif-title"
    >
      <div className="max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-xl">
        <h2
          id="chat-notif-title"
          className="text-lg font-bold text-white"
        >
          Enable notifications?
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Get a desktop alert when a teammate sends you a message while you are on
          another tab. You can change this anytime in your browser site settings.
        </p>
        {denied ? (
          <p className="mt-3 text-sm font-medium text-amber-300">
            Notifications are blocked for this site. Use your browser’s lock icon →
            Site settings → Notifications → Allow, then reload.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            Not now
          </button>
          {!denied ? (
            <button
              type="button"
              className="rounded-lg bg-[#00B050] px-4 py-2 text-sm font-semibold text-white hover:bg-[#009948]"
              onClick={async () => {
                try {
                  const p = await Notification.requestPermission()
                  if (p === 'granted') setOpen(false)
                } catch {
                  setOpen(false)
                }
              }}
            >
              Enable notifications
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

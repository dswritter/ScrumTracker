import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChatComposer } from '../components/ChatComposer'
import { ChatMessageBody, initials } from '../components/ChatMessageBody'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useTeamContextNullable } from '../hooks/useTeamContext'
import {
  countUnreadInThread,
  getLastReadMessageId,
  markThreadRead,
} from '../lib/chatReadState'
import {
  getChatSoundEnabled,
  playChatMessageSound,
  setChatSoundEnabled,
  subscribeChatSoundPrefs,
} from '../lib/chatSound'
import {
  isRemoteSyncConfigured,
  pushTrackerSnapshotNow,
} from '../lib/pushTrackerSnapshotNow'
import {
  dmThreadKey,
  EMPTY_TEAM_CHAT_THREADS,
  formatChatListTime,
  peerFromThreadKey,
} from '../lib/teamChat'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamChatMessage } from '../types'

const CHAT_NOTIF_TIP_KEY = 'scrum-chat-notif-https-tip-dismissed'

export function Chat() {
  const ctx = useTeamContextNullable()
  const user = useCurrentUser()
  const { peerName: peerParam } = useParams<{ peerName: string }>()
  const appendTeamChatMessage = useTrackerStore((s) => s.appendTeamChatMessage)

  const peerDecoded = useMemo(() => {
    if (!peerParam) return null
    try {
      return decodeURIComponent(peerParam)
    } catch {
      return peerParam
    }
  }, [peerParam])

  const me = ctx?.user.displayName.trim() ?? ''
  const teamMembers = ctx?.teamMembers ?? []
  const mentionNames = useMemo(() => [...teamMembers], [teamMembers])

  const peers = useMemo(() => {
    if (!me) return [...teamMembers].sort((a, b) => a.localeCompare(b))
    return teamMembers
      .filter((n) => n.trim() && n.trim() !== me)
      .sort((a, b) => a.localeCompare(b))
  }, [teamMembers, me])

  const threads = useMemo(
    () => ctx?.teamChatThreads ?? EMPTY_TEAM_CHAT_THREADS,
    [ctx?.teamChatThreads],
  )
  const [draft, setDraft] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const [notifTick, setNotifTick] = useState(0)
  const [httpsTipDismissed, setHttpsTipDismissed] = useState(() =>
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(CHAT_NOTIF_TIP_KEY) === '1'
      : true,
  )
  const listRef = useRef<HTMLDivElement>(null)
  const prevThreadsRef = useRef(threads)
  const skipIncomingFxRef = useRef(true)

  const remoteSync = isRemoteSyncConfigured()
  const canUseNotification =
    typeof window !== 'undefined' && typeof Notification !== 'undefined'
  const secureContext =
    typeof window !== 'undefined' && window.isSecureContext === true
  const notifPermission = useMemo(
    () => (canUseNotification ? Notification.permission : 'denied'),
    [canUseNotification, notifTick],
  )

  useEffect(() => {
    if (!user?.id) return
    setSoundOn(getChatSoundEnabled(user.id))
    return subscribeChatSoundPrefs(() =>
      setSoundOn(getChatSoundEnabled(user.id)),
    )
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !peerDecoded || !me || !ctx?.teamId) return
    const key = dmThreadKey(me, peerDecoded)
    const msgs = threads[key] ?? []
    const lastId = msgs[msgs.length - 1]?.id ?? null
    markThreadRead(user.id, key, lastId)
  }, [user?.id, peerDecoded, me, ctx?.teamId, threads])

  useEffect(() => {
    if (!ctx || !me || !user?.id) return

    if (skipIncomingFxRef.current) {
      skipIncomingFxRef.current = false
      prevThreadsRef.current = threads
      return
    }

    for (const [key, msgs] of Object.entries(threads)) {
      const peer = peerFromThreadKey(key, me)
      if (!peer) continue
      const prevList = prevThreadsRef.current[key] ?? []
      const last = msgs[msgs.length - 1]
      const prevLast = prevList[prevList.length - 1]
      if (!last || (prevLast && prevLast.id === last.id)) continue
      if (last.authorName.trim() === me) continue

      if (getChatSoundEnabled(user.id)) {
        playChatMessageSound()
      }

      if (
        canUseNotification &&
        notifPermission === 'granted'
      ) {
        const viewingThisDm =
          peerDecoded != null && peer.trim() === peerDecoded.trim()
        if (viewingThisDm && document.visibilityState === 'visible') continue
        const body = last.body.replace(/\s+/g, ' ').trim()
        new Notification(`${last.authorName}`, {
          body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
          tag: `dm-${key}`,
        })
      }
    }
    prevThreadsRef.current = threads
  }, [
    threads,
    ctx,
    me,
    peerDecoded,
    user?.id,
    canUseNotification,
    notifPermission,
 ])

  const activeMessages: TeamChatMessage[] =
    peerDecoded && me
      ? (threads[dmThreadKey(me, peerDecoded)] ?? [])
      : []

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [peerDecoded, activeMessages.length])

  const handleSend = async () => {
    if (!ctx || !peerDecoded || !draft.trim() || !me) return
    if (!peers.some((p) => p.trim() === peerDecoded.trim())) return
    appendTeamChatMessage(ctx.teamId, me, peerDecoded, draft)
    setDraft('')
    await pushTrackerSnapshotNow()
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSend()
  }

  const dismissHttpsTip = () => {
    localStorage.setItem(CHAT_NOTIF_TIP_KEY, '1')
    setHttpsTipDismissed(true)
  }

  if (!user || !ctx) return null

  let notifButtonLabel = 'Enable alerts'
  let notifTitle =
    'Ask the browser once for permission to show message alerts when this tab is in the background.'
  let notifDisabled = false

  if (!canUseNotification) {
    notifButtonLabel = 'Alerts n/a'
    notifTitle = 'This browser does not support notifications.'
    notifDisabled = true
  } else if (!secureContext) {
    notifButtonLabel = 'HTTPS for alerts'
    notifTitle =
      'Most browsers only allow notifications on HTTPS (http://localhost is treated as secure). Host the app over HTTPS or use ngrok.'
    notifDisabled = true
  } else if (notifPermission === 'granted') {
    notifButtonLabel = 'Alerts on'
    notifTitle = 'Desktop alerts are enabled. Turn off in the browser site settings if needed.'
    notifDisabled = true
  } else if (notifPermission === 'denied') {
    notifButtonLabel = 'Alerts blocked'
    notifTitle =
      'Notifications were blocked. Use the site lock icon → Site settings → Notifications → Allow, then reload.'
    notifDisabled = true
  }

  return (
    <div className="-mx-4 -my-8 flex min-h-[calc(100svh-5rem)] flex-col sm:-mx-6 lg:-mx-8">
      {!remoteSync ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100">
          <strong className="font-semibold">Sync not configured.</strong> Chat
          stays in this browser until the app is built with{' '}
          <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/60">
            VITE_SYNC_SAME_ORIGIN=true
          </code>{' '}
          (public tunnel to the Node server) or{' '}
          <code className="rounded bg-amber-100/80 px-1 text-xs dark:bg-amber-900/60">
            VITE_SYNC_API_URL
          </code>
          . See <span className="font-medium">SERVER.md</span>.
        </div>
      ) : null}

      {!secureContext && canUseNotification && !httpsTipDismissed ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
          <span>
            Desktop notifications usually require{' '}
            <strong>HTTPS</strong> (except{' '}
            <code className="rounded bg-white px-1 dark:bg-slate-900">localhost</code>
            ).
          </span>
          <button
            type="button"
            className="text-[#007a3d] underline hover:no-underline"
            onClick={dismissHttpsTip}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex min-h-[calc(100svh-8rem)] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90">
        <aside className="flex w-full max-w-[min(100%,280px)] flex-col border-r border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50 sm:max-w-[320px]">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#0d5c2e] dark:text-[#86efac]">
                Team chat
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Direct messages
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-pressed={soundOn}
                title={
                  soundOn
                    ? 'Message sound on (click to mute)'
                    : 'Message sound off (click to enable)'
                }
                onClick={() => {
                  const next = !getChatSoundEnabled(user.id)
                  setChatSoundEnabled(user.id, next)
                  setSoundOn(next)
                }}
              >
                {soundOn ? 'Sound on' : 'Sound off'}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={notifTitle}
                disabled={notifDisabled}
                onClick={async () => {
                  if (notifDisabled || !secureContext || !canUseNotification)
                    return
                  try {
                    await Notification.requestPermission()
                    setNotifTick((t) => t + 1)
                  } catch {
                    setNotifTick((t) => t + 1)
                  }
                }}
              >
                {notifButtonLabel}
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {peers.map((p) => {
              const key = me ? dmThreadKey(me, p) : ''
              const msgs = key ? (threads[key] ?? []) : []
              const last = msgs[msgs.length - 1]
              const preview = last
                ? `${last.authorName === me ? 'You' : last.authorName.split(' ')[0]}: ${last.body.replace(/\s+/g, ' ').slice(0, 42)}${last.body.length > 42 ? '…' : ''}`
                : 'No messages yet'
              const active =
                peerDecoded != null && p.trim() === peerDecoded.trim()
              const lastRead =
                key && user.id ? getLastReadMessageId(user.id, key) : null
              const unread =
                key && user.id
                  ? countUnreadInThread(msgs, lastRead, me)
                  : 0
              return (
                <Link
                  key={p}
                  to={`/chat/${encodeURIComponent(p)}`}
                  className={`flex gap-2 border-b border-slate-100 px-3 py-2.5 transition-colors hover:bg-white dark:border-slate-800 dark:hover:bg-slate-800/60 ${
                    active
                      ? 'bg-[#00B050]/10 ring-1 ring-inset ring-[#00B050]/25 dark:bg-[#00B050]/15'
                      : ''
                  }`}
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00B050] to-emerald-700 text-[10px] font-bold text-white">
                    {initials(p)}
                    {unread > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {p}
                      </span>
                      {last ? (
                        <span className="shrink-0 text-[10px] text-slate-500 dark:text-slate-400">
                          {formatChatListTime(last.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">
                      {preview}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col bg-white dark:bg-slate-950">
          {!peerDecoded ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              Select a teammate to start chatting
            </div>
          ) : !peers.some((p) => p.trim() === peerDecoded.trim()) ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                That teammate is not on the roster.
              </p>
              <Link
                to="/chat"
                className="text-sm font-semibold text-[#007a3d] underline"
              >
                Back to chat list
              </Link>
            </div>
          ) : (
            <>
              <header className="border-b border-slate-200 bg-[#00B050]/8 px-4 py-3 dark:border-slate-700 dark:bg-[#00B050]/12">
                <h3 className="text-sm font-bold text-[#0d5c2e] dark:text-[#86efac]">
                  {peerDecoded}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Direct message
                </p>
              </header>
              <div
                ref={listRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
              >
                {activeMessages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    No messages yet — say hello.
                  </p>
                ) : (
                  activeMessages.map((m) => (
                    <div key={m.id} className="flex gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        {initials(m.authorName)}
                      </div>
                      <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/80">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-semibold text-[#0d5c2e] dark:text-[#86efac]">
                            {m.authorName}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {formatChatListTime(m.createdAt)}
                          </span>
                        </div>
                        <ChatMessageBody
                          body={m.body}
                          mentionNames={mentionNames}
                          messageId={m.id}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={onFormSubmit}
                className="border-t border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-900/50"
              >
                <div className="flex gap-2">
                  <ChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSubmit={() => void handleSend()}
                    placeholder={`Message ${peerDecoded}… (@ for names)`}
                    mentionNames={mentionNames}
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="shrink-0 rounded-xl bg-[#00B050] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#009948] disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

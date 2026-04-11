import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChatMessageBody, initials } from '../components/ChatMessageBody'
import { ChatNotificationPrompt } from '../components/ChatNotificationPrompt'
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
  dmThreadKey,
  formatChatListTime,
  peerFromThreadKey,
} from '../lib/teamChat'
import { useTrackerStore } from '../store/useTrackerStore'
import type { TeamChatMessage } from '../types'

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

  const threads = ctx?.teamChatThreads ?? {}
  const [draft, setDraft] = useState('')
  const [soundOn, setSoundOn] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const prevThreadsRef = useRef(threads)
  const skipIncomingFxRef = useRef(true)

  useEffect(() => {
    if (!user?.id) return
    setSoundOn(getChatSoundEnabled(user.id))
    return subscribeChatSoundPrefs(() =>
      setSoundOn(getChatSoundEnabled(user.id)),
    )
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !peerDecoded || !me || !ctx) return
    const key = dmThreadKey(me, peerDecoded)
    const msgs = threads[key] ?? []
    const lastId = msgs[msgs.length - 1]?.id ?? null
    markThreadRead(user.id, key, lastId)
  }, [user?.id, peerDecoded, me, ctx, threads])

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

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
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
  }, [threads, ctx, me, peerDecoded, user?.id])

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

  const handleSend = (e: FormEvent) => {
    e.preventDefault()
    if (!ctx || !peerDecoded || !draft.trim() || !me) return
    if (!peers.some((p) => p.trim() === peerDecoded.trim())) return
    appendTeamChatMessage(ctx.teamId, me, peerDecoded, draft)
    setDraft('')
  }

  if (!user || !ctx) return null

  return (
    <>
      <ChatNotificationPrompt />
      <div className="flex h-[min(70vh,calc(100vh-10rem))] min-h-[420px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-lg">
        <aside className="flex w-full max-w-[min(100%,280px)] flex-col border-r border-slate-800 bg-slate-900 sm:max-w-[320px]">
          <div className="flex items-start justify-between gap-2 border-b border-slate-800 px-3 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">Team chat</h2>
              <p className="text-[11px] text-slate-400">Direct messages</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg border border-slate-600 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800"
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
                  className={`flex gap-2 border-b border-slate-800/80 px-3 py-2.5 transition-colors hover:bg-slate-800/50 ${
                    active
                      ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/30'
                      : ''
                  }`}
                >
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-600 to-slate-800 text-[10px] font-bold text-white">
                    {initials(p)}
                    {unread > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="truncate text-xs font-semibold text-slate-100">
                        {p}
                      </span>
                      {last ? (
                        <span className="shrink-0 text-[10px] text-slate-500">
                          {formatChatListTime(last.createdAt)}
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-slate-400">{preview}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col bg-slate-950">
          {!peerDecoded ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a teammate to start chatting
            </div>
          ) : !peers.some((p) => p.trim() === peerDecoded.trim()) ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-sm text-slate-400">
                That teammate is not on the roster.
              </p>
              <Link to="/chat" className="text-sm text-amber-400 underline">
                Back to chat list
              </Link>
            </div>
          ) : (
            <>
              <header className="border-b border-slate-800 px-4 py-3">
                <h3 className="text-sm font-bold text-white">{peerDecoded}</h3>
                <p className="text-[11px] text-slate-400">Direct message</p>
              </header>
              <div
                ref={listRef}
                className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
              >
                {activeMessages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500">
                    No messages yet — say hello.
                  </p>
                ) : (
                  activeMessages.map((m) => (
                    <div key={m.id} className="flex gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-200">
                        {initials(m.authorName)}
                      </div>
                      <div className="min-w-0 rounded-lg bg-slate-800/80 px-3 py-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-xs font-semibold text-amber-200">
                            {m.authorName}
                          </span>
                          <span className="text-[10px] text-slate-500">
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
                onSubmit={handleSend}
                className="border-t border-slate-800 p-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${peerDecoded}… (use @Full Name)`}
                    className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#00B050] focus:outline-none focus:ring-1 focus:ring-[#00B050]"
                  />
                  <button
                    type="submit"
                    disabled={!draft.trim()}
                    className="shrink-0 rounded-xl bg-[#00B050] px-4 py-2 text-sm font-semibold text-white hover:bg-[#009948] disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </>
  )
}

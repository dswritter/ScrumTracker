/** Fired when sound on/off is toggled (same tab). */
export const CHAT_SOUND_PREFS_EVENT = 'scrum-chat-sound-prefs'

export function getChatSoundEnabled(userId: string): boolean {
  if (typeof localStorage === 'undefined') return true
  const v = localStorage.getItem(`scrum-chat-sound:${userId}`)
  if (v === null) return true
  return v === '1'
}

export function setChatSoundEnabled(userId: string, enabled: boolean) {
  localStorage.setItem(`scrum-chat-sound:${userId}`, enabled ? '1' : '0')
  window.dispatchEvent(new Event(CHAT_SOUND_PREFS_EVENT))
}

export function subscribeChatSoundPrefs(cb: () => void) {
  window.addEventListener(CHAT_SOUND_PREFS_EVENT, cb)
  return () => window.removeEventListener(CHAT_SOUND_PREFS_EVENT, cb)
}

let sharedCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (sharedCtx) return sharedCtx
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    sharedCtx = new AC()
    return sharedCtx
  } catch {
    return null
  }
}

/**
 * Safari / iOS block audio until a user gesture. Call when the user enables
 * sound or interacts with chat so incoming message pings can play later.
 */
export function primeChatSoundFromUserGesture(): void {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const buffer = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch {
    /* ignore */
  }
}

/** Short pleasant ping (Web Audio API; no asset file). */
export function playChatMessageSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    void ctx.resume()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 784
    o.connect(g)
    g.connect(ctx.destination)
    const t0 = ctx.currentTime
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12)
    o.start(t0)
    o.stop(t0 + 0.13)
  } catch {
    /* autoplay or API blocked */
  }
}

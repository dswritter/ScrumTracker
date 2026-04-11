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

/** Short pleasant ping (Web Audio API; no asset file). */
export function playChatMessageSound() {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new AC()
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
    o.onended = () => {
      void ctx.close()
    }
  } catch {
    /* autoplay or API blocked */
  }
}

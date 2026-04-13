import { useAuthStore } from '../store/useAuthStore'

const AUTH_KEY = 'scrum-tracker-auth'

/** Keep sign-in in sync when another tab logs in or out (localStorage + storage event). */
export function registerAuthStorageSync(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key !== AUTH_KEY) return
    if (e.newValue === null) {
      useAuthStore.setState({ currentUserId: null })
      return
    }
    try {
      const parsed = JSON.parse(e.newValue) as {
        state?: { currentUserId?: string | null }
      }
      useAuthStore.setState({
        currentUserId: parsed.state?.currentUserId ?? null,
      })
    } catch {
      /* ignore corrupt storage */
    }
  })
}

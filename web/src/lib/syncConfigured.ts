/** True when the app is built to talk to the sync API (same host or explicit URL). */
export function isTrackerSyncEnabled(): boolean {
  return (
    import.meta.env.VITE_SYNC_SAME_ORIGIN === 'true' ||
    Boolean(import.meta.env.VITE_SYNC_API_URL?.trim())
  )
}

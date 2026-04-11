/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** When true, API + WS use the current page origin (SPA served by server/server.mjs + one public tunnel). */
  readonly VITE_SYNC_SAME_ORIGIN?: string
  readonly VITE_SYNC_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

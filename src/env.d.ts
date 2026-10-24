/// <reference types="vite-plugin-pwa/client" />

/** Short commit hash of this build ("fd41798"), "dev" locally. Set in vite.config.ts. */
declare const __APP_VERSION__: string
/** Build time in ms since epoch. */
declare const __BUILD_TIME__: number

interface ImportMetaEnv {
  /** The Supabase project of the accounts ("https://xyz.supabase.co"); without it there are no accounts. */
  readonly VITE_SUPABASE_URL?: string
  /** Its public (anon) key: row level security keeps every account's records to itself. */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Where crash reports go (Sentry); without it nothing is reported. docs/error-reports-setup.md */
  readonly VITE_SENTRY_DSN?: string
}

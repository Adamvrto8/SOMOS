import type { SupabaseClient, User } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { adoptDevice, pendingChanges, wipeLearnerData } from './sync/engine'
import { installSyncHooks, setRecording } from './sync/outbox'
import { startSync, stopSync, syncNow } from './sync/scheduler'

// Optional accounts (docs/superpowers/specs/2026-10-19-accounts-design.md): Supabase signs in with Google or
// an e-mail code. Supabase's library is loaded only for accounts; a marker says one is signed in here.

const URL = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Accounts need the project's address and key at build time; without them the app has none. */
export const accountsAvailable = Boolean(URL && ANON_KEY)

export interface Account {
  userId: string
  email: string
}

const MARKER = 'somos-account'
/** Where supabase-js keeps the session (and, with "-code-verifier", the PKCE verifier during a Google sign-in). */
const AUTH_STORAGE_KEY = 'somos-auth'
/** Where Google sends the learner back; the sign-in page finishes there. */
export const SIGN_IN_PATH = '/profile/sign-in'

function readMarker(): Account | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(MARKER) ?? 'null')
    if (typeof data !== 'object' || data === null) return null
    const { userId, email } = data as Partial<Account>
    return typeof userId === 'string' && typeof email === 'string' ? { userId, email } : null
  } catch {
    return null
  }
}

let account: Account | null = accountsAvailable ? readMarker() : null
const listeners = new Set<() => void>()

function setAccount(next: Account | null) {
  account = next
  try {
    if (next) localStorage.setItem(MARKER, JSON.stringify(next))
    else localStorage.removeItem(MARKER)
  } catch {
    // Blocked storage: signed in for this session only.
  }
  listeners.forEach((notify) => notify())
}

export const getAccount = () => account

export function useAccount(): Account | null {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
    getAccount,
  )
}

let client: Promise<SupabaseClient> | undefined

function getClient(): Promise<SupabaseClient> {
  if (!accountsAvailable) return Promise.reject(new Error('accounts are not configured'))
  // On the page Google returns to, creating the client exchanges the ?code= for a session (PKCE).
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(URL!, ANON_KEY!, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
    }),
  )
  return client
}

async function startSyncing(): Promise<void> {
  const [{ SupabaseServer }, supabase] = await Promise.all([import('./sync/supabaseServer'), getClient()])
  setRecording(true)
  startSync(new SupabaseServer(supabase))
}

/**
 * Signed in: the first time on this device, its progress goes to the account too. The data of another
 * account still here (the screens never allow that) leaves first and is not taken over.
 */
async function signedIn(user: User): Promise<void> {
  if (account?.userId === user.id) return
  if (account) {
    await stopSync()
    await wipeLearnerData()
  } else {
    await adoptDevice()
  }
  setAccount({ userId: user.id, email: user.email ?? '' })
  await startSyncing()
}

/** At start: hooks for the outbox, and syncing when an account is signed in. */
export function startAccount(): void {
  installSyncHooks()
  if (!account) return
  // Noted from the first change on, while Supabase's library is still loading.
  setRecording(true)
  void startSyncing()
}

export async function signInWithGoogle(): Promise<void> {
  const supabase = await getClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${SIGN_IN_PATH}` },
  })
  if (error) throw new Error(error.message)
}

/** Back from Google: true when that left a session. */
export async function completeOAuth(): Promise<boolean> {
  const supabase = await getClient()
  const { data } = await supabase.auth.getSession()
  if (!data.session) return false
  await signedIn(data.session.user)
  return true
}

/** E-mails a 6-digit code (an account is made on the first sign-in). */
export async function sendCode(email: string): Promise<void> {
  const supabase = await getClient()
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw new Error(error.message)
}

export async function verifyCode(email: string, code: string): Promise<void> {
  const supabase = await getClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error || !data.user) throw new Error(error?.message ?? 'no user')
  await signedIn(data.user)
}

async function leave(): Promise<void> {
  await stopSync()
  const supabase = await getClient()
  // This device only: the account's other devices stay signed in. Whatever the server answers,
  // the session's tokens must not stay behind.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined)
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`)
  } catch {
    // Blocked storage held no session.
  }
  await wipeLearnerData()
  setAccount(null)
}

/**
 * Sends what is left, then the account's data leaves this device. 'pending' = changes could not be sent
 * (offline): nothing happened; `force` signs out anyway.
 */
export async function signOut({ force = false }: { force?: boolean } = {}): Promise<'done' | 'pending'> {
  await syncNow()
  if (!force && (await pendingChanges()) > 0) return 'pending'
  await leave()
  return 'done'
}

/** The account and everything on the server, then this device's copy. */
export async function deleteAccount(): Promise<void> {
  const supabase = await getClient()
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw new Error(error.message)
  await leave()
}

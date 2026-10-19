// Where this device stands with its account: how far it has pulled, and what of the localStorage
// stores is known to be on the server (their JSON), so only what differs is sent.

export interface SyncState {
  cursor: number // the last rev pulled
  known: Record<string, string> // "lesson|cloze:all:A1:1" → JSON of the record on the server
  settingsAt: number // changedAt of the settings in effect here
}

const KEY = 'somos-sync-state'
const empty = (): SyncState => ({ cursor: 0, known: {}, settingsAt: 0 })

function read(): SyncState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    if (!raw) return empty()
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return empty()
    const { cursor, known, settingsAt } = data as Partial<SyncState>
    const validKnown =
      typeof known === 'object' && known !== null && Object.values(known).every((value) => typeof value === 'string')
    return {
      cursor: typeof cursor === 'number' ? cursor : 0,
      known: validKnown ? known : {},
      settingsAt: typeof settingsAt === 'number' ? settingsAt : 0,
    }
  } catch {
    return empty()
  }
}

// Kept in memory too: storage may be blocked (or missing, in the unit tests).
let state: SyncState = read()

export const loadSyncState = (): SyncState => state

export function saveSyncState(next: SyncState): void {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // The next round starts from what is in memory.
  }
}

export function clearSyncState(): void {
  state = empty()
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
}

export const knownKey = (kind: string, key: string) => `${kind}|${key}`

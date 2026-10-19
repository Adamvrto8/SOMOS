import { applySettings, currentSettings } from '../backup'
import { getProgressionSnapshot, mergeProgression, parseProgression, subscribeProgression } from '../lessonProgress'
import { parseSettingsBackup, type SettingsBackup } from '../settingsBackup'
import { getTestResults, mergeTestResults, parseTestResults, subscribeTestResults } from '../testProgress'
import type { SyncRecord } from './kinds'
import { knownKey, type SyncState } from './state'

// The localStorage stores sync by difference: a lesson or test record, or the settings, whose JSON is not
// what the server is known to have goes out. Lessons and tests merge by the better result, settings by time.

const SETTINGS_KEY = 'settings'

/** The settings that travel: everything a backup carries but the reminder, which belongs to a phone. */
function syncedSettings(): SettingsBackup {
  const { reminder: _reminder, ...rest } = currentSettings()
  return rest
}

/** What of the stores differs from the server, stamped `now`. */
export function storeChanges(state: SyncState, now: number): SyncRecord[] {
  const out: SyncRecord[] = []
  const add = (kind: 'lesson' | 'test' | 'settings', key: string, data: unknown) => {
    if (JSON.stringify(data) !== state.known[knownKey(kind, key)]) out.push({ kind, key, data, deleted: false, changedAt: now })
  }
  for (const [key, record] of Object.entries(getProgressionSnapshot())) add('lesson', key, record)
  for (const [key, record] of Object.entries(getTestResults())) add('test', key, record)
  add('settings', SETTINGS_KEY, syncedSettings())
  return out
}

/** After a push: the server now has these. */
export function markStoresPushed(state: SyncState, records: SyncRecord[]): SyncState {
  const known = { ...state.known }
  let settingsAt = state.settingsAt
  for (const record of records) {
    known[knownKey(record.kind, record.key)] = JSON.stringify(record.data)
    if (record.kind === 'settings') settingsAt = record.changedAt
  }
  return { ...state, known, settingsAt }
}

/** A store record from another device. A worse lesson or test result leaves the better one here (it goes out next). */
export async function applyStoreRecord(state: SyncState, record: SyncRecord): Promise<SyncState> {
  const known = { ...state.known, [knownKey(record.kind, record.key)]: JSON.stringify(record.data) }
  switch (record.kind) {
    case 'lesson':
      mergeProgression(parseProgression({ [record.key]: record.data }).records, true)
      return { ...state, known }
    case 'test':
      mergeTestResults(parseTestResults({ [record.key]: record.data }).records, true)
      return { ...state, known }
    case 'settings': {
      if (record.changedAt <= state.settingsAt) return state
      const { reminder: _reminder, ...settings } = parseSettingsBackup(record.data)
      await applySettings(settings)
      return { ...state, known, settingsAt: record.changedAt }
    }
    default:
      return state
  }
}

/** Lessons and tests change while learning: the scheduler syncs a little later. */
export function subscribeStores(notify: () => void): () => void {
  const offLessons = subscribeProgression(notify)
  const offTests = subscribeTestResults(notify)
  return () => {
    offLessons()
    offTests()
  }
}

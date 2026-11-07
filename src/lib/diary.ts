import { useLiveQuery } from 'dexie-react-hooks'
import { dayKey } from './dates'
import { db, type DiaryEntry } from './db'

// Denník: one entry per local day. Saved while typing; both fields empty = the day is removed.
// Synced as table kind "diary" (src/lib/sync/kinds.ts) and carried by the backup.

export const DIARY_MAX = 5000
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export const todayKey = () => dayKey(new Date())

/** A real calendar day, not after `today`. */
export function isDiaryDate(date: string, today = todayKey()): boolean {
  const m = DATE.exec(date)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return dayKey(d) === date && date <= today
}

const isStr = (x: unknown): x is string => typeof x === 'string'
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

export function isDiaryEntry(x: unknown): x is DiaryEntry {
  if (typeof x !== 'object' || x === null) return false
  const e = x as Record<string, unknown>
  return isStr(e.date) && DATE.test(e.date) && isStr(e.learned) && isStr(e.es) && isNum(e.createdAt) && isNum(e.updatedAt)
}

/** Stores a day's two fields (cut to DIARY_MAX); both empty removes the day. */
export async function saveDiaryEntry(date: string, fields: { learned: string; es: string }, now = Date.now()): Promise<'saved' | 'removed' | 'unchanged'> {
  const learned = fields.learned.slice(0, DIARY_MAX)
  const es = fields.es.slice(0, DIARY_MAX)
  return db.transaction('rw', db.diary, async () => {
    const existing = await db.diary.get(date)
    if (!learned.trim() && !es.trim()) {
      if (!existing) return 'unchanged'
      await db.diary.delete(date)
      return 'removed'
    }
    if (existing && existing.learned === learned && existing.es === es) return 'unchanged'
    await db.diary.put({ date, learned, es, createdAt: existing?.createdAt ?? now, updatedAt: now })
    return 'saved'
  })
}

/** The rows of a backup that should be written here: days not here, or edited later than here. */
export function newerDiaryEntries(local: DiaryEntry[], incoming: DiaryEntry[]): DiaryEntry[] {
  const here = new Map(local.map((e) => [e.date, e.updatedAt]))
  return incoming.filter((e) => e.updatedAt > (here.get(e.date) ?? -Infinity))
}

/** `null` = no entry that day, `undefined` = still loading. */
export function useDiaryEntry(date: string): DiaryEntry | null | undefined {
  return useLiveQuery(async () => (await db.diary.get(date)) ?? null, [date])
}

/** Every entry, newest day first. */
export function useDiaryEntries(): DiaryEntry[] | undefined {
  return useLiveQuery(() => db.diary.orderBy('date').reverse().toArray(), [])
}

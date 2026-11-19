import { useLiveQuery } from 'dexie-react-hooks'
import { dayKey } from './dates'
import { db, type DiaryEntry } from './db'

// Denník: one free text per local day. Saved while typing; an empty text removes the day.
// Synced as table kind "diary" (src/lib/sync/kinds.ts) and carried by the backup.

export const DIARY_MAX = 20_000
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

/** A diary row in the current shape, also from the old one (learned + es, before 2026-11-19); null when broken. */
export function toDiaryEntry(x: unknown): DiaryEntry | null {
  if (typeof x !== 'object' || x === null) return null
  const e = x as Record<string, unknown>
  if (!isStr(e.date) || !DATE.test(e.date) || !isNum(e.createdAt) || !isNum(e.updatedAt)) return null
  let text: string
  if (isStr(e.text)) text = e.text
  else if (isStr(e.learned) && isStr(e.es)) text = [e.learned.trim(), e.es.trim()].filter(Boolean).join('\n\n')
  else return null
  return { date: e.date, text: text.slice(0, DIARY_MAX), createdAt: e.createdAt, updatedAt: e.updatedAt }
}

/** The diary rows of a backup, old shape converted; `skipped` counts the broken ones. */
export function diaryEntriesOf(list: unknown): { entries: DiaryEntry[]; skipped: number } {
  if (!Array.isArray(list)) return { entries: [], skipped: 0 }
  const entries = list.map(toDiaryEntry).filter((e): e is DiaryEntry => e !== null)
  return { entries, skipped: list.length - entries.length }
}

/** Stores a day's text (cut to DIARY_MAX); an empty one removes the day. */
export async function saveDiaryEntry(date: string, value: string, now = Date.now()): Promise<'saved' | 'removed' | 'unchanged'> {
  const text = value.slice(0, DIARY_MAX)
  return db.transaction('rw', db.diary, async () => {
    const existing = await db.diary.get(date)
    if (!text.trim()) {
      if (!existing) return 'unchanged'
      await db.diary.delete(date)
      return 'removed'
    }
    if (existing && existing.text === text) return 'unchanged'
    await db.diary.put({ date, text, createdAt: existing?.createdAt ?? now, updatedAt: now })
    return 'saved'
  })
}

/** Adds a block (an answer of SOMO) at the end of a day, after a blank line; once, and never over DIARY_MAX. */
export async function appendToDiary(date: string, block: string, now = Date.now()): Promise<'saved' | 'unchanged' | 'full'> {
  const add = block.trim()
  return db.transaction('rw', db.diary, async () => {
    const existing = await db.diary.get(date)
    const before = existing?.text.trimEnd() ?? ''
    if (before.includes(add)) return 'unchanged'
    const text = before ? `${before}\n\n${add}` : add
    if (text.length > DIARY_MAX) return 'full'
    await db.diary.put({ date, text, createdAt: existing?.createdAt ?? now, updatedAt: now })
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

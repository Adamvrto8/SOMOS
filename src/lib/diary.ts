import { useLiveQuery } from 'dexie-react-hooks'
import { dayKey } from './dates'
import { db, type DiaryNote } from './db'

// Denník: notes, any number a day, each with an optional title (docs/superpowers/specs/2026-11-19-diary-notes-design.md).
// Saved while typing and by "Uložiť"; a note with neither title nor text is removed.
// Synced as table kind "diary" keyed by the note's id (src/lib/sync/kinds.ts) and carried by the backup.

export const DIARY_MAX = 20_000
export const TITLE_MAX = 200
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export const todayKey = () => dayKey(new Date())

/** A real calendar day, not after `today`. */
export function isDiaryDate(date: string, today = todayKey()): boolean {
  const m = DATE.exec(date)
  if (!m) return false
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return dayKey(d) === date && date <= today
}

// crypto.randomUUID needs a secure context, which the LAN dev server is not.
export const newDiaryNoteId = () => `n-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const isStr = (x: unknown): x is string => typeof x === 'string'
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/**
 * A note in the current shape, also from the older ones: a day's one text (until 2026-11-19) and its two fields
 * (learned + es, before that) become the note whose id is the date. null when broken.
 */
export function toDiaryNote(x: unknown): DiaryNote | null {
  if (typeof x !== 'object' || x === null) return null
  const e = x as Record<string, unknown>
  if (!isStr(e.date) || !DATE.test(e.date) || !isNum(e.createdAt) || !isNum(e.updatedAt)) return null
  let text: string
  if (isStr(e.text)) text = e.text
  else if (isStr(e.learned) && isStr(e.es)) text = [e.learned.trim(), e.es.trim()].filter(Boolean).join('\n\n')
  else return null
  const id = isStr(e.id) && e.id ? e.id : e.date
  const title = isStr(e.title) ? e.title.slice(0, TITLE_MAX) : ''
  return { id, date: e.date, title, text: text.slice(0, DIARY_MAX), createdAt: e.createdAt, updatedAt: e.updatedAt }
}

/** The diary rows of a backup, older shapes converted; `skipped` counts the broken ones. */
export function diaryNotesOf(list: unknown): { notes: DiaryNote[]; skipped: number } {
  if (!Array.isArray(list)) return { notes: [], skipped: 0 }
  const notes = list.map(toDiaryNote).filter((e): e is DiaryNote => e !== null)
  return { notes, skipped: list.length - notes.length }
}

/** Stores a note (title and text cut to their limits); one with neither title nor text is removed. */
export async function saveDiaryNote(
  note: Pick<DiaryNote, 'id' | 'date' | 'title' | 'text'>,
  now = Date.now(),
): Promise<'saved' | 'removed' | 'unchanged'> {
  const title = note.title.slice(0, TITLE_MAX)
  const text = note.text.slice(0, DIARY_MAX)
  return db.transaction('rw', db.diaryNotes, async () => {
    const existing = await db.diaryNotes.get(note.id)
    if (!title.trim() && !text.trim()) {
      if (!existing) return 'unchanged'
      await db.diaryNotes.delete(note.id)
      return 'removed'
    }
    if (existing && existing.title === title && existing.text === text) return 'unchanged'
    const date = existing?.date ?? note.date
    await db.diaryNotes.put({ id: note.id, date, title, text, createdAt: existing?.createdAt ?? now, updatedAt: now })
    return 'saved'
  })
}

export async function deleteDiaryNote(id: string): Promise<void> {
  await db.diaryNotes.delete(id)
}

/** A new note of a day (an answer of SOMO); the same title and text on that day again adds nothing. */
export async function addDiaryNote(date: string, title: string, text: string, now = Date.now()): Promise<{ id: string; added: boolean }> {
  const t = title.trim().slice(0, TITLE_MAX)
  const body = text.trim().slice(0, DIARY_MAX)
  return db.transaction('rw', db.diaryNotes, async () => {
    const same = (await db.diaryNotes.where('date').equals(date).toArray()).find((n) => n.title === t && n.text === body)
    if (same) return { id: same.id, added: false }
    const id = newDiaryNoteId()
    await db.diaryNotes.add({ id, date, title: t, text: body, createdAt: now, updatedAt: now })
    return { id, added: true }
  })
}

/** The rows of a backup that should be written here: notes not here, or edited later than here. */
export function newerDiaryNotes(local: DiaryNote[], incoming: DiaryNote[]): DiaryNote[] {
  const here = new Map(local.map((e) => [e.id, e.updatedAt]))
  return incoming.filter((e) => e.updatedAt > (here.get(e.id) ?? -Infinity))
}

/** Newest day first; within a day the newest note first. */
export const byNewest = (a: DiaryNote, b: DiaryNote) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt

/** `null` = no such note, `undefined` = still loading. */
export function useDiaryNote(id: string): DiaryNote | null | undefined {
  return useLiveQuery(async () => (await db.diaryNotes.get(id)) ?? null, [id])
}

/** Every note, newest first. */
export function useDiaryNotes(): DiaryNote[] | undefined {
  return useLiveQuery(async () => (await db.diaryNotes.toArray()).sort(byNewest), [])
}

/** The notes of one day, newest first. */
export function useDiaryNotesOf(date: string): DiaryNote[] | undefined {
  return useLiveQuery(async () => (await db.diaryNotes.where('date').equals(date).toArray()).sort(byNewest), [date])
}

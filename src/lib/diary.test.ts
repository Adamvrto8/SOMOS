import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addDiaryNote, byNewest, DIARY_MAX, diaryNotesOf, isDiaryDate, newerDiaryNotes, saveDiaryNote, TITLE_MAX, toDiaryNote } from './diary'

beforeEach(() => db.diaryNotes.clear())

const note = (over: Partial<{ id: string; date: string; title: string; text: string }> = {}) => ({
  id: 'n-1',
  date: '2026-11-07',
  title: '',
  text: 'el pretérito',
  ...over,
})

describe('isDiaryDate', () => {
  it('takes a real day up to today', () => {
    expect(isDiaryDate('2026-11-07', '2026-11-07')).toBe(true)
    expect(isDiaryDate('2024-02-29', '2026-11-07')).toBe(true)
  })
  it('refuses a future day, a day that does not exist and anything else', () => {
    expect(isDiaryDate('2026-11-08', '2026-11-07')).toBe(false)
    expect(isDiaryDate('2026-13-45', '2026-11-07')).toBe(false)
    expect(isDiaryDate('2025-02-29', '2026-11-07')).toBe(false)
    expect(isDiaryDate('abc', '2026-11-07')).toBe(false)
  })
})

describe('saveDiaryNote', () => {
  it('creates, then updates keeping createdAt and the day', async () => {
    expect(await saveDiaryNote(note(), 100)).toBe('saved')
    expect(await saveDiaryNote(note({ date: '2026-11-09', title: 'ir', text: 'el pretérito de ir' }), 200)).toBe('saved')
    expect(await db.diaryNotes.get('n-1')).toEqual({ id: 'n-1', date: '2026-11-07', title: 'ir', text: 'el pretérito de ir', createdAt: 100, updatedAt: 200 })
  })
  it('does not write the same note again', async () => {
    await saveDiaryNote(note(), 100)
    expect(await saveDiaryNote(note(), 200)).toBe('unchanged')
    expect((await db.diaryNotes.get('n-1'))?.updatedAt).toBe(100)
  })
  it('keeps a note with only a title; removes one with neither title nor text', async () => {
    expect(await saveDiaryNote(note({ title: 'Ser', text: '' }), 100)).toBe('saved')
    expect(await saveDiaryNote(note({ title: ' ', text: '  \n' }), 200)).toBe('removed')
    expect(await db.diaryNotes.get('n-1')).toBeUndefined()
    expect(await saveDiaryNote(note({ text: '' }), 300)).toBe('unchanged')
  })
  it('cuts the title and the text to their limits', async () => {
    await saveDiaryNote(note({ title: 't'.repeat(TITLE_MAX + 5), text: 'a'.repeat(DIARY_MAX + 10) }), 100)
    const stored = await db.diaryNotes.get('n-1')
    expect(stored?.title).toHaveLength(TITLE_MAX)
    expect(stored?.text).toHaveLength(DIARY_MAX)
  })
})

describe('addDiaryNote', () => {
  it('adds a new note to a day beside the others, once', async () => {
    await saveDiaryNote(note({ text: 'moja poznámka' }), 100)
    const first = await addDiaryNote('2026-11-07', 'Čo je fue?', 'Fue je ser aj ir.', 200)
    expect(first.added).toBe(true)
    expect(await db.diaryNotes.get(first.id)).toEqual({
      id: first.id,
      date: '2026-11-07',
      title: 'Čo je fue?',
      text: 'Fue je ser aj ir.',
      createdAt: 200,
      updatedAt: 200,
    })
    expect(await addDiaryNote('2026-11-07', 'Čo je fue?', 'Fue je ser aj ir.', 300)).toEqual({ id: first.id, added: false })
    expect(await db.diaryNotes.count()).toBe(2)
  })
})

describe('toDiaryNote', () => {
  it('takes the current shape', () => {
    const current = { id: 'n-1', date: '2026-11-07', title: 'Hola', text: 'ahoj', createdAt: 1, updatedAt: 2 }
    expect(toDiaryNote(current)).toEqual(current)
  })
  it('turns a day of an older app into the note keyed by its date', () => {
    expect(toDiaryNote({ date: '2026-11-07', text: 'Hola', createdAt: 1, updatedAt: 2 })).toEqual({
      id: '2026-11-07',
      date: '2026-11-07',
      title: '',
      text: 'Hola',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(toDiaryNote({ date: '2026-11-07', learned: ' el pretérito ', es: 'Hoy fui al cine.', createdAt: 1, updatedAt: 2 })?.text).toBe(
      'el pretérito\n\nHoy fui al cine.',
    )
  })
  it('refuses a broken row', () => {
    expect(toDiaryNote({ date: 'nope', text: 'x', createdAt: 1, updatedAt: 2 })).toBeNull()
    expect(toDiaryNote({ date: '2026-11-07', es: 'Hola', createdAt: 1, updatedAt: 2 })).toBeNull()
    expect(toDiaryNote(null)).toBeNull()
  })
  it('lists rows of a backup and counts the broken ones', () => {
    expect(diaryNotesOf([{ date: '2026-11-07', learned: 'a', es: '', createdAt: 1, updatedAt: 2 }, { date: 'x' }])).toEqual({
      notes: [{ id: '2026-11-07', date: '2026-11-07', title: '', text: 'a', createdAt: 1, updatedAt: 2 }],
      skipped: 1,
    })
    expect(diaryNotesOf(undefined)).toEqual({ notes: [], skipped: 0 })
  })
})

describe('newerDiaryNotes', () => {
  const row = (id: string, updatedAt: number, text = 'x') => ({ id, date: '2026-11-07', title: '', text, createdAt: 1, updatedAt })
  it('keeps the newer edit of a note and every note not here', () => {
    const local = [row('a', 50), row('b', 300)]
    const incoming = [row('a', 80, 'newer'), row('b', 200, 'older'), row('c', 10)]
    expect(newerDiaryNotes(local, incoming).map((e) => e.id)).toEqual(['a', 'c'])
  })
})

describe('byNewest', () => {
  it('puts the newest day first, and the newest note first within a day', () => {
    const at = (id: string, date: string, createdAt: number) => ({ id, date, title: '', text: 'x', createdAt, updatedAt: createdAt })
    const sorted = [at('a', '2026-11-06', 5), at('b', '2026-11-07', 1), at('c', '2026-11-07', 9)].sort(byNewest)
    expect(sorted.map((n) => n.id)).toEqual(['c', 'b', 'a'])
  })
})

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { appendToDiary, DIARY_MAX, diaryEntriesOf, isDiaryDate, newerDiaryEntries, saveDiaryEntry, toDiaryEntry } from './diary'

beforeEach(() => db.diary.clear())

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

describe('saveDiaryEntry', () => {
  it('creates, then updates keeping createdAt', async () => {
    expect(await saveDiaryEntry('2026-11-07', 'el pretérito', 100)).toBe('saved')
    expect(await saveDiaryEntry('2026-11-07', 'el pretérito de ir', 200)).toBe('saved')
    expect(await db.diary.get('2026-11-07')).toEqual({ date: '2026-11-07', text: 'el pretérito de ir', createdAt: 100, updatedAt: 200 })
  })
  it('does not write the same text again', async () => {
    await saveDiaryEntry('2026-11-07', 'Hola', 100)
    expect(await saveDiaryEntry('2026-11-07', 'Hola', 200)).toBe('unchanged')
    expect((await db.diary.get('2026-11-07'))?.updatedAt).toBe(100)
  })
  it('removes the day when the text is empty or only spaces', async () => {
    await saveDiaryEntry('2026-11-07', 'x', 100)
    expect(await saveDiaryEntry('2026-11-07', '  \n', 200)).toBe('removed')
    expect(await db.diary.get('2026-11-07')).toBeUndefined()
  })
  it('cuts the text to the limit', async () => {
    await saveDiaryEntry('2026-11-07', 'a'.repeat(DIARY_MAX + 10), 100)
    expect((await db.diary.get('2026-11-07'))?.text).toHaveLength(DIARY_MAX)
  })
})

describe('appendToDiary', () => {
  it('starts a day that has no entry', async () => {
    expect(await appendToDiary('2026-11-07', 'Čo je fue?\nFue je ser aj ir.', 100)).toBe('saved')
    expect(await db.diary.get('2026-11-07')).toEqual({ date: '2026-11-07', text: 'Čo je fue?\nFue je ser aj ir.', createdAt: 100, updatedAt: 100 })
  })
  it('adds after a blank line, once', async () => {
    await saveDiaryEntry('2026-11-07', 'moja poznámka\n', 100)
    expect(await appendToDiary('2026-11-07', 'blok', 200)).toBe('saved')
    expect(await appendToDiary('2026-11-07', 'blok', 300)).toBe('unchanged')
    expect(await db.diary.get('2026-11-07')).toMatchObject({ text: 'moja poznámka\n\nblok', createdAt: 100, updatedAt: 200 })
  })
  it('does not go over the limit', async () => {
    await saveDiaryEntry('2026-11-07', 'a'.repeat(DIARY_MAX - 3), 100)
    expect(await appendToDiary('2026-11-07', 'blok', 200)).toBe('full')
    expect((await db.diary.get('2026-11-07'))?.updatedAt).toBe(100)
  })
})

describe('toDiaryEntry', () => {
  it('takes the new shape', () => {
    expect(toDiaryEntry({ date: '2026-11-07', text: 'Hola', createdAt: 1, updatedAt: 2 })).toEqual({ date: '2026-11-07', text: 'Hola', createdAt: 1, updatedAt: 2 })
  })
  it('joins the two fields of the old shape, leaving out empty ones', () => {
    expect(toDiaryEntry({ date: '2026-11-07', learned: ' el pretérito ', es: 'Hoy fui al cine.', createdAt: 1, updatedAt: 2 })?.text).toBe('el pretérito\n\nHoy fui al cine.')
    expect(toDiaryEntry({ date: '2026-11-07', learned: '', es: 'Hola', createdAt: 1, updatedAt: 2 })?.text).toBe('Hola')
  })
  it('refuses a broken row', () => {
    expect(toDiaryEntry({ date: 'nope', text: 'x', createdAt: 1, updatedAt: 2 })).toBeNull()
    expect(toDiaryEntry({ date: '2026-11-07', es: 'Hola', createdAt: 1, updatedAt: 2 })).toBeNull()
    expect(toDiaryEntry(null)).toBeNull()
  })
  it('lists rows of a backup and counts the broken ones', () => {
    expect(diaryEntriesOf([{ date: '2026-11-07', learned: 'a', es: '', createdAt: 1, updatedAt: 2 }, { date: 'x' }])).toEqual({
      entries: [{ date: '2026-11-07', text: 'a', createdAt: 1, updatedAt: 2 }],
      skipped: 1,
    })
    expect(diaryEntriesOf(undefined)).toEqual({ entries: [], skipped: 0 })
  })
})

describe('newerDiaryEntries', () => {
  const entry = (date: string, updatedAt: number, text = 'x') => ({ date, text, createdAt: 1, updatedAt })
  it('keeps the newer edit of a day and every day not here', () => {
    const local = [entry('2026-11-06', 50), entry('2026-11-07', 300)]
    const incoming = [entry('2026-11-06', 80, 'newer'), entry('2026-11-07', 200, 'older'), entry('2026-11-05', 10)]
    expect(newerDiaryEntries(local, incoming).map((e) => e.date)).toEqual(['2026-11-06', '2026-11-05'])
  })
})

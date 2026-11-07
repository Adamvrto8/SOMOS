import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { diaryPrompts } from '../data'
import { db } from './db'
import { DIARY_MAX, isDiaryDate, isDiaryEntry, newerDiaryEntries, promptOfDay, saveDiaryEntry } from './diary'

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
    expect(await saveDiaryEntry('2026-11-07', { learned: 'el pretérito', es: 'Hoy fui al mercado.' }, 100)).toBe('saved')
    expect(await saveDiaryEntry('2026-11-07', { learned: 'el pretérito', es: 'Hoy fui al mercado con Ana.' }, 200)).toBe('saved')
    expect(await db.diary.get('2026-11-07')).toEqual({ date: '2026-11-07', learned: 'el pretérito', es: 'Hoy fui al mercado con Ana.', createdAt: 100, updatedAt: 200 })
  })
  it('does not write the same text again', async () => {
    await saveDiaryEntry('2026-11-07', { learned: '', es: 'Hola' }, 100)
    expect(await saveDiaryEntry('2026-11-07', { learned: '', es: 'Hola' }, 200)).toBe('unchanged')
    expect((await db.diary.get('2026-11-07'))?.updatedAt).toBe(100)
  })
  it('removes the day when both fields are empty or only spaces', async () => {
    await saveDiaryEntry('2026-11-07', { learned: 'x', es: '' }, 100)
    expect(await saveDiaryEntry('2026-11-07', { learned: '  ', es: '\n' }, 200)).toBe('removed')
    expect(await db.diary.get('2026-11-07')).toBeUndefined()
  })
  it('cuts a field to the limit', async () => {
    await saveDiaryEntry('2026-11-07', { learned: '', es: 'a'.repeat(DIARY_MAX + 10) }, 100)
    expect((await db.diary.get('2026-11-07'))?.es).toHaveLength(DIARY_MAX)
  })
})

describe('newerDiaryEntries', () => {
  const entry = (date: string, updatedAt: number, es = 'x') => ({ date, learned: '', es, createdAt: 1, updatedAt })
  it('keeps the newer edit of a day and every day not here', () => {
    const local = [entry('2026-11-06', 50), entry('2026-11-07', 300)]
    const incoming = [entry('2026-11-06', 80, 'newer'), entry('2026-11-07', 200, 'older'), entry('2026-11-05', 10)]
    expect(newerDiaryEntries(local, incoming).map((e) => e.date)).toEqual(['2026-11-06', '2026-11-05'])
  })
})

describe('isDiaryEntry', () => {
  it('accepts a row and refuses a broken one', () => {
    expect(isDiaryEntry({ date: '2026-11-07', learned: '', es: 'Hola', createdAt: 1, updatedAt: 2 })).toBe(true)
    expect(isDiaryEntry({ date: 'nope', learned: '', es: 'Hola', createdAt: 1, updatedAt: 2 })).toBe(false)
    expect(isDiaryEntry({ date: '2026-11-07', es: 'Hola', createdAt: 1, updatedAt: 2 })).toBe(false)
  })
})

describe('promptOfDay', () => {
  it('changes with the day and starts the list on 1 January', () => {
    expect(promptOfDay('2026-11-07')).not.toEqual(promptOfDay('2026-11-08'))
    expect(promptOfDay('2026-01-01')).toEqual(diaryPrompts[0])
    expect(promptOfDay('2026-01-31')).toEqual(diaryPrompts[30 % diaryPrompts.length])
  })
})

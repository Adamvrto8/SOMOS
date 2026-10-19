import { beforeEach, describe, expect, it, vi } from 'vitest'

// backup.ts pulls in theme.ts, which needs a browser: the settings it reads and applies, without it.
vi.mock('../backup', async () => {
  const goal = await import('../dailyGoal')
  return {
    currentSettings: () => ({ dailyGoal: goal.getDailyGoal(), reminder: { enabled: false, time: '19:00' } }),
    applySettings: async (settings: { dailyGoal?: number }) => {
      if (settings.dailyGoal) goal.setDailyGoal(settings.dailyGoal)
      return false
    },
  }
})
import { getDailyGoal, setDailyGoal } from '../dailyGoal'
import { getProgressionSnapshot, recordLessonAttempt, resetProgressionForTesting } from '../lessonProgress'
import { resetTestResultsForTesting } from '../testProgress'
import type { SyncRecord } from './kinds'
import { clearSyncState, loadSyncState } from './state'
import { applyStoreRecord, markStoresPushed, storeChanges } from './stores'

const LESSON = 'cloze:all:A1:1'
const lessonRecord = (bestScore: number, passed: boolean) => ({ bestScore, total: 10, passed, ...(passed ? { passedAt: 1 } : {}) })
const keys = (records: SyncRecord[]) => records.map((r) => `${r.kind} ${r.key}`)

beforeEach(() => {
  resetProgressionForTesting()
  resetTestResultsForTesting()
  clearSyncState()
  setDailyGoal(20)
})

describe('store changes', () => {
  it('sends what the server does not have yet, once', () => {
    recordLessonAttempt('cloze', 'all:A1', 1, 9, 10)
    const changes = storeChanges(loadSyncState(), 100)
    expect(keys(changes)).toEqual([`lesson ${LESSON}`, 'settings settings'])
    const pushed = markStoresPushed(loadSyncState(), changes)
    expect(storeChanges(pushed, 200)).toEqual([])
    expect(pushed.settingsAt).toBe(100)
  })

  it('never sends the reminder', () => {
    const settings = storeChanges(loadSyncState(), 1).find((r) => r.kind === 'settings')!
    expect(settings.data).not.toHaveProperty('reminder')
    expect(settings.data).toMatchObject({ dailyGoal: 20 })
  })
})

describe('store records from another device', () => {
  it('take a better lesson result', async () => {
    recordLessonAttempt('cloze', 'all:A1', 1, 5, 10)
    const state = await applyStoreRecord(loadSyncState(), { kind: 'lesson', key: LESSON, data: lessonRecord(9, true), deleted: false, changedAt: 5 })
    expect(getProgressionSnapshot()[LESSON]).toMatchObject({ bestScore: 9, passed: true })
    expect(keys(storeChanges(state, 6))).not.toContain(`lesson ${LESSON}`)
  })

  it('keep the better result here, which then goes out', async () => {
    recordLessonAttempt('cloze', 'all:A1', 1, 9, 10)
    const state = await applyStoreRecord(loadSyncState(), { kind: 'lesson', key: LESSON, data: lessonRecord(3, false), deleted: false, changedAt: 5 })
    expect(getProgressionSnapshot()[LESSON].bestScore).toBe(9)
    expect(keys(storeChanges(state, 6))).toContain(`lesson ${LESSON}`)
  })

  it('apply newer settings, not older ones', async () => {
    let state = { ...loadSyncState(), settingsAt: 50 }
    state = await applyStoreRecord(state, { kind: 'settings', key: 'settings', data: { dailyGoal: 30 }, deleted: false, changedAt: 40 })
    expect(getDailyGoal()).toBe(20)
    state = await applyStoreRecord(state, { kind: 'settings', key: 'settings', data: { dailyGoal: 50, reminder: { enabled: true, time: '07:00' } }, deleted: false, changedAt: 60 })
    expect(getDailyGoal()).toBe(50)
    expect(state.settingsAt).toBe(60)
  })
})

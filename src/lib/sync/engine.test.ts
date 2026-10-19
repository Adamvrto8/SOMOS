import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// backup.ts pulls in theme.ts, which needs a browser: settings as a plain daily goal.
vi.mock('../backup', async () => {
  const goal = await import('../dailyGoal')
  return {
    currentSettings: () => ({ dailyGoal: goal.getDailyGoal() }),
    applySettings: async (settings: { dailyGoal?: number }) => {
      if (settings.dailyGoal) goal.setDailyGoal(settings.dailyGoal)
      return false
    },
  }
})

import { db } from '../db'
import { getProgressionSnapshot, recordLessonAttempt } from '../lessonProgress'
import { adoptDevice, pendingChanges, syncOnce, wipeLearnerData } from './engine'
import { installSyncHooks, setRecording } from './outbox'
import { MemoryServer } from './server'

const settle = () => new Promise((resolve) => setTimeout(resolve, 30))
const star = (itemId: string, savedAt = 1) => ({ itemType: 'word' as const, itemId, savedAt })
const stars = async () => (await db.savedItems.toArray()).map((s) => s.itemId).sort()

/** A change made on another device of the account. */
const fromOtherDevice = (server: MemoryServer, kind: string, key: string, data: unknown, changedAt: number, deleted = false) =>
  server.push([{ kind: kind as 'saved', key, data, deleted, changedAt }])

installSyncHooks()
let server: MemoryServer

beforeEach(async () => {
  await wipeLearnerData()
  setRecording(true)
  server = new MemoryServer()
})

describe('a sync round', () => {
  it('sends a change, and a new device gets it back', async () => {
    await db.savedItems.put(star('casa'))
    await settle()
    await syncOnce(server)
    expect(server.get('saved', 'word:casa')?.data).toEqual(star('casa'))
    expect(await pendingChanges()).toBe(0)

    await wipeLearnerData() // a new phone
    setRecording(true)
    await syncOnce(server)
    expect(await stars()).toEqual(['casa'])
  })

  it('takes deletions from another device', async () => {
    await db.savedItems.put(star('casa'))
    await settle()
    await syncOnce(server)
    await fromOtherDevice(server, 'saved', 'word:casa', null, Date.now() + 1000, true)
    await syncOnce(server)
    expect(await stars()).toEqual([])
  })

  it('keeps a newer change made here and sends it instead', async () => {
    await fromOtherDevice(server, 'saved', 'word:casa', null, 1, true)
    await db.savedItems.put(star('casa', 5))
    await settle()
    await syncOnce(server)
    expect(await stars()).toEqual(['casa'])
    expect(server.get('saved', 'word:casa')?.deleted).toBe(false)
  })

  it('does not send back what it pulled', async () => {
    await fromOtherDevice(server, 'saved', 'word:perro', star('perro'), 10)
    await syncOnce(server)
    await settle()
    expect(await db.outbox.count()).toBe(0)
    const pushes = server.pushes
    await syncOnce(server)
    expect(server.pushes).toBe(pushes) // nothing to send
  })

  it('keeps one row per attempt, however often it is pulled', async () => {
    const attempt = { exercise: 'cloze', itemId: 's001#0', correct: true, at: 3 }
    await fromOtherDevice(server, 'attempt', '3|cloze|s001#0', attempt, 3)
    await syncOnce(server)
    await wipeLearnerData()
    setRecording(true)
    await syncOnce(server)
    await syncOnce(server)
    expect(await db.attempts.count()).toBe(1)
  })

  it('sends many changes in batches', async () => {
    await db.attempts.bulkAdd(Array.from({ length: 1200 }, (_, i) => ({ exercise: 'vocab', itemId: `w${i}:sk-es`, correct: true, at: i + 1 })))
    await settle()
    await syncOnce(server)
    expect(server.pushes).toBe(3)
    expect(await pendingChanges()).toBe(0)
  })

  it('keeps everything to send when the push fails', async () => {
    await db.savedItems.put(star('casa'))
    recordLessonAttempt('cloze', 'all:A1', 1, 9, 10)
    await settle()
    const before = await pendingChanges()
    server.failNext = true
    await expect(syncOnce(server)).rejects.toThrow('offline')
    expect(await pendingChanges()).toBe(before)
    await syncOnce(server)
    expect(await pendingChanges()).toBe(0)
  })

  it('keeps a row changed again while it was being sent', async () => {
    await db.savedItems.put(star('casa', 1))
    await settle()
    server.duringPush = async () => {
      server.duringPush = undefined
      await new Promise((resolve) => setTimeout(resolve, 5)) // a later change gets a later time
      await db.savedItems.put(star('casa', 2))
      await settle()
    }
    await syncOnce(server)
    expect(await db.outbox.count()).toBe(1)
    await syncOnce(server)
    expect((server.get('saved', 'word:casa')?.data as { savedAt: number }).savedAt).toBe(2)
  })

  it('merges lessons by the better result', async () => {
    recordLessonAttempt('cloze', 'all:A1', 1, 9, 10)
    await fromOtherDevice(server, 'lesson', 'cloze:all:A1:1', { bestScore: 4, total: 10, passed: false }, Date.now() + 1000)
    await syncOnce(server)
    expect(getProgressionSnapshot()['cloze:all:A1:1'].bestScore).toBe(9)
    expect(server.get('lesson', 'cloze:all:A1:1')?.data).toMatchObject({ bestScore: 9 })
  })
})

describe('the first sign-in', () => {
  it('merges the device with the account, the account winning on the same row', async () => {
    setRecording(false) // progress made without an account
    await db.savedItems.bulkPut([star('casa', 1), star('gato', 1)])
    await fromOtherDevice(server, 'saved', 'word:casa', star('casa', 9), 9)
    await fromOtherDevice(server, 'saved', 'word:perro', star('perro', 9), 9)

    setRecording(true)
    await adoptDevice()
    await syncOnce(server)
    expect(await stars()).toEqual(['casa', 'gato', 'perro'])
    expect((await db.savedItems.get(['word', 'casa']))?.savedAt).toBe(9)
    expect(server.get('saved', 'word:gato')).toBeDefined()
    expect(await pendingChanges()).toBe(0)
  })
})

describe('signing out', () => {
  it('knows what was not sent yet, and wipes the learner data', async () => {
    await db.savedItems.put(star('casa'))
    await settle()
    expect(await pendingChanges()).toBeGreaterThan(0)
    await wipeLearnerData()
    expect(await stars()).toEqual([])
    expect(getProgressionSnapshot()).toEqual({})
    expect(await db.outbox.count()).toBe(0)
  })
})

describe('two devices with equally good results', () => {
  it('settle on one instead of overwriting each other forever', async () => {
    const there = { bestScore: 10, total: 10, passed: true, passedAt: 2 }
    await fromOtherDevice(server, 'lesson', 'cloze:all:A1:1', there, 1)
    recordLessonAttempt('cloze', 'all:A1', 1, 10, 10) // passed here too, at another time
    await syncOnce(server)
    expect(getProgressionSnapshot()['cloze:all:A1:1']).toEqual(there)
    const pushes = server.pushes
    await syncOnce(server)
    expect(server.pushes).toBe(pushes)
  })
})

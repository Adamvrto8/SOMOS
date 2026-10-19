import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { attemptKey, readRow, writeRow } from './kinds'
import { installSyncHooks, runRemote, setRecording } from './outbox'

/** The outbox is written once the change's transaction completes. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 30))
const outbox = async () => (await db.outbox.toArray()).map(({ kind, key }) => `${kind} ${key}`).sort()

installSyncHooks()

beforeEach(async () => {
  setRecording(false)
  await Promise.all([db.customWords.clear(), db.savedItems.clear(), db.attempts.clear(), db.mistakes.clear(), db.reviewCards.clear(), db.outbox.clear()])
  setRecording(true)
})

describe('the outbox', () => {
  it('notes every kind of change with its key', async () => {
    await db.customWords.put({ id: 'c1', es: 'la tlayuda', sk: 'tlayuda', createdAt: 1 })
    await db.savedItems.put({ itemType: 'word', itemId: 'casa', savedAt: 1 })
    await db.attempts.add({ exercise: 'conjugation', itemId: 'tener:preterito:yo', correct: true, at: 5 })
    await db.mistakes.put({ exercise: 'vocab', itemId: 'casa:sk-es', firstWrongAt: 1, lastWrongAt: 1, wrongCount: 1 })
    await settle()
    expect(await outbox()).toEqual([
      'attempt 5|conjugation|tener:preterito:yo',
      'customWord c1',
      'mistake vocab:casa:sk-es',
      'saved word:casa',
    ])
  })

  it('notes updates and deletions, also of a whole table', async () => {
    setRecording(false)
    await db.savedItems.put({ itemType: 'word', itemId: 'casa', savedAt: 1 })
    await db.mistakes.put({ exercise: 'cloze', itemId: 's001#0', firstWrongAt: 1, lastWrongAt: 1, wrongCount: 1 })
    setRecording(true)
    await db.savedItems.delete(['word', 'casa'])
    await db.mistakes.clear()
    await settle()
    expect(await outbox()).toEqual(['mistake cloze:s001#0', 'saved word:casa'])
  })

  it('notes nothing without an account', async () => {
    setRecording(false)
    await db.savedItems.put({ itemType: 'word', itemId: 'casa', savedAt: 1 })
    await settle()
    expect(await outbox()).toEqual([])
  })

  it('leaves changes from the server alone, so they do not echo back', async () => {
    await runRemote(() => writeRow('saved', 'word:casa', { itemType: 'word', itemId: 'casa', savedAt: 1 }))
    await settle()
    expect(await outbox()).toEqual([])
    expect(await readRow('saved', 'word:casa')).toEqual({ itemType: 'word', itemId: 'casa', savedAt: 1 })
  })

  it('keeps one row per attempt, however often it arrives', async () => {
    const attempt = { exercise: 'cloze', itemId: 's001#0', correct: false, at: 7 }
    await runRemote(() => writeRow('attempt', attemptKey(attempt), attempt))
    await runRemote(() => writeRow('attempt', attemptKey(attempt), attempt))
    expect(await db.attempts.count()).toBe(1)
    expect(await readRow('attempt', attemptKey(attempt))).toEqual(attempt)
  })
})

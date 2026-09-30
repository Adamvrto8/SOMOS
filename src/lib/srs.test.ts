import { describe, expect, it } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import type { ReviewCard, ReviewItemType } from './db'
import { dueCounts, knownCards, reviewCardChanges, selectDue } from './srs'

const now = new Date(2026, 8, 30, 10)
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const card = (itemType: ReviewItemType, itemId: string, dueDaysAgo: number, practised = false): ReviewCard => ({
  itemType,
  itemId,
  fsrs: createEmptyCard(daysAgo(dueDaysAgo)), // an empty card is due when created
  ...(practised ? { practised: true as const } : {}),
})
const on = { enabled: true, limit: 10 as const }
const none = new Set<string>()
const ids = (cards: ReviewCard[]) => cards.map((c) => `${c.itemType}:${c.itemId}`)

describe('selectDue', () => {
  const practised = Array.from({ length: 15 }, (_, i) => card('word', `w${i}`, i + 1, true)) // w14 most overdue
  const starredPractised = card('word', 'star', 0, true)
  const cards = [card('sentence', 's001', 0), card('custom', 'c1', 0), card('word', 'saved', 0), starredPractised, ...practised, card('word', 'later', -3, true)]
  const saved = new Set(['saved', 'star'])

  it('keeps ⭐, sentences and own words and caps practised-only words, most overdue first', () => {
    const due = selectDue(cards, saved, on, none, now)
    expect(due).toHaveLength(4 + 10)
    const auto = ids(due).filter((id) => id.startsWith('word:w'))
    expect(auto).toHaveLength(10)
    expect(auto).toContain('word:w14')
    expect(auto).not.toContain('word:w0')
    expect(ids(due)).toEqual(expect.arrayContaining(['sentence:s001', 'custom:c1', 'word:saved', 'word:star']))
  })

  it('returns the cards sorted by due date', () => {
    const due = selectDue(cards, saved, on, none, now)
    const times = due.map((c) => new Date(c.fsrs.due).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('lowers the cap by practised-only words already reviewed today', () => {
    const due = selectDue(cards, saved, on, new Set(['w1', 'w2', 'w3', 'star']), now)
    expect(ids(due).filter((id) => id.startsWith('word:w'))).toHaveLength(7) // 'star' is ⭐: not counted
  })

  it('leaves practised-only words out when switched off', () => {
    expect(ids(selectDue(cards, saved, { enabled: false, limit: 10 }, none, now))).toEqual(
      expect.not.arrayContaining(['word:w14']),
    )
    expect(selectDue(cards, saved, { enabled: false, limit: 10 }, none, now)).toHaveLength(4)
  })

  it('counts today and tomorrow with the same rules', () => {
    expect(dueCounts(cards, saved, on, none, now)).toEqual({ today: 14, tomorrow: 14 })
    expect(dueCounts(cards, saved, { enabled: true, limit: 50 }, none, now)).toEqual({ today: 19, tomorrow: 19 })
  })
})

describe('reviewCardChanges', () => {
  it('keeps practised cards that are no longer saved', () => {
    const existing = [card('word', 'unsaved', 1), card('word', 'practised', 1, true)]
    const { stale, missing } = reviewCardChanges(new Map([['word:new', ['word', 'new']]]), existing, now)
    expect(stale).toEqual([['word', 'unsaved']])
    expect(missing.map((c) => c.itemId)).toEqual(['new'])
  })
})

describe('knownCards', () => {
  it('drops cards whose word or sentence is no longer in the dataset', () => {
    const cards = [card('word', 'perro', 1, true), card('word', 'no-such-word', 5, true), card('sentence', 's001', 1), card('sentence', 's9999', 1), card('custom', 'c1', 1)]
    expect(ids(knownCards(cards))).toEqual(['word:perro', 'sentence:s001', 'custom:c1'])
  })
})

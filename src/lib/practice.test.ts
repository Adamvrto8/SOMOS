import { describe, expect, it } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import { addDays, startOfDay } from './dates'
import type { ReviewCard } from './db'
import { applyPractice, planPracticeSync, practisedWordId, practiceUpdate, replayPractice } from './practice'
import { isDueToday } from './srs'

const at = (d: number, h = 10) => new Date(2026, 8, d, h) // September 2026

describe('practisedWordId', () => {
  it.each([
    ['vocab', 'perro:sk-es', 'perro'],
    ['vocab', 'perro:es-sk', 'perro'],
    ['conjugation', 'tener:preterito:yo', 'tener'],
    ['conjugation', 'extrañar:presente:yo', 'extranar'], // the verb's Word has the slug id
    ['vocab', 'no-such-word:sk-es', undefined],
    ['cloze', 's001#0', undefined],
    ['review', 'word:perro', undefined],
  ])('%s %s → %s', (exercise, itemId, wordId) => {
    expect(practisedWordId(exercise, itemId)).toBe(wordId)
  })
})

describe('applyPractice', () => {
  it('brings a word answered right back in a few days', () => {
    const card = applyPractice(undefined, true, at(10))!
    expect(isDueToday(card, at(10))).toBe(false)
    expect(card.due.getTime()).toBeGreaterThanOrEqual(startOfDay(addDays(at(10), 2)).getTime())
  })

  it('brings a word answered wrong back tomorrow', () => {
    const card = applyPractice(undefined, false, at(10))!
    expect(isDueToday(card, at(10))).toBe(false)
    expect(isDueToday(card, at(11))).toBe(true)
  })

  it('counts only the first answer of a local day', () => {
    const first = applyPractice(undefined, true, at(10, 9))!
    expect(applyPractice(first, false, at(10, 21))).toBeUndefined()
  })

  it('counts an answer on a later day', () => {
    const first = applyPractice(undefined, false, at(10))!
    const next = applyPractice(first, true, at(11))!
    expect(next.reps).toBe(2)
    expect(next.due.getTime()).toBeGreaterThan(first.due.getTime())
  })
})

describe('replayPractice', () => {
  const answers = [
    { exercise: 'vocab', itemId: 'perro:sk-es', correct: true, at: at(10, 9).getTime() },
    { exercise: 'vocab', itemId: 'perro:es-sk', correct: false, at: at(10, 9).getTime() + 60_000 },
    { exercise: 'conjugation', itemId: 'tener:presente:yo', correct: false, at: at(12).getTime() },
    { exercise: 'vocab', itemId: 'perro:sk-es', correct: true, at: at(14).getTime() },
    { exercise: 'cloze', itemId: 's001#0', correct: true, at: at(14).getTime() },
  ]

  it('replays one answer per word per day, oldest first, whatever the input order', () => {
    const cards = replayPractice([...answers].reverse())
    expect([...cards.keys()].sort()).toEqual(['perro', 'tener'])
    expect(cards.get('perro')!.reps).toBe(2) // 10th (first answer only) + 14th
    expect(cards.get('tener')!.reps).toBe(1)
    expect(replayPractice(answers).get('perro')!.due.getTime()).toBe(cards.get('perro')!.due.getTime())
  })
})

describe('practiceUpdate', () => {
  it('creates a practised card for a new word', () => {
    const card = practiceUpdate(undefined, 'perro', true, at(10))!
    expect(card).toMatchObject({ itemType: 'word', itemId: 'perro', practised: true })
  })

  it('only flags a ⭐ card already reviewed today', () => {
    const reviewed = applyPractice(undefined, true, at(10, 8))!
    const starred: ReviewCard = { itemType: 'word', itemId: 'perro', fsrs: reviewed }
    const updated = practiceUpdate(starred, 'perro', false, at(10, 20))!
    expect(updated.practised).toBe(true)
    expect(updated.fsrs).toBe(reviewed)
    expect(practiceUpdate(updated, 'perro', false, at(10, 21))).toBeUndefined()
  })
})

describe('planPracticeSync', () => {
  const answers = [
    { exercise: 'vocab', itemId: 'perro:sk-es', correct: true, at: at(10).getTime() },
    { exercise: 'vocab', itemId: 'gato:sk-es', correct: true, at: at(10).getTime() },
    { exercise: 'vocab', itemId: 'casa:sk-es', correct: true, at: at(10).getTime() },
  ]

  it('creates missing cards, flags ⭐ cards, leaves practised cards alone', () => {
    const starred: ReviewCard = { itemType: 'word', itemId: 'gato', fsrs: createEmptyCard(at(1)) }
    const practised: ReviewCard = { itemType: 'word', itemId: 'casa', fsrs: createEmptyCard(at(1)), practised: true }
    const puts = planPracticeSync(answers, [starred, practised])
    expect(puts.map((c) => c.itemId).sort()).toEqual(['gato', 'perro'])
    expect(puts.find((c) => c.itemId === 'gato')).toEqual({ ...starred, practised: true })
    expect(puts.find((c) => c.itemId === 'perro')).toMatchObject({ itemType: 'word', practised: true })
  })

  it('changes nothing when run again', () => {
    const first = planPracticeSync(answers, [])
    expect(planPracticeSync(answers, first)).toEqual([])
  })
})

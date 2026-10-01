import { createEmptyCard } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { slovakFirst } from './reviewQueue'

const card = (reps: number) => ({ ...createEmptyCard(new Date(2026, 9, 1)), reps })

describe('slovakFirst', () => {
  it.each(['word', 'custom'] as const)('alternates the side of a %s card with every review', (itemType) => {
    expect([0, 1, 2, 3].map((reps) => slovakFirst(itemType, card(reps)))).toEqual([false, true, false, true])
  })

  it('always shows a sentence in Spanish first', () => {
    expect([0, 1, 2, 3].map((reps) => slovakFirst('sentence', card(reps)))).toEqual([false, false, false, false])
  })
})

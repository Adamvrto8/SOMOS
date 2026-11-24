import { createEmptyCard, Rating } from 'ts-fsrs'
import { describe, expect, it } from 'vitest'
import { customSlovakAnswers, sentenceAnswers, slovakFirst, spanishAnswers, typedRating } from './reviewQueue'

const card = (reps: number) => ({ ...createEmptyCard(new Date(2026, 9, 1)), reps })

describe('slovakFirst', () => {
  it('alternates the side of a card with every review', () => {
    expect([0, 1, 2, 3].map((reps) => slovakFirst(card(reps)))).toEqual([false, true, false, true])
  })
})

describe('sentenceAnswers', () => {
  it('types a sentence in Spanish, but only reveals its Slovak side', () => {
    expect(sentenceAnswers('Tengo hambre.', true)).toEqual(['Tengo hambre.'])
    expect(sentenceAnswers('Tengo hambre.', false)).toEqual([])
  })
})

describe('typed review', () => {
  it('accepts the Spanish word with or without its article', () => {
    expect(spanishAnswers('casa', 'la')).toEqual(['casa', 'la casa'])
    expect(spanishAnswers('a')).toEqual(['a'])
  })

  it('accepts any one of the meanings of a custom word', () => {
    expect(customSlovakAnswers('pes, psík')).toEqual(['pes, psík', 'pes', 'psík'])
    expect(customSlovakAnswers('pes')).toEqual(['pes'])
  })

  it('rates a typed answer: right at once Good, fixed after a hint Hard, given up Again', () => {
    expect(typedRating(1, false)).toBe(Rating.Good)
    expect(typedRating(3, false)).toBe(Rating.Hard)
    expect(typedRating(2, true)).toBe(Rating.Again)
    expect(typedRating(0, true)).toBe(Rating.Again)
  })
})
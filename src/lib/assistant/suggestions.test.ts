import { describe, expect, it } from 'vitest'
import { suggestionsFor } from './suggestions'

describe('suggestionsFor', () => {
  it('asks about the word on its page, conjugation for a verb', () => {
    expect(suggestionsFor('/word/casa')).toEqual([
      { kind: 'useWord', name: 'casa' },
      { kind: 'whenWord', name: 'casa' },
    ])
    expect(suggestionsFor('/word/tener')[1]).toEqual({ kind: 'conjugate', name: 'tener' })
  })

  it('asks about the tip on its page', () => {
    expect(suggestionsFor('/practice/grammar/por-para')).toEqual([
      { kind: 'tipSimpler', name: 'por alebo para' },
      { kind: 'tipExamples', name: 'por alebo para' },
    ])
  })

  it('falls back to the general questions, also for a word that does not exist', () => {
    expect(suggestionsFor('/word/flarpo').map((s) => s.kind)).toEqual(['today', 'progress', 'serEstar'])
    expect(suggestionsFor().map((s) => s.kind)).toEqual(['today', 'progress', 'serEstar'])
    expect(suggestionsFor('/archive').map((s) => s.kind)).toEqual(['mistakes', 'today'])
  })
})

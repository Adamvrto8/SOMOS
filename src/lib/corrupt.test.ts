import { describe, expect, it } from 'vitest'
import { sentenceById, sentences } from '../data'
import type { Sentence } from '../data/types'
import { corrupt, distractorFor, eligibleClozes, rebuild, swappableDistractors } from './corrupt'

const make = (over: Partial<Sentence> & Pick<Sentence, 'tokens' | 'cloze'>): Sentence => ({
  id: 'sx',
  es: rebuild(over.tokens),
  sk: 'x',
  level: 'A1',
  topics: ['basics'],
  ...over,
})

describe('rebuild', () => {
  it('gives back the sentence text for every sentence of the data', () => {
    const bad = sentences.filter((s) => rebuild(s.tokens) !== s.es).map((s) => s.id)
    expect(bad).toEqual([])
  })
})

describe('corrupt', () => {
  it('swaps the answer for a distractor and rebuilds the text', () => {
    const sentence = sentenceById.get('s372')! // Quiero un café sin azúcar. (sin: con, para, por)
    const result = corrupt(sentence, 0, 0)!
    expect(result.es).toBe('Quiero un café con azúcar.')
    expect(result.index).toBe(3)
    expect(result.wrong).toBe('con')
    expect(result.right).toBe('sin')
    expect(result.tokens[3]).toBe('con')
  })

  it('keeps a capital in the first slot', () => {
    const sentence = make({
      tokens: ['El', 'perro', 'ladra', '.'],
      cloze: [{ tokenIndex: 0, answer: 'El', lemma: 'el', hint: 'člen', distractors: ['la', 'Los', 'Las'] }],
    })
    expect(corrupt(sentence, 0, 0)!.es).toBe('La perro ladra.')
  })

  it('keeps the spacing around ¿ ¡ and punctuation', () => {
    const sentence = make({
      tokens: ['¿', 'Dónde', 'está', 'la', 'casa', '?'],
      cloze: [{ tokenIndex: 1, answer: 'Dónde', lemma: 'dónde', hint: 'kde', distractors: ['Cuándo', 'Cómo', 'Qué'] }],
    })
    expect(corrupt(sentence, 0, 0)!.es).toBe('¿Cuándo está la casa?')
  })

  it('refuses a missing blank, a missing distractor and a distractor of several words', () => {
    const sentence = make({
      tokens: ['Voy', 'a', 'casa', '.'],
      cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'predložka', distractors: ['en', 'a la', 'de'] }],
    })
    expect(corrupt(sentence, 3, 0)).toBeUndefined()
    expect(corrupt(sentence, 0, 7)).toBeUndefined()
    expect(corrupt(sentence, 0, 1)).toBeUndefined() // "a la" is two words
    expect(corrupt(sentence, 0, 0)).toBeDefined()
  })
})

describe('stale and empty input', () => {
  const cloze = { tokenIndex: 1, answer: 'perro', lemma: 'perro', hint: 'x', distractors: ['gato', 'lobo', 'oso'] }
  it('refuses a blank whose token is out of range or no longer the answer', () => {
    expect(corrupt(make({ tokens: ['El', 'perro', 'ladra', '.'], cloze: [{ ...cloze, tokenIndex: 9 }] }), 0, 0)).toBeUndefined()
    expect(corrupt(make({ tokens: ['El', 'gato', 'ladra', '.'], cloze: [cloze] }), 0, 0)).toBeUndefined()
    expect(corrupt(make({ tokens: ['El', 'perro', 'ladra', '.'], cloze: [cloze] }), 0, 0)).toBeDefined()
  })

  it('ignores empty and whitespace-only distractors', () => {
    expect(swappableDistractors({ ...cloze, distractors: ['', '  ', 'gato', 'lobo'] })).toEqual([2, 3])
  })
})

describe('eligibility', () => {
  const base = { tokens: ['Voy', 'a', 'casa', '.'] }
  it('needs two one-word distractors that differ from the answer', () => {
    const ok = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en', 'de'] }] })
    const few = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en'] }] })
    const spaced = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en', 'a la'] }] })
    const same = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['A', 'en'] }] })
    expect(eligibleClozes(ok)).toEqual([0])
    expect(eligibleClozes(few)).toEqual([])
    expect(eligibleClozes(spaced)).toEqual([])
    expect(eligibleClozes(same)).toEqual([])
  })

  it('leaves a sentence with a digit out', () => {
    const digit = make({
      tokens: ['Tengo', '3', 'gatos', '.'],
      cloze: [{ tokenIndex: 0, answer: 'Tengo', lemma: 'tener', hint: 'tener · yo · presente', distractors: ['Tienes', 'Tiene'] }],
    })
    expect(eligibleClozes(digit)).toEqual([])
  })

  it('picks the distractor by r', () => {
    const sentence = make({
      tokens: ['Voy', 'a', 'casa', '.'],
      cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en', 'a la', 'de', 'con'] }],
    })
    expect(swappableDistractors(sentence.cloze![0])).toEqual([0, 2, 3])
    expect(distractorFor(sentence, 0, 0)).toBe(0)
    expect(distractorFor(sentence, 0, 0.5)).toBe(2)
    expect(distractorFor(sentence, 0, 0.99)).toBe(3)
    expect(distractorFor(sentence, 5, 0.5)).toBeUndefined()
  })
})

describe('the data', () => {
  it('corrupts every eligible blank with every swappable distractor into a different sentence', () => {
    let checked = 0
    for (const sentence of sentences) {
      for (const index of eligibleClozes(sentence)) {
        for (const d of swappableDistractors(sentence.cloze![index])) {
          const result = corrupt(sentence, index, d)
          expect(result, `${sentence.id}#${index}:${d}`).toBeDefined()
          expect(result!.es).not.toBe(sentence.es)
          expect(rebuild(result!.tokens)).toBe(result!.es)
          expect(result!.tokens).toHaveLength(sentence.tokens.length)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(3000)
  })
})

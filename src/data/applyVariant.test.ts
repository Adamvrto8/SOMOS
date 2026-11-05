import { describe, expect, it } from 'vitest'
import { applySentences, applyWords } from './applyVariant'
import type { Sentence, Word } from './types'

const word = (over: Partial<Word> = {}): Word => ({ id: 'carro', es: 'carro', sk: ['auto'], pos: 'noun', gender: 'm', level: 'A1', topics: ['travel'], examples: [{ es: 'Mi carro.', sk: 'Moje auto.' }], note: 'Mexické slovo', ...over })
const sentence = (): Sentence => ({
  id: 's1', es: 'Tomo el camión.', sk: 'Idem autobusom.', level: 'A1', topics: ['travel'], tokens: ['Tomo', 'el', 'camión', '.'],
  cloze: [{ tokenIndex: 2, answer: 'camión', lemma: 'camión', hint: 'doprava', distractors: ['carro'] }],
})

describe('applyWords', () => {
  it('overlays only the listed fields, keeps the id and the rest', () => {
    const [w] = applyWords([word()], [{ id: 'carro', es: 'coche', examples: [{ es: 'Mi coche.', sk: 'Moje auto.' }], note: null }])
    expect(w).toMatchObject({ id: 'carro', es: 'coche', sk: ['auto'], gender: 'm' })
    expect(w.examples[0].es).toBe('Mi coche.')
    expect(w.note).toBeUndefined()
  })
  it('leaves words without an overlay entry as they are', () => {
    const base = [word({ id: 'casa', es: 'casa' })]
    expect(applyWords(base, [{ id: 'carro', es: 'coche' }])[0]).toBe(base[0])
  })
})

describe('applySentences', () => {
  it('replaces es and tokens, patches the cloze by tokenIndex and keeps its hint', () => {
    const [s] = applySentences([sentence()], [{ id: 's1', es: 'Tomo el autobús.', tokens: ['Tomo', 'el', 'autobús', '.'], cloze: [{ tokenIndex: 2, answer: 'autobús', distractors: ['coche'] }] }])
    expect(s.es).toBe('Tomo el autobús.')
    expect(s.sk).toBe('Idem autobusom.')
    expect(s.cloze?.[0]).toMatchObject({ tokenIndex: 2, answer: 'autobús', hint: 'doprava', distractors: ['coche'] })
  })
})

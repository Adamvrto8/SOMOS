import { describe, expect, it } from 'vitest'
import { applySentences, applyTips, applyTipsEn, applyWords, otherVariantForms } from './applyVariant'
import type { Sentence, Tip, TipEn, Word } from './types'

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

describe('applyTips', () => {
  const tip = (): Tip => ({
    id: 'hay-estar', title: 'hay', level: 'A1', area: 'verbs', intro: 'Úvod.', sources: [], ideas: ['x'], variants: { mx: 'V Mexiku.', es: 'V Španielsku.' },
    rules: [
      { id: 'hay', title: 'Hay', text: 'hay un Oxxo', examples: [{ es: 'Hay un Oxxo.', sk: 'Je tam Oxxo.' }, { es: 'No hay leche.', sk: 'Nie je mlieko.' }] },
      { id: 'estar', title: 'Estar', examples: [{ es: 'Está aquí.', sk: 'Je tu.' }] },
    ],
  })
  it('patches rule texts and single examples by id, keeps the rest', () => {
    const [t] = applyTips([tip()], [{ id: 'hay-estar', rules: [{ id: 'hay', text: 'hay un súper', examples: [{ es: 'Hay un súper.', sk: 'Je tam obchod.' }, null] }] }])
    expect(t.intro).toBe('Úvod.')
    expect(t.rules[0].text).toBe('hay un súper')
    expect(t.rules[0].examples.map((e) => e.es)).toEqual(['Hay un súper.', 'No hay leche.'])
    expect(t.rules[1]).toEqual(tip().rules[1])
  })
  it('patches the English tip from the same entry', () => {
    const en: TipEn = { id: 'hay-estar', title: 'hay', intro: 'Intro.', variants: { mx: 'M', es: 'S' }, rules: [{ id: 'hay', title: 'Hay', text: 'hay un Oxxo', examples: ['There is an Oxxo.', 'No milk.'] }] }
    const [t] = applyTipsEn([en], [{ id: 'hay-estar', en: { intro: 'New intro.', rules: [{ id: 'hay', examples: ['There is a shop.', null] }] } }])
    expect(t.intro).toBe('New intro.')
    expect(t.rules[0]).toMatchObject({ text: 'hay un Oxxo', examples: ['There is a shop.', 'No milk.'] })
  })
})

describe('otherVariantForms', () => {
  const base = [word(), word({ id: 'manejar', es: 'manejar', pos: 'verb', verbId: 'manejar' }), word({ id: 'casa', es: 'casa' })]
  const overlay = [{ id: 'carro', es: 'coche' }, { id: 'manejar', hidden: true }]
  const spainOnly = [word({ id: 'conducir', es: 'conducir', pos: 'verb', verbId: 'conducir' })]
  it('lets Spain find a word by its Mexican name, and Mexico by the Spanish one', () => {
    expect(otherVariantForms('es', base, overlay, spainOnly)).toEqual(new Map([['carro', ['carro']], ['conducir', ['manejar']]]))
    expect(otherVariantForms('mx', base, overlay, spainOnly)).toEqual(new Map([['carro', ['coche']], ['manejar', ['conducir']]]))
  })
})

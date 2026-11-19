import { describe, expect, it } from 'vitest'
import { cardAsText, turnAsNote } from './note'

describe('cardAsText', () => {
  it('writes a word, a conjugation and a tip from the app data', () => {
    expect(cardAsText({ type: 'word', id: 'carro' })).toBe('el carro – auto')
    expect(cardAsText({ type: 'conj', verbId: 'tener', tense: 'preterito' })).toBe('tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron')
    expect(cardAsText({ type: 'tip', id: 'ser-estar' })).toMatch(/^Tip: ser a estar/)
  })
})

describe('turnAsNote', () => {
  it('keeps the question, the text without marks, links as words, examples and cards; drops follow-ups', () => {
    const answer = [
      '**Ser** hovorí, čo niečo je, *estar* kde to je. Viac v [gramatike](/practice/grammar).',
      '- Ella es mi hermana. – Ona je moja sestra.',
      '{{word:carro}}',
      '{{word:flarpo}}',
      'Detail slova (/word/<id>) má príklady.',
      '{{dalej:Daj mi ďalší príklad}}',
    ].join('\n')
    expect(turnAsNote({ question: 'Aký je rozdiel medzi ser a estar?', answer })).toBe(
      [
        'Aký je rozdiel medzi ser a estar?',
        'Ser hovorí, čo niečo je, estar kde to je. Viac v gramatike.',
        '- Ella es mi hermana. – Ona je moja sestra.',
        'el carro – auto',
        'Detail slova má príklady.',
      ].join('\n'),
    )
  })

  it('keeps every line of a task question', () => {
    const question = 'Prečo je moja odpoveď zlá?\nCvičenie: Časovanie\nÚloha: tener · yo · pretérito\nMoja odpoveď: tenía\nSprávne: tuve'
    expect(turnAsNote({ question, answer: 'Treba **tuve**.' })).toBe(`${question}\nTreba tuve.`)
  })
})

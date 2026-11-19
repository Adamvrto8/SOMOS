import { describe, expect, it } from 'vitest'
import { cardAsText, tipsInText, turnAsNote } from './note'

const labels = { question: 'Otázka', answer: 'SOMO' }

describe('cardAsText', () => {
  it('writes a word, a conjugation and a tip from the app data', () => {
    expect(cardAsText({ type: 'word', id: 'carro' })).toBe('el carro – auto')
    expect(cardAsText({ type: 'conj', verbId: 'tener', tense: 'preterito' })).toBe('tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron')
    expect(cardAsText({ type: 'tip', id: 'ser-estar' })).toMatch(/^Tip: ser a estar/)
  })
})

describe('turnAsNote', () => {
  it('marks the question and the answer, parts blocks by a blank line, drops marks and follow-ups', () => {
    const answer = [
      '**Ser** hovorí, čo niečo je, *estar* kde to je. Viac v [gramatike](/practice/grammar).',
      '- Ella es mi hermana. – Ona je moja sestra.',
      '- Ella está en casa. – Ona je doma.',
      '{{word:carro}}',
      '{{word:flarpo}}',
      '{{tip:ser-estar}}',
      'Detail slova (/word/<id>) má príklady.',
      '{{dalej:Daj mi ďalší príklad}}',
    ].join('\n')
    const note = turnAsNote({ question: 'Aký je rozdiel medzi ser a estar?', answer }, labels)
    expect(note.split('\n\n')).toEqual([
      'Otázka: Aký je rozdiel medzi ser a estar?',
      'SOMO: Ser hovorí, čo niečo je, estar kde to je. Viac v gramatike.',
      '- Ella es mi hermana. – Ona je moja sestra.\n- Ella está en casa. – Ona je doma.',
      expect.stringMatching(/^el carro – auto\nTip: ser a estar/),
      'Detail slova má príklady.',
    ])
  })

  it('keeps every line of a task question', () => {
    const question = 'Prečo je moja odpoveď zlá?\nCvičenie: Časovanie\nÚloha: tener · yo · pretérito\nMoja odpoveď: tenía\nSprávne: tuve'
    expect(turnAsNote({ question, answer: 'Treba **tuve**.' }, labels)).toBe(`Otázka: ${question}\n\nSOMO: Treba tuve.`)
  })

  it('an answer with nothing left keeps just the question', () => {
    expect(turnAsNote({ question: 'Ahoj', answer: '{{dalej:Ďalej}}' }, labels)).toBe('Otázka: Ahoj')
  })
})

describe('tipsInText', () => {
  it('finds the tips written as "Tip: <title>" lines, once each, and nothing else', () => {
    const note = turnAsNote({ question: 'ser?', answer: '{{tip:ser-estar}}' }, labels)
    const text = `moja poznámka\nTip: niečo, čo nie je tip\n\n${note}\n\n${note}`
    expect(tipsInText(text)).toEqual(['ser-estar'])
    expect(tipsInText('Tip: ser a estar je ťažké')).toEqual([])
  })
})

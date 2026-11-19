import { describe, expect, it } from 'vitest'
import { cardAsText, turnAsNote } from './note'

describe('cardAsText', () => {
  it('writes a word and a conjugation from the app data, and leaves a tip out', () => {
    expect(cardAsText({ type: 'word', id: 'carro' })).toBe('el carro – auto')
    expect(cardAsText({ type: 'conj', verbId: 'tener', tense: 'preterito' })).toBe('tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron')
    expect(cardAsText({ type: 'tip', id: 'ser-estar' })).toBe('')
  })
})

describe('turnAsNote', () => {
  it('the question is the title; the answer without marks, tips, sentences with links and follow-ups', () => {
    const answer = [
      '**Ser** hovorí, čo niečo je, *estar* kde to je. Viac v [gramatike](/practice/grammar).',
      '- Ella es mi hermana. – Ona je moja sestra.',
      '- Ella está en casa. – Ona je doma.',
      '{{word:carro}}',
      '{{word:flarpo}}',
      '{{tip:ser-estar}}',
      '{{conj:ser:presente}}',
      'Detail slova (/word/<id>) má príklady.',
      'Na precvičenie si otvor [gramatiku](/practice/grammar) a skús tvary oboch slovies.',
      '{{dalej:Daj mi ďalší príklad}}',
    ].join('\n')
    const note = turnAsNote({ question: 'Aký je rozdiel medzi ser a estar?', answer })
    expect(note.title).toBe('Aký je rozdiel medzi ser a estar?')
    expect(note.text.split('\n\n')).toEqual([
      'Ser hovorí, čo niečo je, estar kde to je.',
      '- Ella es mi hermana. – Ona je moja sestra.\n- Ella está en casa. – Ona je doma.',
      expect.stringMatching(/^el carro – auto\nser · presente: soy,/),
      'Detail slova má príklady.',
    ])
    expect(note.text).not.toContain('Tip')
    expect(note.text).not.toContain('\u0000')
  })

  it('the other lines of a task question open the text', () => {
    const question = 'Prečo je moja odpoveď zlá?\nCvičenie: Časovanie\nÚloha: tener · yo · pretérito'
    expect(turnAsNote({ question, answer: 'Treba **tuve**.' })).toEqual({
      title: 'Prečo je moja odpoveď zlá?',
      text: 'Cvičenie: Časovanie\nÚloha: tener · yo · pretérito\n\nTreba tuve.',
    })
  })

  it('an answer with nothing left keeps just the title', () => {
    expect(turnAsNote({ question: 'Ahoj', answer: '{{dalej:Ďalej}}' })).toEqual({ title: 'Ahoj', text: '' })
  })
})

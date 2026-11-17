import { describe, expect, it } from 'vitest'
import { answerParts } from './answerText'

describe('answerParts', () => {
  it('removes bold markers', () => {
    expect(answerParts('To je **casa** a __carro__.')).toEqual([{ type: 'text', text: 'To je casa a carro.' }])
  })

  it('turns a link woven into the sentence into a labelled in-app link', () => {
    expect(answerParts('Otvor [opakovanie kartičiek](/review) a potom [Domov](/).')).toEqual([
      { type: 'text', text: 'Otvor ' },
      { type: 'link', label: 'opakovanie kartičiek', to: '/review' },
      { type: 'text', text: ' a potom ' },
      { type: 'link', label: 'Domov', to: '/' },
      { type: 'text', text: '.' },
    ])
  })

  it('keeps the query of an exercise link', () => {
    expect(answerParts('Skús [časovanie](/practice?type=conjugation).')[1]).toEqual({
      type: 'link',
      label: 'časovanie',
      to: '/practice?type=conjugation',
    })
  })

  it('still links a bare app path, without the full stop after it', () => {
    expect(answerParts('Pozri /word/casa. Alebo /practice/lesson?mistakes=1')).toEqual([
      { type: 'text', text: 'Pozri ' },
      { type: 'link', label: '/word/casa', to: '/word/casa' },
      { type: 'text', text: '. Alebo ' },
      { type: 'link', label: '/practice/lesson?mistakes=1', to: '/practice/lesson?mistakes=1' },
    ])
  })

  it('never links outside the app or inside words', () => {
    const text = 'Pozri [stránku](//evil.example), [web](https://x.sk), a/word/casa a my_var_name.'
    expect(answerParts(text)).toEqual([{ type: 'text', text }])
  })
})

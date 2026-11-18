import { describe, expect, it } from 'vitest'
import { answerBlocks, answerParts, appPathExists, cardOf } from './answerText'

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

describe('links to pages that do not exist', () => {
  it('shows a made-up word, topic or tip as its label', () => {
    expect(answerParts('Pozri [flarpo](/word/flarpo), [tému](/topic/nic) a [tip](/practice/grammar/nic).')).toEqual([
      { type: 'text', text: 'Pozri flarpo, tému a tip.' },
    ])
  })

  it('keeps real pages and their queries', () => {
    for (const to of ['/', '/word/casa', '/topic/city', '/practice/grammar/por-para', '/practice?type=conjugation', '/diary/2026-11-07', '/profile/goal']) {
      expect(appPathExists(to), to).toBe(true)
    }
    for (const to of ['/foo', '/word', '/word/casa/x', '/diary/dnes', '/practice/grammar/nic']) expect(appPathExists(to), to).toBe(false)
  })
})

describe('answerBlocks', () => {
  it('splits an answer into paragraphs and the cards the app has', () => {
    const blocks = answerBlocks('Minulý čas od tener:\n{{conj:tener:preterito}}\nSlovo:\n{{word:casa}}\n{{ tip:por-para }}')
    expect(blocks.map((b) => (b.type === 'card' ? b.card : b.parts))).toEqual([
      [{ type: 'text', text: 'Minulý čas od tener:' }],
      { type: 'conj', verbId: 'tener', tense: 'preterito' },
      [{ type: 'text', text: 'Slovo:' }],
      { type: 'word', id: 'casa' },
      { type: 'tip', id: 'por-para' },
    ])
  })

  it('leaves out a card the app does not have and keeps the text around it', () => {
    const blocks = answerBlocks('A {{word:flarpo}} B {{conj:tener:pasado}} {{conj:flarpar:presente}} {{tip}} C')
    expect(blocks).toEqual([
      { type: 'text', parts: [{ type: 'text', text: 'A' }] },
      { type: 'text', parts: [{ type: 'text', text: 'B' }] },
      { type: 'text', parts: [{ type: 'text', text: 'C' }] },
    ])
  })

  it('reads a marker only by its own shape', () => {
    expect(cardOf('word:casa:x')).toBeUndefined()
    expect(cardOf('conj:tener')).toBeUndefined()
    expect(cardOf('conj:tener:imperativo')).toEqual({ type: 'conj', verbId: 'tener', tense: 'imperativo' })
  })
})

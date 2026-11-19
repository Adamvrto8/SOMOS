import { describe, expect, it } from 'vitest'
import { answerBlocks, answerParts, appPathExists, cardOf, followUpsOf, freshFollowUps } from './answerText'

describe('answerParts', () => {
  it('keeps bold Spanish as its own part', () => {
    expect(answerParts('To je **casa** a __carro__.')).toEqual([
      { type: 'text', text: 'To je ' },
      { type: 'strong', text: 'casa' },
      { type: 'text', text: ' a ' },
      { type: 'strong', text: 'carro' },
      { type: 'text', text: '.' },
    ])
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
    expect(blocks.map((b) => (b.type === 'card' ? b.card : b.type === 'text' ? b.parts : b.items))).toEqual([
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

describe('examples, lists and follow-up questions', () => {
  it('reads "- es – sk" lines as examples and other list lines as items', () => {
    const blocks = answerBlocks('Pozri:\n- Este regalo es **para** ti. – Tento darček je pre teba.\n- iný bod [tu](/review)\nKoniec.')
    expect(blocks).toEqual([
      { type: 'text', parts: [{ type: 'text', text: 'Pozri:' }] },
      {
        type: 'list',
        items: [
          { type: 'example', es: 'Este regalo es para ti.', text: 'Tento darček je pre teba.' },
          { type: 'item', parts: [{ type: 'text', text: 'iný bod ' }, { type: 'link', label: 'tu', to: '/review' }] },
        ],
      },
      { type: 'text', parts: [{ type: 'text', text: 'Koniec.' }] },
    ])
  })

  it('takes up to two follow-up questions out of the answer', () => {
    const text = 'Casa je dom.\n{{dalej:Ako sa povie byt?}}\n{{dalej: Použi casa vo vete }}\n{{dalej:Tretia?}}'
    expect(followUpsOf(text)).toEqual(['Ako sa povie byt?', 'Použi casa vo vete'])
    expect(answerBlocks(text)).toEqual([{ type: 'text', parts: [{ type: 'text', text: 'Casa je dom.' }] }])
  })

  it('offers only follow-ups the chat has not asked or offered before', () => {
    const turns = [
      { question: 'Čo je fue?', answer: 'Fue je ser aj ir.\n{{dalej:Ako sa časuje „ser“ v prítomnom čase?}}' },
      { question: 'Dá sa hovoriť hlasom?', answer: 'Nie.\n{{dalej:Ako sa časuje ser v prítomnom čase?}}\n{{dalej:Čo je Vyslovovanie?}}' },
    ]
    expect(freshFollowUps(turns)).toEqual(['Čo je Vyslovovanie?'])
    expect(freshFollowUps([])).toEqual([])
  })

  it('leaves out a path with a placeholder of the app map', () => {
    expect(answerBlocks('Na detaile slova (/word/<id>) nájdeš príklady.')).toEqual([
      { type: 'text', parts: [{ type: 'text', text: 'Na detaile slova nájdeš príklady.' }] },
    ])
  })
})

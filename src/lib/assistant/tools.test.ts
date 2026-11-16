import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import chatSource from '../../../api/chat.ts?raw'
import { cap, MAX_TOOL_OUTPUT, runTool, TOOL_HANDLERS } from './tools'

// Read the server file as text: importing it would pull node types into the app's type-check.
const TOOL_NAMES = [...chatSource.matchAll(/\bname: '(\w+)'/g)].map((m) => m[1])

type Json = { [key: string]: any }

const ok = async (name: string, input: unknown): Promise<Json> => {
  const out = await runTool(name, input)
  expect(out.isError).toBe(false)
  return JSON.parse(out.content) as Json
}

describe('contract with api/chat.ts', async () => {
  it('has a handler for every tool of the server and no more', async () => {
    expect(Object.keys(TOOL_HANDLERS).sort()).toEqual([...TOOL_NAMES].sort())
  })
})

describe('search_word', async () => {
  it('finds a word by its Spanish form with translations and a link', async () => {
    const out = await ok('search_word', { query: 'casa' })
    expect(out.found).toBe(true)
    expect(out.results.length).toBeLessThanOrEqual(5)
    expect(out.results[0]).toMatchObject({ es: 'casa', link: '/word/casa' })
    expect(out.results[0].translations.length).toBeGreaterThan(0)
  })

  it('finds a word by its Slovak form', async () => {
    const out = await ok('search_word', { query: 'dom' })
    expect(out.found).toBe(true)
    expect(out.results.some((r: { es: string }) => r.es === 'casa')).toBe(true)
  })

  it('finds a verb by a conjugated form and says which form matched', async () => {
    const out = await ok('search_word', { query: 'fui' })
    expect(out.results.some((r: { matchedForm?: string }) => r.matchedForm === 'fui')).toBe(true)
  })

  it('gives only the exact match when there is one, not the fuzzy neighbours', async () => {
    const out = await ok('search_word', { query: 'pes' })
    const found = out.results.map((r: { es: string }) => r.es)
    expect(found).toContain('perro')
    expect(found).not.toContain('pesar')
    expect(found).not.toContain('pescar')
  })

  it('still gives the near matches when nothing matches exactly', async () => {
    expect((await ok('search_word', { query: 'perrro' })).found).toBe(true)
  })

  it('says found:false instead of failing for an unknown word', async () => {
    expect(await ok('search_word', { query: 'zzzqqq' })).toEqual({ found: false })
  })

  it('refuses an empty query as an input error', async () => {
    const out = await runTool('search_word', { query: '   ' })
    expect(out.isError).toBe(true)
  })
})

describe('get_conjugation', async () => {
  it('returns four tenses by default, with the irregular forms listed', async () => {
    const out = await ok('get_conjugation', { verb: 'tener' })
    expect(out).toMatchObject({ found: true, verb: 'tener', regular: false })
    expect(Object.keys(out.tenses)).toEqual(['presente', 'preterito', 'imperfecto', 'futuro'])
    expect(out.tenses.presente.yo).toBe('tengo')
    expect(out.irregular).toContain('presente.yo')
    expect(out.link).toBe('/word/tener')
  })

  it('returns just the asked tense', async () => {
    const out = await ok('get_conjugation', { verb: 'hablar', tense: 'preterito' })
    expect(Object.keys(out.tenses)).toEqual(['preterito'])
    expect(out.tenses.preterito.yo).toBe('hablé')
  })

  it('knows no vosotros for Mexican Spanish', async () => {
    const out = await ok('get_conjugation', { verb: 'hablar' })
    expect(JSON.stringify(out)).not.toContain('vosotros')
  })

  it('finds the verb from a conjugated form', async () => {
    const out = await ok('get_conjugation', { verb: 'fui' })
    expect(out.found).toBe(true)
    expect(['ser', 'ir']).toContain(out.verb)
  })

  it('finds a reflexive verb by its infinitive with se', async () => {
    const out = await ok('get_conjugation', { verb: 'levantarse' })
    expect(out.found).toBe(true)
  })

  it('does not return another verb for a near miss', async () => {
    // Fuzzy search used to resolve these to tener / hablar: an invented answer about a word that does not exist.
    expect(await ok('get_conjugation', { verb: 'tenir' })).toEqual({ found: false })
    expect(await ok('get_conjugation', { verb: 'hablarr' })).toEqual({ found: false })
  })

  it('still resolves infinitives, reflexive infinitives and forms', async () => {
    expect((await ok('get_conjugation', { verb: 'tener' })).verb).toBe('tener')
    expect((await ok('get_conjugation', { verb: 'levantarse' })).found).toBe(true)
    expect((await ok('get_conjugation', { verb: 'estoy' })).verb).toBe('estar')
    expect((await ok('get_conjugation', { verb: 'me llamo' })).verb).toBe('llamarse')
  })

  it('says found:false for an unknown verb', async () => {
    expect(await ok('get_conjugation', { verb: 'zzzqqq' })).toEqual({ found: false })
  })

  it('refuses an unknown tense as an input error that names the valid ones', async () => {
    const out = await runTool('get_conjugation', { verb: 'tener', tense: 'nope' })
    expect(out.isError).toBe(true)
    expect(out.content).toContain('presente')
  })
})

describe('get_grammar_tip', async () => {
  it('finds a tip with rules, examples and a link', async () => {
    const out = await ok('get_grammar_tip', { query: 'ser estar' })
    expect(out.found).toBe(true)
    expect(out.tips.length).toBeLessThanOrEqual(2)
    expect(out.tips[0].link).toMatch(/^\/practice\/grammar\//)
    expect(out.tips[0].rules.length).toBeGreaterThan(0)
  })

  it('says found:false for a topic without a tip', async () => {
    expect(await ok('get_grammar_tip', { query: 'zzzqqq' })).toEqual({ found: false })
  })

  it('finds the tip from a whole question, the words around the topic do not drop it', async () => {
    const first = async (query: string) => (await ok('get_grammar_tip', { query })).tips[0].link
    expect(await first('kedy použiť ser a kedy estar')).toBe('/practice/grammar/ser-estar')
    expect(await first('rozdiel medzi por a para')).toBe('/practice/grammar/por-para')
    expect(await first('por vs para')).toBe('/practice/grammar/por-para')
  })

  it('does not bring a tip that only mentions the word in an example', async () => {
    expect((await ok('get_grammar_tip', { query: 'rozdiel medzi saber a conocer' })).found).toBe(false)
  })

  it('lists the titles of a level', async () => {
    const out = await ok('get_grammar_tip', { level: 'A1' })
    expect(out.found).toBe(true)
    expect(out.tips.length).toBeGreaterThan(1)
    expect(out.tips.some((t: { link: string }) => t.link === '/practice/grammar/presente')).toBe(true)
  })

  it('refuses an empty query rather than listing every tip', async () => {
    expect((await runTool('get_grammar_tip', { query: '' })).isError).toBe(true)
  })
})

describe('runTool', async () => {
  it('turns an unknown tool into an error result', async () => {
    const out = await runTool('delete_everything', {})
    expect(out.isError).toBe(true)
  })

  it('turns a wrong input type into an error result and does not throw', async () => {
    expect((await runTool('get_conjugation', { verb: 5 })).isError).toBe(true)
    expect((await runTool('search_word', null)).isError).toBe(true)
    expect((await runTool('search_word', 'dom')).isError).toBe(true)
  })

  it('caps the output', async () => {
    // A topic that matches many tips and words still stays within the cap.
    const out = await runTool('get_grammar_tip', { query: 'a' })
    expect(out.content.length).toBeLessThanOrEqual(MAX_TOOL_OUTPUT + 40)
  })
})

describe('get_grammar_tip by id', () => {
  it('gives exactly the tip the map names', async () => {
    const out = await ok('get_grammar_tip', { id: 'por-para' })
    expect(out.tips).toHaveLength(1)
    expect(out.tips[0].link).toBe('/practice/grammar/por-para')
  })

  it('says found:false with a hint for an unknown id', async () => {
    const out = await ok('get_grammar_tip', { id: 'neexistuje' })
    expect(out.found).toBe(false)
    expect(out.hint).toBeTruthy()
  })

  it('refuses a call with neither id, query nor level', async () => {
    expect((await runTool('get_grammar_tip', {})).isError).toBe(true)
  })
})

describe('search_word example', () => {
  it('gives an example sentence from the app with the word', async () => {
    const out = await ok('search_word', { query: 'casa' })
    expect(out.results[0].example).toMatch(/ – /)
  })
})

describe('get_my_records', () => {
  it('refuses an unknown kind', async () => {
    expect((await runTool('get_my_records', { kind: 'secrets' })).isError).toBe(true)
  })

  it('reads an empty table as an empty list', async () => {
    expect(await ok('get_my_records', { kind: 'mistakes' })).toEqual({ kind: 'mistakes', count: 0, items: [] })
  })
})

describe('cap', () => {
  it('never cuts an emoji in half', () => {
    const out = cap(`${'x'.repeat(MAX_TOOL_OUTPUT - 1)}\u{1F600}\u{1F600}`)
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })
})

describe('get_grammar_tip level list', () => {
  it('says how many tips the level has, so the model does not count', async () => {
    const out = await ok('get_grammar_tip', { level: 'A1' })
    expect(out.count).toBe(out.tips.length)
  })
})

describe('search_word for a word the dictionary lacks', () => {
  it('points to the grammar tip that uses it, so the model does not guess (el problema, eval run 2)', async () => {
    const out = await ok('search_word', { query: 'problema' })
    expect(out.inTips[0]).toMatchObject({ id: 'gender', rule: 'Mužské koncovky', link: '/practice/grammar/gender' })
    expect(out.inTips[0].example).toContain('el problema')
  })

  it('adds nothing for a word the dictionary has', async () => {
    expect((await ok('search_word', { query: 'casa' })).inTips).toBeUndefined()
  })
})

describe('search_word topics', () => {
  it('gives the topic of the word, so the model links the right one (carro is city, eval run 3)', async () => {
    const out = await ok('search_word', { query: 'carro' })
    expect(out.results[0].topics).toEqual([{ name: 'Mesto', link: '/topic/city' }])
  })
})

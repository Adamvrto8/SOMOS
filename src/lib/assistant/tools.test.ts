import { describe, expect, it } from 'vitest'
import chatSource from '../../../api/chat.ts?raw'
import { appHelp } from './appHelp'
import { MAX_TOOL_OUTPUT, runTool, TOOL_HANDLERS } from './tools'

// Read the server file as text: importing it would pull node types into the app's type-check.
const TOOL_NAMES = [...chatSource.matchAll(/\bname: '(\w+)'/g)].map((m) => m[1])

type Json = { [key: string]: any }

const ok = (name: string, input: unknown) => {
  const out = runTool(name, input)
  expect(out.isError).toBe(false)
  return JSON.parse(out.content) as Json
}

describe('contract with api/chat.ts', () => {
  it('has a handler for every tool of the server and no more', () => {
    expect(Object.keys(TOOL_HANDLERS).sort()).toEqual([...TOOL_NAMES].sort())
  })
})

describe('search_word', () => {
  it('finds a word by its Spanish form with translations and a link', () => {
    const out = ok('search_word', { query: 'casa' })
    expect(out.found).toBe(true)
    expect(out.results.length).toBeLessThanOrEqual(5)
    expect(out.results[0]).toMatchObject({ es: 'casa', link: '/word/casa' })
    expect(out.results[0].translations.length).toBeGreaterThan(0)
  })

  it('finds a word by its Slovak form', () => {
    const out = ok('search_word', { query: 'dom' })
    expect(out.found).toBe(true)
    expect(out.results.some((r: { es: string }) => r.es === 'casa')).toBe(true)
  })

  it('finds a verb by a conjugated form and says which form matched', () => {
    const out = ok('search_word', { query: 'fui' })
    expect(out.results.some((r: { matchedForm?: string }) => r.matchedForm === 'fui')).toBe(true)
  })

  it('gives only the exact match when there is one, not the fuzzy neighbours', () => {
    const out = ok('search_word', { query: 'pes' })
    const found = out.results.map((r: { es: string }) => r.es)
    expect(found).toContain('perro')
    expect(found).not.toContain('pesar')
    expect(found).not.toContain('pescar')
  })

  it('still gives the near matches when nothing matches exactly', () => {
    expect(ok('search_word', { query: 'perrro' }).found).toBe(true)
  })

  it('says found:false instead of failing for an unknown word', () => {
    expect(ok('search_word', { query: 'zzzqqq' })).toEqual({ found: false })
  })

  it('refuses an empty query as an input error', () => {
    const out = runTool('search_word', { query: '   ' })
    expect(out.isError).toBe(true)
  })
})

describe('get_conjugation', () => {
  it('returns four tenses by default, with the irregular forms listed', () => {
    const out = ok('get_conjugation', { verb: 'tener' })
    expect(out).toMatchObject({ found: true, verb: 'tener', regular: false })
    expect(Object.keys(out.tenses)).toEqual(['presente', 'preterito', 'imperfecto', 'futuro'])
    expect(out.tenses.presente.yo).toBe('tengo')
    expect(out.irregular).toContain('presente.yo')
    expect(out.link).toBe('/word/tener')
  })

  it('returns just the asked tense', () => {
    const out = ok('get_conjugation', { verb: 'hablar', tense: 'preterito' })
    expect(Object.keys(out.tenses)).toEqual(['preterito'])
    expect(out.tenses.preterito.yo).toBe('hablé')
  })

  it('knows no vosotros for Mexican Spanish', () => {
    const out = ok('get_conjugation', { verb: 'hablar' })
    expect(JSON.stringify(out)).not.toContain('vosotros')
  })

  it('finds the verb from a conjugated form', () => {
    const out = ok('get_conjugation', { verb: 'fui' })
    expect(out.found).toBe(true)
    expect(['ser', 'ir']).toContain(out.verb)
  })

  it('finds a reflexive verb by its infinitive with se', () => {
    const out = ok('get_conjugation', { verb: 'levantarse' })
    expect(out.found).toBe(true)
  })

  it('does not return another verb for a near miss', () => {
    // Fuzzy search used to resolve these to tener / hablar: an invented answer about a word that does not exist.
    expect(ok('get_conjugation', { verb: 'tenir' })).toEqual({ found: false })
    expect(ok('get_conjugation', { verb: 'hablarr' })).toEqual({ found: false })
  })

  it('still resolves infinitives, reflexive infinitives and forms', () => {
    expect(ok('get_conjugation', { verb: 'tener' }).verb).toBe('tener')
    expect(ok('get_conjugation', { verb: 'levantarse' }).found).toBe(true)
    expect(ok('get_conjugation', { verb: 'estoy' }).verb).toBe('estar')
    expect(ok('get_conjugation', { verb: 'me llamo' }).verb).toBe('llamarse')
  })

  it('says found:false for an unknown verb', () => {
    expect(ok('get_conjugation', { verb: 'zzzqqq' })).toEqual({ found: false })
  })

  it('refuses an unknown tense as an input error that names the valid ones', () => {
    const out = runTool('get_conjugation', { verb: 'tener', tense: 'nope' })
    expect(out.isError).toBe(true)
    expect(out.content).toContain('presente')
  })
})

describe('get_grammar_tip', () => {
  it('finds a tip with rules, examples and a link', () => {
    const out = ok('get_grammar_tip', { query: 'ser estar' })
    expect(out.found).toBe(true)
    expect(out.tips.length).toBeLessThanOrEqual(2)
    expect(out.tips[0].link).toMatch(/^\/practice\/grammar\//)
    expect(out.tips[0].rules.length).toBeGreaterThan(0)
  })

  it('says found:false for a topic without a tip', () => {
    expect(ok('get_grammar_tip', { query: 'zzzqqq' })).toEqual({ found: false })
  })

  it('finds the tip from a whole question, the words around the topic do not drop it', () => {
    const first = (query: string) => ok('get_grammar_tip', { query }).tips[0].link
    expect(first('kedy použiť ser a kedy estar')).toBe('/practice/grammar/ser-estar')
    expect(first('rozdiel medzi por a para')).toBe('/practice/grammar/por-para')
    expect(first('por vs para')).toBe('/practice/grammar/por-para')
  })

  it('does not bring a tip that only mentions the word in an example', () => {
    expect(ok('get_grammar_tip', { query: 'rozdiel medzi saber a conocer' }).found).toBe(false)
  })

  it('lists the titles of a level', () => {
    const out = ok('get_grammar_tip', { level: 'A1' })
    expect(out.found).toBe(true)
    expect(out.tips.length).toBeGreaterThan(1)
    expect(out.tips.some((t: { link: string }) => t.link === '/practice/grammar/presente')).toBe(true)
  })

  it('refuses an empty query rather than listing every tip', () => {
    expect(runTool('get_grammar_tip', { query: '' }).isError).toBe(true)
  })
})

describe('app_help', () => {
  it('answers a topic', () => {
    const out = ok('app_help', { topic: 'séria' })
    expect(out.found).toBe(true)
    expect(out.text).toContain('Ochrana série')
  })

  it('lists the topics when the topic is missing or unknown', () => {
    expect(ok('app_help', {}).topics.length).toBeGreaterThan(5)
    expect(ok('app_help', { topic: 'zzzqqq' }).found).toBe(false)
  })

  it('knows Môj slovník as part of Profil', () => {
    const out = appHelp('môj slovník')
    expect(out.found).toBe(true)
    expect(out.text).toContain('Profil')
  })

  it('knows the diary, also when asked about writing down what was learned', () => {
    expect(appHelp('denník')).toMatchObject({ found: true, topic: 'dennik' })
    expect(appHelp('zapísať poznatky z dňa')).toMatchObject({ found: true, topic: 'dennik' })
  })

  it('knows tests, the duel and the overview', () => {
    expect(appHelp('testy').topic).toBe('testy')
    expect(appHelp('duel').topic).toBe('duel')
    expect(appHelp('štatistiky').topic).toBe('prehlad')
  })

  it('works without the tool wrapper', () => {
    expect(appHelp('archív').found).toBe(true)
  })
})

describe('runTool', () => {
  it('turns an unknown tool into an error result', () => {
    const out = runTool('delete_everything', {})
    expect(out.isError).toBe(true)
  })

  it('turns a wrong input type into an error result and does not throw', () => {
    expect(runTool('get_conjugation', { verb: 5 }).isError).toBe(true)
    expect(runTool('search_word', null).isError).toBe(true)
    expect(runTool('search_word', 'dom').isError).toBe(true)
  })

  it('caps the output', () => {
    // A topic that matches many tips and words still stays within the cap.
    const out = runTool('get_grammar_tip', { query: 'a' })
    expect(out.content.length).toBeLessThanOrEqual(MAX_TOOL_OUTPUT + 40)
  })
})

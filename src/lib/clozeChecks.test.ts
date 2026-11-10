import { describe, expect, it } from 'vitest'
import { sentences, tipById, verbById } from '../data'
import type { Cloze, Sentence } from '../data/types'
import { TENSE_LEVEL, type TableTense } from './conjugate'
import { checksOwnHint, formsFor, usageClozeErrors, usageHint, USAGE_TIPS } from './clozeChecks'

const sentence = (cloze: Cloze, grammar: Sentence['grammar'] = ['si-clauses']): Sentence => ({
  id: 's9999',
  es: 'x',
  sk: 'x',
  level: 'B1',
  topics: ['basics'],
  tokens: [cloze.answer],
  grammar,
  cloze: [cloze],
})
const errors = (cloze: Cloze, grammar?: Sentence['grammar']) => usageClozeErrors(sentence(cloze, grammar), cloze, tipById, verbById)
const blank = (over: Partial<Cloze>): Cloze => ({ tokenIndex: 0, answer: 'leería', lemma: 'leer', hint: 'leer · yo', tip: 'si-clauses', why: 'unreal', ...over })

describe('usageHint', () => {
  it('tells a hint without tense, the lemma alone and anything else apart', () => {
    expect(usageHint(blank({}), verbById)).toEqual({ kind: 'person', lemma: 'leer', person: 'yo' })
    expect(usageHint(blank({ hint: 'doler', lemma: 'doler', answer: 'duelen' }), verbById)).toEqual({ kind: 'lemma' })
    expect(usageHint(blank({ hint: 'por/para', lemma: 'para', answer: 'para' }), verbById)).toEqual({ kind: 'other' })
    expect(usageHint(blank({ hint: 'leer · yo · condicional' }), verbById)).toEqual({ kind: 'other' })
  })
})

describe('formsFor', () => {
  it('lists the one-word forms of a person in every simple tense', () => {
    const forms = formsFor(verbById.get('tener')!, 'yo')
    expect(forms).toEqual(expect.arrayContaining(['tengo', 'tuve', 'tenía', 'tendré', 'tenga', 'tuviera', 'tendría']))
    expect(formsFor(verbById.get('tener')!, 'tu')).toContain('ten')
    expect(formsFor(verbById.get('levantarse')!, 'yo')).toContain('levanto')
  })
})

describe('usageClozeErrors', () => {
  it('accepts a good usage blank', () => {
    expect(errors(blank({}))).toEqual([])
    expect(errors(blank({ hint: 'doler', lemma: 'doler', answer: 'duelen', tip: 'gustar', why: 'similar' }), ['gustar'])).toEqual([])
    expect(errors(blank({ hint: 'por/para', lemma: 'para', answer: 'para', tip: 'por-para', why: 'para' }), ['por-para'])).toEqual([])
  })

  it('wants a usage tip, its own rule and the tag', () => {
    expect(errors(blank({ tip: 'subjuntivo' }))).toContain('tip "subjuntivo" is not a usage tip')
    expect(errors(blank({ why: undefined }))).toContain('a blank with `tip` needs `why`')
    expect(errors(blank({ why: 'para' }))).toContain('why "para" is not a rule of the tip "si-clauses"')
    expect(errors(blank({}), ['condicional'])).toContain('the sentence is not tagged "si-clauses"')
  })

  it('allows a hint without tense only on a usage blank, with a form of that person', () => {
    expect(errors(blank({ tip: undefined, why: undefined }))).toContain('a hint without tense needs `tip`')
    expect(errors(blank({ answer: 'leíste' }))).toContain('"leíste" is not a form of leer for yo')
    expect(errors(blank({ hint: 'doler', lemma: 'doler', answer: 'dolemos', tip: 'gustar', why: 'how' }), ['gustar'])).toEqual([])
    expect(errors(blank({ hint: 'doler', lemma: 'doler', answer: 'duelo', tip: 'gustar', why: 'how' }), ['gustar'])).toEqual([])
    expect(errors(blank({ hint: 'doler', lemma: 'doler', answer: 'dolón', tip: 'gustar', why: 'how' }), ['gustar'])).toContain('"dolón" is not a form of doler')
  })

  it('lets a Slovak hint stand on a verb of a usage blank, the answer still a form of it', () => {
    expect(errors(blank({ hint: 'hay/estar', lemma: 'estar', answer: 'está', tip: 'hay-estar', why: 'estar' }), ['hay-estar'])).toEqual([])
    expect(errors(blank({ hint: 'hay/estar', lemma: 'estar', answer: 'esto', tip: 'hay-estar', why: 'estar' }), ['hay-estar'])).toContain('"esto" is not a form of estar')
    expect(checksOwnHint(blank({ hint: 'hay/estar', lemma: 'estar', answer: 'está', tip: 'hay-estar' }), verbById)).toBe(true)
    expect(checksOwnHint(blank({ hint: 'estar · él · presente', lemma: 'estar', answer: 'está', tip: 'hay-estar' }), verbById)).toBe(false)
    expect(checksOwnHint(blank({ hint: 'hay/estar', lemma: 'estar', answer: 'está', tip: undefined }), verbById)).toBe(false)
  })

  it('names thirty-one usage tips, each a tip with rules', () => {
    expect(USAGE_TIPS).toHaveLength(31)
    for (const id of USAGE_TIPS) expect(tipById.get(id)?.rules.length).toBeGreaterThan(0)
  })
})

describe('blank levels', () => {
  const TENSE_OF_LABEL: Record<string, TableTense> = {
    presente: 'presente',
    pretérito: 'preterito',
    imperfecto: 'imperfecto',
    futuro: 'futuro',
    condicional: 'condicional',
    subjuntivo: 'subjuntivo',
    'subjuntivo imperfecto': 'subjImperfecto',
    imperativo: 'imperativo',
  }
  const LEVELS = ['A1', 'A2', 'B1', 'B2']

  it('asks no sentence for a tense taught above its level', () => {
    const above: string[] = []
    for (const s of sentences)
      for (const c of s.cloze ?? []) {
        const tense = TENSE_OF_LABEL[c.hint?.split(' · ')[2] ?? '']
        if (tense && LEVELS.indexOf(TENSE_LEVEL[tense]) > LEVELS.indexOf(s.level)) above.push(`${s.id} ${c.hint}`)
      }
    expect(above).toEqual([])
  })

  it('offers no distractor that is right in its sentence too', () => {
    // cuidar de alguien is as right as cuidar a alguien; ¿Qué es esto? as right as ¿Qué es eso?
    const alsoRight: string[] = []
    for (const s of sentences)
      for (const c of s.cloze ?? []) {
        const before = s.tokens[c.tokenIndex - 1]?.toLowerCase() ?? ''
        if (c.tip === 'personal-a' && /^cuid/.test(before) && c.distractors?.includes('de')) alsoRight.push(s.id)
        if (c.tip === 'demonstratives' && c.answer === 'eso' && s.tokens.join(' ') === '¿ Qué es eso ?' && c.distractors?.includes('esto')) alsoRight.push(s.id)
      }
    expect(alsoRight).toEqual([])
  })

  it('names no tip above the sentence’s level', () => {
    const above: string[] = []
    for (const s of sentences)
      for (const c of s.cloze ?? []) {
        const tip = c.tip && tipById.get(c.tip)
        if (tip && LEVELS.indexOf(tip.level) > LEVELS.indexOf(s.level)) above.push(`${s.id} ${c.tip}`)
      }
    expect(above).toEqual([])
  })
})

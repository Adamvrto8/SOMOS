import { describe, expect, it } from 'vitest'
import { verbs } from '../data'
import { bareVosotros, vosotrosForm, vosotrosNegative, type VosotrosTense } from './vosotros'

const verb = (id: string) => verbs.find((v) => v.id === id)!
const f = (id: string, tense: VosotrosTense) => vosotrosForm(verb(id), tense)

describe('vosotros', () => {
  it('presente: endings only, the stem never changes', () => {
    expect(['hablar', 'comer', 'vivir', 'pensar', 'dormir', 'tener', 'hacer'].map((v) => f(v, 'presente'))).toEqual(['habláis', 'coméis', 'vivís', 'pensáis', 'dormís', 'tenéis', 'hacéis'])
    expect(['ser', 'ir', 'ver', 'dar', 'estar'].map((v) => f(v, 'presente'))).toEqual(['sois', 'vais', 'veis', 'dais', 'estáis'])
  })
  it('past tenses come from the tú form', () => {
    expect(f('hablar', 'preterito')).toBe('hablasteis')
    expect(f('tener', 'preterito')).toBe('tuvisteis')
    expect(f('ir', 'preterito')).toBe('fuisteis')
    expect(f('ser', 'imperfecto')).toBe('erais')
    expect(f('comer', 'imperfecto')).toBe('comíais')
    expect(f('hablar', 'subjImperfecto')).toBe('hablarais')
    expect(f('tener', 'condicional')).toBe('tendríais')
  })
  it('futuro and subjuntivo', () => {
    expect(f('tener', 'futuro')).toBe('tendréis')
    expect(f('hablar', 'subjuntivo')).toBe('habléis')
    expect(f('comer', 'subjuntivo')).toBe('comáis')
    expect(f('dormir', 'subjuntivo')).toBe('durmáis')
    expect(f('pensar', 'subjuntivo')).toBe('penséis')
    expect(f('buscar', 'subjuntivo')).toBe('busquéis')
    expect(f('dar', 'subjuntivo')).toBe('deis')
    expect(f('ir', 'subjuntivo')).toBe('vayáis')
  })
  it('imperativo and reflexive verbs', () => {
    expect(f('hablar', 'imperativo')).toBe('hablad')
    expect(f('venir', 'imperativo')).toBe('venid')
    expect(f('ir', 'imperativo')).toBe('id')
    expect(f('levantarse', 'imperativo')).toBe('levantaos')
    expect(f('levantarse', 'presente')).toBe('os levantáis')
    expect(vosotrosNegative(verb('hablar'))).toBe('no habléis')
    expect(vosotrosNegative(verb('levantarse'))).toBe('no os levantéis')
  })
  it('every verb gets a plausible single-word form in every tense', () => {
    const ending = /(áis|éis|ís|is|eis|ais|ad|ed|id|aos|eos|íos|idos|oís|reís)$/
    for (const v of verbs)
      for (const t of ['presente', 'preterito', 'imperfecto', 'futuro', 'condicional', 'subjuntivo', 'subjImperfecto', 'imperativo'] as const) {
        const form = bareVosotros(v, t)
        expect(form, `${v.id} ${t}`).toMatch(ending)
        expect(form, `${v.id} ${t}`).not.toMatch(/\s/)
      }
  })
})

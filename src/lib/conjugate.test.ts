import { describe, expect, it } from 'vitest'
import { verbById } from '../data'
import type { Person } from '../data/types'
import { conjugate, formText, negativeImperative, personLabel, personsOf, TABLE_TENSES, tensesUpTo, type TableTense } from './conjugate'

const estar = verbById.get('estar')!
const form = (id: string, tense: TableTense, person: Person) => formText(conjugate(verbById.get(id)!, tense, person, estar))

describe('conjugate', () => {
  it('reads the stored B1–B2 tenses', () => {
    expect(form('tener', 'subjuntivo', 'yo')).toBe('tenga')
    expect(form('tener', 'subjImperfecto', 'nosotros')).toBe('tuviéramos')
    expect(form('tener', 'condicional', 'el')).toBe('tendría')
    expect(form('decir', 'imperativo', 'tu')).toBe('di')
    expect(form('levantarse', 'imperativo', 'el')).toBe('levántese')
  })

  it('derives pluscuamperfecto from haber and the participle', () => {
    expect(form('salir', 'pluscuamperfecto', 'el')).toBe('había salido')
    expect(form('hacer', 'pluscuamperfecto', 'nosotros')).toBe('habíamos hecho')
    expect(form('levantarse', 'pluscuamperfecto', 'yo')).toBe('me había levantado')
  })

  it('highlights irregular new forms', () => {
    expect(conjugate(verbById.get('tener')!, 'subjuntivo', 'yo', estar)[0].irregular).toBe(true)
    expect(conjugate(verbById.get('hablar')!, 'subjuntivo', 'yo', estar)[0].irregular).toBe(false)
    const plus = conjugate(verbById.get('hacer')!, 'pluscuamperfecto', 'yo', estar)
    expect(plus.map((p) => p.irregular)).toEqual([false, true]) // había · hecho
  })

  it('builds the negative imperative from the subjunctive', () => {
    expect(formText(negativeImperative(verbById.get('tener')!, 'tu'))).toBe('no tengas')
    expect(formText(negativeImperative(verbById.get('levantarse')!, 'tu'))).toBe('no te levantes')
  })
})

describe('tenses and persons', () => {
  it('asks each tense from its level', () => {
    expect(tensesUpTo('A1')).toEqual(['presente', 'progresivo', 'preterito', 'imperfecto', 'futuro'])
    expect(tensesUpTo('A2')).toEqual(['presente', 'progresivo', 'preterito', 'perfecto', 'imperfecto', 'futuro', 'imperativo'])
    expect(tensesUpTo('B1')).not.toContain('subjImperfecto')
    expect(tensesUpTo('B2')).toEqual(TABLE_TENSES)
    expect(tensesUpTo()).toEqual(TABLE_TENSES)
  })

  it('has no yo in the imperative and calls its persons usted / ustedes', () => {
    expect(personsOf('imperativo')).toEqual(['tu', 'el', 'nosotros', 'ellos'])
    expect(personsOf('presente')).toHaveLength(5)
    expect(personLabel('imperativo', 'el')).toBe('usted')
    expect(personLabel('imperativo', 'ellos')).toBe('ustedes')
    expect(personLabel('presente', 'el')).toBe('él / ella / usted')
  })
})

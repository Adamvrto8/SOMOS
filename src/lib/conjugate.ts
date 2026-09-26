import type { Person, Tense, Verb } from '../data/types'

export const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']

export const PERSON_LABELS: Record<Person, string> = {
  yo: 'yo',
  tu: 'tú',
  el: 'él / ella / usted',
  nosotros: 'nosotros',
  ellos: 'ellos / ellas / ustedes',
}

export type TableTense = Tense | 'progresivo'

/** Tenses stored on every verb. */
export const TENSES: Tense[] = ['presente', 'preterito', 'imperfecto', 'futuro']

/** Conjugation tabs and the drill's tense filter, in teaching order. */
export const TABLE_TENSES: TableTense[] = ['presente', 'progresivo', 'preterito', 'imperfecto', 'futuro']

export const TENSE_LABELS: Record<TableTense, string> = {
  presente: 'presente',
  progresivo: 'progresivo',
  preterito: 'pretérito',
  imperfecto: 'imperfecto',
  futuro: 'futuro',
}

const REFLEXIVE_PRONOUN: Record<Person, string> = { yo: 'me', tu: 'te', el: 'se', nosotros: 'nos', ellos: 'se' }

/** A piece of a conjugated form; `irregular` pieces get highlighted in the UI. */
export interface FormPart {
  text: string
  irregular: boolean
}

export function isIrregular(verb: Verb, tense: Tense, person: Person): boolean {
  const forms = verb.irregularForms ?? []
  return forms.includes(`${tense}.${person}`) || forms.includes(`${tense}.*`)
}

/**
 * Conjugated form split into parts. Progresivo is derived from estar + gerund
 * ("estoy hablando"); reflexive verbs put the pronoun first ("me estoy llamando").
 */
export function conjugate(verb: Verb, tense: TableTense, person: Person, estar: Verb): FormPart[] {
  if (tense !== 'progresivo') {
    return [{ text: verb[tense][person], irregular: isIrregular(verb, tense, person) }]
  }
  const aux = estar.presente[person]
  return [
    { text: verb.reflexive ? `${REFLEXIVE_PRONOUN[person]} ${aux}` : aux, irregular: false },
    { text: verb.gerund, irregular: Boolean(verb.gerundIrregular) },
  ]
}

export const formText = (parts: FormPart[]) => parts.map((p) => p.text).join(' ')

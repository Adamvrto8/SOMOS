import type { ImperativePerson, Level, Person, Tense, Verb } from '../data/types'
import { IMPERATIVE_PERSONS } from './verbForms'
import { vosotrosForm, vosotrosIrregular, vosotrosNegative } from './vosotros'

export const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']

export const PERSON_LABELS: Record<Person, string> = {
  yo: 'yo',
  tu: 'tú',
  el: 'él / ella / usted',
  nosotros: 'nosotros',
  ellos: 'ellos / ellas / ustedes',
}

export type TableTense = Tense | 'progresivo' | 'perfecto' | 'pluscuamperfecto' | 'imperativo'

/** Tenses stored on every verb, all five persons. */
export const TENSES: Tense[] = ['presente', 'preterito', 'imperfecto', 'futuro', 'subjuntivo', 'subjImperfecto', 'condicional']

/** Conjugation tabs, the drill's tense filter and task ids: indicative, then subjunctive, then imperative. */
export const TABLE_TENSES: TableTense[] = [
  'presente',
  'progresivo',
  'preterito',
  'perfecto',
  'imperfecto',
  'futuro',
  'condicional',
  'pluscuamperfecto',
  'subjuntivo',
  'subjImperfecto',
  'imperativo',
]

export const TENSE_LABELS: Record<TableTense, string> = {
  presente: 'presente',
  progresivo: 'progresivo',
  preterito: 'pretérito',
  perfecto: 'perfecto',
  imperfecto: 'imperfecto',
  futuro: 'futuro',
  condicional: 'condicional',
  pluscuamperfecto: 'pluscuamperfecto',
  subjuntivo: 'subjuntivo',
  subjImperfecto: 'subj. imperfecto',
  imperativo: 'imperativo',
}

/** The level a tense is asked from: "Všetky časy", level tests and the path take the ones up to theirs. */
export const TENSE_LEVEL: Record<TableTense, Level> = {
  presente: 'A1',
  progresivo: 'A1',
  preterito: 'A1',
  perfecto: 'A2',
  imperfecto: 'A1',
  futuro: 'A1',
  imperativo: 'A2',
  condicional: 'B1',
  pluscuamperfecto: 'B1',
  subjuntivo: 'B1',
  subjImperfecto: 'B2',
}

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2']
/** Whether a tense is taught above the level (its drill chip says from which level). */
export const levelAbove = (tense: TableTense, level: Level) => LEVELS.indexOf(TENSE_LEVEL[tense]) > LEVELS.indexOf(level)
export const tensesUpTo = (level?: Level): TableTense[] => (level ? TABLE_TENSES.filter((t) => !levelAbove(t, level)) : TABLE_TENSES)

/** The persons a tense has: the imperative has no yo. */
export const personsOf = (tense: TableTense): Person[] => (tense === 'imperativo' ? IMPERATIVE_PERSONS : PERSONS)

const IMPERATIVE_LABELS: Record<ImperativePerson, string> = { tu: 'tú', el: 'usted', nosotros: 'nosotros', ellos: 'ustedes' }
export const personLabel = (tense: TableTense, person: Person) =>
  tense === 'imperativo' && person !== 'yo' ? IMPERATIVE_LABELS[person] : PERSON_LABELS[person]

/** haber is not a verb of the data: only its presente (perfecto) and imperfecto (pluscuamperfecto) are needed. */
export const HABER_PRESENTE: Record<Person, string> = { yo: 'he', tu: 'has', el: 'ha', nosotros: 'hemos', ellos: 'han' }
export const HABER_IMPERFECTO: Record<Person, string> = { yo: 'había', tu: 'habías', el: 'había', nosotros: 'habíamos', ellos: 'habían' }

const REFLEXIVE_PRONOUN: Record<Person, string> = { yo: 'me', tu: 'te', el: 'se', nosotros: 'nos', ellos: 'se' }

/** A piece of a conjugated form; `irregular` pieces get highlighted in the UI. */
export interface FormPart {
  text: string
  irregular: boolean
}

export function isIrregular(verb: Verb, tense: Tense | 'imperativo', person: Person): boolean {
  const forms = verb.irregularForms ?? []
  return forms.includes(`${tense}.${person}`) || forms.includes(`${tense}.*`)
}

/**
 * Conjugated form split into parts. Progresivo is estar + gerund ("estoy hablando"), pluscuamperfecto
 * haber + participle ("había salido"); reflexive verbs put the pronoun first ("me estoy llamando").
 * The imperative has no yo: callers ask only `personsOf('imperativo')`.
 */
export function conjugate(verb: Verb, tense: TableTense, person: Person, estar: Verb): FormPart[] {
  if (tense === 'imperativo') {
    if (person === 'yo') throw new Error('the imperative has no yo')
    return [{ text: verb.imperativo[person], irregular: isIrregular(verb, tense, person) }]
  }
  if (tense === 'progresivo' || tense === 'perfecto' || tense === 'pluscuamperfecto') {
    const aux = tense === 'progresivo' ? estar.presente[person] : tense === 'perfecto' ? HABER_PRESENTE[person] : HABER_IMPERFECTO[person]
    const [main, irregular] = tense === 'progresivo' ? [verb.gerund, verb.gerundIrregular] : [verb.participle, verb.participleIrregular]
    return [
      { text: verb.reflexive ? `${REFLEXIVE_PRONOUN[person]} ${aux}` : aux, irregular: false },
      { text: main, irregular: Boolean(irregular) },
    ]
  }
  return [{ text: verb[tense][person], irregular: isIrregular(verb, tense, person) }]
}

/** "no tengas", "no te levantes": no + the subjunctive of the same person. */
export function negativeImperative(verb: Verb, person: ImperativePerson): FormPart[] {
  return [
    { text: 'no', irregular: false },
    { text: verb.subjuntivo[person], irregular: isIrregular(verb, 'subjuntivo', person) },
  ]
}

export const formText = (parts: FormPart[]) => parts.map((p) => p.text).join(' ')

const VOSOTROS_AUX: Partial<Record<TableTense, string>> = { progresivo: 'estáis', perfecto: 'habéis', pluscuamperfecto: 'habíais' }

/** The vosotros row of a table (Spain only): derived, see vosotros.ts. The Mexican variant never asks for it. */
export function conjugateVosotros(verb: Verb, tense: TableTense): FormPart[] {
  const aux = VOSOTROS_AUX[tense]
  if (aux) {
    const [main, irregular] = tense === 'progresivo' ? [verb.gerund, verb.gerundIrregular] : [verb.participle, verb.participleIrregular]
    return [
      { text: verb.reflexive ? `os ${aux}` : aux, irregular: false },
      { text: main, irregular: Boolean(irregular) },
    ]
  }
  return [{ text: vosotrosForm(verb, tense as Tense | 'imperativo'), irregular: vosotrosIrregular(verb, tense as Tense | 'imperativo') }]
}

export function negativeVosotros(verb: Verb): FormPart[] {
  const [, form] = vosotrosNegative(verb).split(/ (.+)/)
  return [
    { text: 'no', irregular: false },
    { text: form, irregular: vosotrosIrregular(verb, 'subjuntivo') },
  ]
}

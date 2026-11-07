import { sentences, variant, verbs, words } from '../data'
import { t } from '../i18n'
import type { Level } from '../data/types'
import { levelAbove, PERSON_LABELS, personLabel, PERSONS, TENSE_LABELS, TENSES, type TableTense } from './conjugate'
import { IMPERATIVE_PERSONS } from './verbForms'
import { bareVosotros } from './vosotros'
import { getLanguage, type Language } from './language'
import { wordTranslations } from './localized'

// Every single-word Spanish form in the dataset → its meaning in the learner's language, or its grammar.
// checkAnswer uses it to tell a different real word from a typo or a missing accent.
// A form of a tense is known from that tense's level: on A1, estudiara (subj. imperfecto, B2)
// is not another word but estudiará without its accent.

/** The descriptions of a form, each with the tense whose level it counts from (none: always known) and, for a verb form, its verb. */
type Entry = { description: string; tense?: TableTense; verb?: string }

const indexes = new Map<Language, Map<string, Entry[]>>()

function buildIndex(): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  const add = (form: string, description: string, tense?: TableTense, verb?: string) => {
    const key = form.toLowerCase()
    if (key.includes(' ')) return
    const entries = map.get(key) ?? []
    entries.push({ description, tense, verb })
    map.set(key, entries)
  }

  for (const w of words) {
    if (w.pos === 'verb') continue // verbs are described per form below
    const meaning = wordTranslations(w)[0]
    add(w.es, meaning)
    if (w.plural) add(w.plural, meaning)
    if (w.feminine) add(w.feminine, meaning)
  }
  for (const v of verbs) {
    for (const tense of TENSES) {
      for (const person of PERSONS) {
        // Reflexive forms carry the pronoun ("me llamo"): index the verb itself.
        const form = v[tense][person].split(' ').at(-1)!
        add(form, `${v.id} · ${PERSON_LABELS[person]} · ${TENSE_LABELS[tense]}`, tense, v.id)
      }
    }
    for (const person of IMPERATIVE_PERSONS) add(v.imperativo[person], `${v.id} · ${personLabel('imperativo', person)} · ${TENSE_LABELS.imperativo}`, 'imperativo', v.id)
    // Spain: vosotros is a person of its own (habláis for hablan is another form, not a typo).
    if (variant === 'es') {
      for (const tense of TENSES) add(bareVosotros(v, tense), `${v.id} · vosotros · ${TENSE_LABELS[tense]}`, tense, v.id)
      add(bareVosotros(v, 'imperativo'), `${v.id} · vosotros · ${TENSE_LABELS.imperativo}`, 'imperativo', v.id)
    }
    add(v.gerund, `${v.id} · gerundio`, undefined, v.id)
    add(v.participle, `${v.id} · participio`, 'pluscuamperfecto', v.id)
  }
  // Remaining words from sentences are known, just without a description.
  for (const s of sentences) for (const token of s.tokens) add(token, '')

  return map
}

function indexOfLanguage(): Map<string, Entry[]> {
  const language = getLanguage()
  let index = indexes.get(language)
  if (!index) indexes.set(language, (index = buildIndex()))
  return index
}

/** Description of a known form ('' if known without one), undefined if unknown. With `level`, only forms of tenses taught up to it count. */
export function lookupForm(word: string, level?: Level): string | undefined {
  const entries = indexOfLanguage().get(word.toLowerCase())?.filter((e) => !level || !e.tense || !levelAbove(e.tense, level))
  if (!entries?.length) return undefined
  return [...new Set(entries.map((e) => e.description).filter(Boolean))].join(` ${t().lesson.or} `)
}

/** lookupForm limited to the tenses of a level, for checkAnswer. */
export const lookupUpTo = (level?: Level) => (word: string) => lookupForm(word, level)

/** The verb a conjugated form belongs to (tengo → tener); undefined for anything else. */
export function lookupVerb(word: string): string | undefined {
  return indexOfLanguage()
    .get(word.toLowerCase())
    ?.find((e) => e.verb)?.verb
}

/** Every known single-word form, lowercase (the diary's suggestions are drawn from them). */
export const allKnownForms = (): Iterable<string> => indexOfLanguage().keys()

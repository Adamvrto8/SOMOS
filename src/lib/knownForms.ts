import { sentences, verbs, words } from '../data'
import { t } from '../i18n'
import type { Level } from '../data/types'
import { levelAbove, PERSON_LABELS, personLabel, PERSONS, TENSE_LABELS, TENSES, type TableTense } from './conjugate'
import { IMPERATIVE_PERSONS } from './verbForms'
import { getLanguage, type Language } from './language'
import { wordTranslations } from './localized'

// Every single-word Spanish form in the dataset → its meaning in the learner's language, or its grammar.
// checkAnswer uses it to tell a different real word from a typo or a missing accent.
// A form of a tense is known from that tense's level: on A1, estudiara (subj. imperfecto, B2)
// is not another word but estudiará without its accent.

/** The descriptions of a form, each with the tense whose level it counts from (none: always known). */
type Entry = { description: string; tense?: TableTense }

const indexes = new Map<Language, Map<string, Entry[]>>()

function buildIndex(): Map<string, Entry[]> {
  const map = new Map<string, Entry[]>()
  const add = (form: string, description: string, tense?: TableTense) => {
    const key = form.toLowerCase()
    if (key.includes(' ')) return
    const entries = map.get(key) ?? []
    entries.push({ description, tense })
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
        add(form, `${v.id} · ${PERSON_LABELS[person]} · ${TENSE_LABELS[tense]}`, tense)
      }
    }
    for (const person of IMPERATIVE_PERSONS) add(v.imperativo[person], `${v.id} · ${personLabel('imperativo', person)} · ${TENSE_LABELS.imperativo}`, 'imperativo')
    add(v.gerund, `${v.id} · gerundio`)
    add(v.participle, `${v.id} · participio`, 'pluscuamperfecto')
  }
  // Remaining words from sentences are known, just without a description.
  for (const s of sentences) for (const token of s.tokens) add(token, '')

  return map
}

/** Description of a known form ('' if known without one), undefined if unknown. With `level`, only forms of tenses taught up to it count. */
export function lookupForm(word: string, level?: Level): string | undefined {
  const language = getLanguage()
  let index = indexes.get(language)
  if (!index) indexes.set(language, (index = buildIndex()))
  const entries = index.get(word.toLowerCase())?.filter((e) => !level || !e.tense || !levelAbove(e.tense, level))
  if (!entries?.length) return undefined
  return [...new Set(entries.map((e) => e.description).filter(Boolean))].join(` ${t().lesson.or} `)
}

/** lookupForm limited to the tenses of a level, for checkAnswer. */
export const lookupUpTo = (level?: Level) => (word: string) => lookupForm(word, level)

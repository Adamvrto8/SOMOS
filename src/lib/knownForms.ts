import { sentences, verbs, words } from '../data'
import { t } from '../i18n'
import { PERSON_LABELS, PERSONS, TENSE_LABELS, TENSES } from './conjugate'
import { getLanguage, type Language } from './language'
import { wordTranslations } from './localized'

// Every single-word Spanish form in the dataset → its meaning in the learner's language, or its grammar.
// checkAnswer uses it to tell a different real word from a typo or a missing accent.

const indexes = new Map<Language, Map<string, Set<string>>>()

function buildIndex(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  const add = (form: string, description: string) => {
    const key = form.toLowerCase()
    if (key.includes(' ')) return
    const set = map.get(key) ?? new Set<string>()
    if (description) set.add(description)
    map.set(key, set)
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
        add(form, `${v.id} · ${PERSON_LABELS[person]} · ${TENSE_LABELS[tense]}`)
      }
    }
    add(v.gerund, `${v.id} · gerundio`)
  }
  // Remaining words from sentences are known, just without a description.
  for (const s of sentences) for (const token of s.tokens) add(token, '')

  return map
}

/** Description of a known form ('' if known without one), undefined if unknown. */
export function lookupForm(word: string): string | undefined {
  const language = getLanguage()
  let index = indexes.get(language)
  if (!index) indexes.set(language, (index = buildIndex()))
  const descriptions = index.get(word.toLowerCase())
  return descriptions ? [...descriptions].join(` ${t().lesson.or} `) : undefined
}

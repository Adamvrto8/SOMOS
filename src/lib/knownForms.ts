import { sentences, verbs, words } from '../data'
import { PERSON_LABELS, PERSONS, TENSE_LABELS, TENSES } from './conjugate'

// Every single-word Spanish form in the dataset → short Slovak/grammar description.
// checkAnswer uses it to tell a different real word from a typo or a missing accent.

let index: Map<string, Set<string>> | undefined

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
    add(w.es, w.sk[0])
    if (w.plural) add(w.plural, w.sk[0])
    if (w.feminine) add(w.feminine, w.sk[0])
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
  index ??= buildIndex()
  const descriptions = index.get(word.toLowerCase())
  return descriptions ? [...descriptions].join(' alebo ') : undefined
}

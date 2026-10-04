import MiniSearch from 'minisearch'
import { verbById, wordById, words } from '../data'
import type { Word } from '../data/types'
import { TENSES } from './conjugate'
import { getLanguage, type Language } from './language'
import { wordTranslations } from './localized'
import { compareEs, fold } from './text'

export type SearchFilter = 'all' | 'verb' | 'noun' | 'phrase'

export interface WordHit {
  word: Word
  /** Set when only a conjugated form matched, e.g. "fui" → ser / ir. */
  matchedForm?: string
}

interface SearchDoc {
  id: string
  es: string
  native: string // the translations in the learner's language
  forms: string
}

const MAX_RESULTS = 50

// Conjugated forms without reflexive pronouns ("me llamo" → "llamo").
function verbForms(word: Word): string[] {
  const verb = word.verbId ? verbById.get(word.verbId) : undefined
  if (!verb) return []
  const forms = [...TENSES.flatMap((t) => Object.values(verb[t])), verb.gerund]
  return [...new Set(forms.map((f) => f.split(' ').at(-1)!))]
}

let index: MiniSearch<SearchDoc> | undefined
let indexLanguage: Language | undefined

// Built lazily on the first search, and again after the language changed.
function getIndex(): MiniSearch<SearchDoc> {
  const language = getLanguage()
  if (index && indexLanguage === language) return index
  indexLanguage = language
  index = new MiniSearch<SearchDoc>({
    fields: ['es', 'native', 'forms'],
    processTerm: (term) => fold(term) || null,
    searchOptions: {
      boost: { es: 3, native: 3 },
      prefix: true,
      fuzzy: (term) => (term.length >= 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  })
  index.addAll(
    words.map((w) => ({
      id: w.id,
      es: [w.es, w.plural, w.feminine].filter(Boolean).join(' '),
      native: wordTranslations(w).join(' '),
      forms: verbForms(w).join(' '),
    })),
  )
  return index
}

const matchesFilter = (word: Word, filter: SearchFilter) => filter === 'all' || word.pos === filter

const byEs = (a: Word, b: Word) => compareEs(a.es.replace(/[¿?¡!]/g, ''), b.es.replace(/[¿?¡!]/g, ''))

// Exact matches rank first; a literal match ("byt" → byt) beats a folded one ("byt" → byť).
function exactness(word: Word, raw: string, folded: string): number {
  const candidates = [word.es.replace(/[¿?¡!]/g, ''), ...wordTranslations(word)]
  if (candidates.some((c) => c.toLowerCase() === raw)) return 3
  if (candidates.some((c) => fold(c) === folded)) return 2
  if (verbForms(word).some((f) => fold(f) === folded)) return 1
  return 0
}

export function searchWords(query: string, filter: SearchFilter): WordHit[] {
  const raw = query.trim().toLowerCase()
  if (!raw) {
    // No query: a filter alone lists the whole category.
    if (filter === 'all') return []
    return words.filter((w) => matchesFilter(w, filter)).sort(byEs).map((word) => ({ word }))
  }

  const folded = fold(raw)
  const hits = getIndex()
    .search(raw)
    .flatMap((result) => {
      const word = wordById.get(result.id as string)
      if (!word || !matchesFilter(word, filter)) return []
      const fields = new Set(Object.values(result.match).flat())
      const matchedForm =
        fields.has('es') || fields.has('native') ? undefined : verbForms(word).find((f) => result.terms.includes(fold(f)))
      return [{ word, matchedForm, score: result.score, exact: exactness(word, raw, folded) }]
    })

  hits.sort((a, b) => b.exact - a.exact || b.score - a.score)
  return hits.slice(0, MAX_RESULTS).map(({ word, matchedForm }) => ({ word, matchedForm }))
}

export function wordsInTopic(topicId: string): Word[] {
  return words.filter((w) => w.topics.includes(topicId)).sort(byEs)
}

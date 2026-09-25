import type { PartOfSpeech, Word } from '../data/types'

export const POS_LABELS: Record<PartOfSpeech, string> = {
  noun: 'podstatné meno',
  verb: 'sloveso',
  adj: 'prídavné meno',
  adv: 'príslovka',
  prep: 'predložka',
  pron: 'zámeno',
  conj: 'spojka',
  phrase: 'fráza',
  other: 'iné',
}

export const GENDER_LABELS = { m: 'mužský rod', f: 'ženský rod' } as const

// Feminine nouns starting with a stressed a-/ha- take "el" in the singular: el agua.
const EL_FEMININE = new Set(['agua', 'águila', 'ala', 'alma', 'ancla', 'área', 'arma', 'arpa', 'aula', 'ave', 'habla', 'hacha', 'hada', 'hambre'])

// Nouns used only in the plural.
const PLURAL_ONLY = new Set(['vacaciones'])

/** Definite article shown before a noun: "la casa", "el agua", "las vacaciones". */
export function articleFor(word: Word): string | undefined {
  if (word.pos !== 'noun' || !word.gender) return undefined
  if (PLURAL_ONLY.has(word.es)) return word.gender === 'm' ? 'los' : 'las'
  if (word.gender === 'm' || EL_FEMININE.has(word.es)) return 'el'
  return 'la'
}

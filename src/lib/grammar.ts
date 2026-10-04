import type { Word } from '../data/types'

// Feminine nouns starting with a stressed a-/ha- take "el" in the singular: el agua.
const EL_FEMININE = new Set(['agua', 'águila', 'ala', 'alma', 'ancla', 'área', 'arma', 'arpa', 'aula', 'ave', 'habla', 'hacha', 'hada', 'hambre'])

// Nouns used only in the plural.
const PLURAL_ONLY = new Set(['ganas', 'lentes', 'matemáticas', 'papás', 'tenis', 'vacaciones'])

/** Definite article shown before a noun: "la casa", "el agua", "las vacaciones". */
export function articleFor(word: Word): string | undefined {
  if (word.pos !== 'noun' || !word.gender) return undefined
  if (PLURAL_ONLY.has(word.es)) return word.gender === 'm' ? 'los' : 'las'
  if (word.gender === 'm' || EL_FEMININE.has(word.es)) return 'el'
  return 'la'
}

import { words } from '../data'
import type { Word } from '../data/types'
import { dayKey } from './dates'

// Content words with an example sentence make a good "word of the day".
const CANDIDATES = words.filter((w) => ['noun', 'verb', 'adj', 'adv', 'phrase'].includes(w.pos) && w.examples.length > 0)

/** FNV-1a: spreads consecutive dates across the list instead of walking it in order. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Same word all day, a different one tomorrow. */
export function wordOfDay(date = new Date()): Word {
  return CANDIDATES[hash(dayKey(date)) % CANDIDATES.length]
}

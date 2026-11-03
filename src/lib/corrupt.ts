import type { Cloze, Sentence } from '../data/types'
import { spaceBefore } from './text'

// A sentence with one wrong word: the answer of a blank swapped for one of its distractors. "Wrong" means the
// Spanish no longer says what the Slovak translation says (spec 2026-11-03-new-exercise-types-design.md §2).

export interface Corrupted {
  tokens: string[] // the sentence with the swapped word
  index: number // the token that was swapped
  wrong: string // what stands there now
  right: string // the original token
  es: string // the corrupted sentence as text
}

export const stableHash = (text: string): number => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** The sentence text from its tokens: no space before .,?! and none after ¿¡. */
export const rebuild = (tokens: string[]): string => tokens.map((t, i) => (spaceBefore(tokens, i) ? ' ' : '') + t).join('')

/** Distractors that can stand in the answer's place: one word, and not the answer itself. */
export function swappableDistractors(cloze: Cloze): number[] {
  const out: number[] = []
  ;(cloze.distractors ?? []).forEach((d, i) => {
    if (!/\s/.test(d) && d.toLowerCase() !== cloze.answer.toLowerCase()) out.push(i)
  })
  return out
}

/** Blanks that can be corrupted: two swappable distractors, in a sentence without a digit. */
export function eligibleClozes(sentence: Sentence): number[] {
  if (/\d/.test(sentence.es)) return []
  return (sentence.cloze ?? []).flatMap((cloze, index) => (swappableDistractors(cloze).length >= 2 ? [index] : []))
}

/** One of the swappable distractors, chosen by `r` in [0, 1). */
export function distractorFor(sentence: Sentence, clozeIndex: number, r: number): number | undefined {
  const cloze = sentence.cloze?.[clozeIndex]
  if (!cloze) return undefined
  const options = swappableDistractors(cloze)
  return options[Math.min(options.length - 1, Math.floor(r * options.length))]
}

/** A capital stays in a capital slot: the sentence-initial blank. */
export function matchCapital(right: string, word: string): string {
  return /^\p{Lu}/u.test(right) && /^\p{Ll}/u.test(word) ? word.charAt(0).toUpperCase() + word.slice(1) : word
}

export function corrupt(sentence: Sentence, clozeIndex: number, distractorIndex: number): Corrupted | undefined {
  const cloze = sentence.cloze?.[clozeIndex]
  if (!cloze || !swappableDistractors(cloze).includes(distractorIndex)) return undefined
  const right = sentence.tokens[cloze.tokenIndex]
  const wrong = matchCapital(right, cloze.distractors![distractorIndex])
  const tokens = sentence.tokens.map((token, i) => (i === cloze.tokenIndex ? wrong : token))
  return { tokens, index: cloze.tokenIndex, wrong, right, es: rebuild(tokens) }
}

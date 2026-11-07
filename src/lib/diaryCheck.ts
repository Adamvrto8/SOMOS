import { wordIdByVerb, words } from '../data'
import { allKnownForms, lookupForm, lookupVerb } from './knownForms'
import { fold } from './text'

// The check under "Po španielsky" in the diary: every word looked up in the dataset's forms and the learner's
// own words. Offline and cheap; a real word in the wrong place (esta for está) is not caught, only grammar could.

export type DiarySegment = { text: string } | { text: string; word: true; known: boolean; suggestions: string[]; href?: string }

const WORD = /\p{L}+(?:['’-]\p{L}+)*/gu
/** Text before a word that ends a sentence (or nothing at all): the word may start with a capital without being a name. */
const SENTENCE_END = /(^|[.!?¡¿\n])[\s"'«»()—-]*$/

let folded: Map<string, string[]> | undefined
/** Known forms by their spelling without accents and ñ: "manana" → ["mañana"]. Built once, on the first check. */
function foldedIndex(): Map<string, string[]> {
  if (folded) return folded
  folded = new Map()
  for (const form of allKnownForms()) {
    const key = fold(form)
    if (key === form) continue // nothing to restore
    const list = folded.get(key) ?? []
    list.push(form)
    folded.set(key, list)
  }
  return folded
}

const wordIdByEs = new Map(words.map((w) => [w.es.toLowerCase(), w.id]))

/** The text split into words and what lies between them, each word checked. Joining the texts gives `text` back. */
export function checkDiary(text: string, customWords: readonly string[] = []): DiarySegment[] {
  const custom = new Set(customWords.map((w) => w.toLowerCase()))
  const out: DiarySegment[] = []
  let at = 0
  for (const match of text.matchAll(WORD)) {
    const start = match.index
    if (start > at) out.push({ text: text.slice(at, start) })
    const word = match[0]
    const lower = word.toLowerCase()
    const sentenceStart = SENTENCE_END.test(text.slice(0, start))
    const name = !sentenceStart && word[0] !== word[0].toLowerCase()
    const known = name || custom.has(lower) || lookupForm(lower) !== undefined
    const verb = known ? lookupVerb(lower) : undefined
    const id = known ? (wordIdByEs.get(lower) ?? (verb ? wordIdByVerb.get(verb) : undefined)) : undefined
    out.push({
      text: word,
      word: true,
      known,
      suggestions: known ? [] : (foldedIndex().get(fold(word)) ?? []).slice(0, 2),
      href: id ? `/word/${id}` : undefined,
    })
    at = start + word.length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}

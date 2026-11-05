import type { Cloze, Example, Sentence, Word } from './types.ts'

// The es-ES overlay (Spain) over the Mexican base data, matched by id. The base stays the single source of truth:
// an overlay entry lists only what differs. Ids never change, so progress carries over when the variant is switched.
export type Variant = 'mx' | 'es'

export interface WordEs {
  id: string
  es?: string
  plural?: string
  feminine?: string
  gender?: 'm' | 'f'
  examples?: Example[]
  /** Not taught in Spain (a Mexican verb, mariachi): left out of the words, and its verb too. */
  hidden?: boolean
  /** `null` removes the Mexican note (it would be wrong for Spain); a string replaces it. */
  note?: string | null
}

export interface ClozeEs {
  tokenIndex: number // of the Mexican sentence: names the blank
  newIndex?: number // where it sits in the Spain sentence, when the words before it changed in number
  answer: string
  lemma?: string
  hint?: string
  distractors?: string[]
}

export interface SentenceEs {
  id: string
  es: string
  tokens: string[]
  cloze?: ClozeEs[]
}

/** The verb ids whose Word the overlay hides (a word with `verbId` is its verb's dictionary entry). */
export const hiddenVerbIds = (base: Word[], overlay: WordEs[]): Set<string> =>
  new Set(overlay.filter((o) => o.hidden).flatMap((o) => base.find((w) => w.id === o.id)?.verbId ?? []))

export function applyWords(base: Word[], overlay: WordEs[]): Word[] {
  const byId = new Map(overlay.map((o) => [o.id, o]))
  return base.filter((word) => !byId.get(word.id)?.hidden).map((word) => {
    const o = byId.get(word.id)
    if (!o) return word
    const { note, hidden: _hidden, ...rest } = o
    const merged: Word = { ...word, ...stripUndefined(rest) }
    if (note === null) delete merged.note
    else if (note !== undefined) merged.note = note
    return merged
  })
}

export function applySentences(base: Sentence[], overlay: SentenceEs[]): Sentence[] {
  const byId = new Map(overlay.map((o) => [o.id, o]))
  return base.map((sentence) => {
    const o = byId.get(sentence.id)
    if (!o) return sentence
    const cloze: Cloze[] | undefined = sentence.cloze?.map((c) => {
      const patch = o.cloze?.find((p) => p.tokenIndex === c.tokenIndex)
      if (!patch) return c
      const { newIndex, ...rest } = patch
      return { ...c, ...stripUndefined(rest), tokenIndex: newIndex ?? patch.tokenIndex }
    })
    return { ...sentence, es: o.es, tokens: o.tokens, ...(cloze ? { cloze } : {}) }
  })
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

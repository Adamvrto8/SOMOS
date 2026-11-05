import type { Cloze, Example, Sentence, Word } from './types'

// The es-ES overlay (Spain) over the Mexican base data, matched by id. The base stays the single source of truth:
// an overlay entry lists only what differs. Ids never change, so progress carries over when the variant is switched.
export type Variant = 'mx' | 'es'

export interface WordEs {
  id: string
  es?: string
  plural?: string
  feminine?: string
  examples?: Example[]
  /** `null` removes the Mexican note (it would be wrong for Spain); a string replaces it. */
  note?: string | null
}

export interface ClozeEs {
  tokenIndex: number
  answer: string
  distractors?: string[]
}

export interface SentenceEs {
  id: string
  es: string
  tokens: string[]
  cloze?: ClozeEs[]
}

export function applyWords(base: Word[], overlay: WordEs[]): Word[] {
  const byId = new Map(overlay.map((o) => [o.id, o]))
  return base.map((word) => {
    const o = byId.get(word.id)
    if (!o) return word
    const { note, ...rest } = o
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
      return patch ? { ...c, ...stripUndefined(patch) } : c
    })
    return { ...sentence, es: o.es, tokens: o.tokens, ...(cloze ? { cloze } : {}) }
  })
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

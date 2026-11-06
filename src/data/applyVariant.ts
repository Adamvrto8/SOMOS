import type { Cloze, Example, Sentence, Tip, TipEn, Word } from './types.ts'

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

/**
 * A tip as Spain needs it: Mexican examples (carro, Oxxo, pesos) and texts that speak of Mexico, rewritten.
 * Rules are named by id and keep their order; `examples` has one entry per example of the base rule, null keeps it.
 */
export interface TipEs {
  id: string
  intro?: string
  rules?: { id: string; text?: string; examples?: (Example | null)[] }[]
  /** The same for the English tip (src/data/en/tips.json): its texts, and the translations of changed examples. */
  en?: { intro?: string; rules?: { id: string; text?: string; examples?: (string | null)[] }[] }
}

interface TipPatch<E> {
  intro?: string
  rules?: { id: string; text?: string; examples?: (E | null)[] }[]
}

function patchTip<E, T extends { intro: string; rules: { id: string; text?: string; examples: E[] }[] }>(tip: T, o: TipPatch<E> | undefined): T {
  if (!o) return tip
  const rules = tip.rules.map((rule) => {
    const patch = o.rules?.find((r) => r.id === rule.id)
    if (!patch) return rule
    const text = patch.text !== undefined ? { text: patch.text } : {}
    return { ...rule, ...text, examples: rule.examples.map((example, i) => patch.examples?.[i] ?? example) }
  })
  return { ...tip, ...(o.intro !== undefined ? { intro: o.intro } : {}), rules }
}

export const applyTips = (base: Tip[], overlay: TipEs[]): Tip[] => base.map((tip) => patchTip(tip, overlay.find((o) => o.id === tip.id)))

export const applyTipsEn = (base: TipEn[], overlay: TipEs[]): TipEn[] => base.map((tip) => patchTip(tip, overlay.find((o) => o.id === tip.id)?.en))

/** Spain's own verbs (src/data/es/new) and the Mexican word each stands for, which Spain hides: word ids. */
export const SPAIN_VERB_PAIRS: Record<string, string> = {
  conducir: 'manejar',
  alquilar: 'rentar',
  aparcar: 'estacionar',
  charlar: 'platicar',
  enfadarse: 'enojarse',
  encender: 'prender',
}

/**
 * The other variant's Spanish for a word, so the search finds it too: in Spain "carro" leads to coche,
 * in Mexico "coche" to carro. Word id → the forms to index. `newWords` are Spain's own (es/new/words).
 */
export function otherVariantForms(variant: Variant, base: Word[], overlay: WordEs[], newWords: Word[]): Map<string, string[]> {
  const forms = new Map<string, string[]>()
  const add = (id: string, ...values: (string | undefined)[]) => {
    const list = values.filter((v): v is string => Boolean(v))
    if (list.length) forms.set(id, [...new Set([...(forms.get(id) ?? []), ...list])])
  }
  const baseById = new Map(base.map((w) => [w.id, w]))
  for (const o of overlay) {
    const w = baseById.get(o.id)
    if (!w || o.hidden || o.es === undefined || o.es === w.es) continue
    if (variant === 'es') add(w.id, w.es, w.plural !== o.plural ? w.plural : undefined)
    else add(w.id, o.es, o.plural !== w.plural ? o.plural : undefined)
  }
  for (const [spain, mexico] of Object.entries(SPAIN_VERB_PAIRS)) {
    if (variant === 'es') add(spain, baseById.get(mexico)?.es)
    else add(mexico, newWords.find((w) => w.id === spain)?.es)
  }
  // regresar is hidden in Spain, where volver says it (Mexico has volver too, so only this way).
  if (variant === 'es' && baseById.has('volver')) add('volver', baseById.get('regresar')?.es)
  return forms
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}

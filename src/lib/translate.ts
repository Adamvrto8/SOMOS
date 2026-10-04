import { db, type Lookup } from './db'
import { lookupForm } from './knownForms'
import { getLanguage } from './language'

// Online lookup for words outside the dataset: POST /api/translate (Vercel function → DeepL).
// Results are cached in IndexedDB, so a repeated lookup costs nothing and works offline.

/** Spanish, or the learner's language: a lookup always has Spanish on one side. */
export type Lang = 'sk' | 'en' | 'es'

/** The other side of a lookup that starts from `from`. */
export const targetOf = (from: Lang): Lang => (from === 'es' ? getLanguage() : 'es')

export type TranslateError = 'offline' | 'unavailable' | 'not-configured' | 'quota' | 'failed'

const TRANSLATE_ERROR_CODES: TranslateError[] = ['offline', 'unavailable', 'not-configured', 'quota', 'failed']

/** Same limit as the server (api/translate.ts). */
export const MAX_TRANSLATE_CHARS = 120

export class TranslateFailure extends Error {
  code: TranslateError
  constructor(code: TranslateError) {
    super(code)
    this.code = code
  }
}

const isTranslateError = (value: unknown): value is TranslateError => TRANSLATE_ERROR_CODES.includes(value as TranslateError)

// Accents stay in the key: "papa" and "papá" are different words.
// The Slovak pair keeps its old key ("sk:…", "es:…"), so what is cached stays; the English pair names both sides.
const lookupKey = (text: string, from: Lang) => {
  const to = targetOf(from)
  const pair = from === 'sk' || to === 'sk' ? from : `${from}>${to}`
  return `${pair}:${text.trim().toLowerCase().replace(/\s+/g, ' ')}`
}

export function cachedTranslation(text: string, from: Lang): Promise<Lookup | undefined> {
  return db.lookups.get(lookupKey(text, from))
}

export async function translateOnline(text: string, from: Lang): Promise<Lookup> {
  const key = lookupKey(text, from)
  const cached = await db.lookups.get(key)
  if (cached) return cached
  if (!navigator.onLine) throw new TranslateFailure('offline')

  let res: Response
  try {
    res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim(), from, to: targetOf(from) }),
    })
  } catch {
    throw new TranslateFailure('offline')
  }
  // The Vite dev server has no /api: only the Vercel deployment does.
  if (res.status === 404) throw new TranslateFailure('unavailable')
  const data = (await res.json().catch(() => ({}))) as { translation?: string; error?: string }
  if (!res.ok || !data.translation) throw new TranslateFailure(isTranslateError(data.error) ? data.error : 'failed')

  const lookup: Lookup = { key, text: text.trim(), from, translation: data.translation, at: Date.now() }
  await db.lookups.put(lookup)
  return lookup
}

const SPANISH_LETTERS = /[ñ¿¡ü]/
const SLOVAK_LETTERS = /[äôľĺŕčďťžšňý]/
// Spanish-looking endings: -ción, -dad, -mente and infinitives (regresar, subirse).
const SPANISH_ENDING = /(ción|sión|dad|mente|[aei]r(se)?)$/
const SPANISH_ENDING_NOT_ENGLISH = /(ción|sión|mente|[aei]rse)$/

/** Best guess of the query's language, so the lookup button points the right way; the learner can switch. */
export function guessLang(text: string): Lang {
  const t = text.trim().toLowerCase()
  if (SPANISH_LETTERS.test(t)) return 'es'
  const native = getLanguage()
  if (native === 'sk' && SLOVAK_LETTERS.test(t)) return 'sk'
  const words = t.split(/\s+/).filter(Boolean)
  const known = words.filter((w) => lookupForm(w) !== undefined).length
  if (known > words.length / 2) return 'es'
  // English is full of words that end like a Spanish infinitive or noun (seller, car, dad).
  const ending = native === 'en' ? SPANISH_ENDING_NOT_ENGLISH : SPANISH_ENDING
  return words.some((w) => ending.test(w)) ? 'es' : native
}

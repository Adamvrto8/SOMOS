import { fold } from './text'

// Tolerant answer checking (CLAUDE.md §4).

export type Verdict = 'correct' | 'accent' | 'typo' | 'wrong'

export interface CheckOptions {
  /**
   * Known Spanish word → short description ('' when known without one). Tells a real
   * different word ("hablo" for "habló", "hablas" for "hablan") apart from a slip.
   */
  lookup?: (word: string) => string | undefined
  /** Accept a leading subject pronoun the expected answer lacks ("Yo hablo…" for "Hablo…"). */
  optionalSubject?: boolean
}

export interface CheckResult {
  verdict: Verdict
  /** The expected answer that matched best, as written in the data. */
  expected: string
  /** Expected words the answer got right except for accents (shown as a warning). */
  accentWords: string[]
  /** Expected word with the single forgiven typo. */
  typoWord?: string
  /** Why an accent-only difference is wrong: the learner's word and the expected one, each glossed. */
  meanings?: Meaning[]
}

export interface Meaning {
  word: string
  gloss: string // "táto", "hablar · yo · presente"
}

// Words whose accent changes the meaning, with a short Slovak gloss.
const MEANING_PAIRS: Record<string, string> = {
  esta: 'táto',
  está: 'je (estar)',
  estas: 'tieto',
  estás: 'si (estar)',
  el: 'ten (člen)',
  él: 'on',
  tu: 'tvoj',
  tú: 'ty',
  si: 'ak',
  sí: 'áno',
  mas: 'ale (knižne)',
  más: 'viac',
  se: 'sa / si',
  sé: 'viem',
  te: 'ťa / ti',
  té: 'čaj',
  de: 'z / od',
  dé: 'nech dá',
  mi: 'môj',
  mí: 'mne / mňa',
  que: 'že / ktorý',
  qué: 'čo? / aký?',
  como: 'ako / jem',
  cómo: 'ako? (otázka)',
  donde: 'kde (vo vete)',
  dónde: 'kde? (otázka)',
  cuando: 'keď',
  cuándo: 'kedy? (otázka)',
  quien: 'ktorý (vo vete)',
  quién: 'kto? (otázka)',
  cual: 'ktorý (vo vete)',
  cuál: 'ktorý? (otázka)',
  cuanto: 'koľko (vo vete)',
  cuánto: 'koľko? (otázka)',
  aun: 'dokonca',
  aún: 'ešte',
  ano: 'konečník',
  año: 'rok',
}

const SUBJECT_PRONOUNS = new Set(['yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'ellos', 'ellas', 'ustedes'])

const MIN_TYPO_LENGTH = 5

const RANK: Record<Verdict, number> = { correct: 0, accent: 1, typo: 2, wrong: 3 }

/** Lowercased words without punctuation: "¿Cómo  estás?" → ["cómo", "estás"]. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[¿?¡!.,;:"“”„«»—–]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = row
  }
  return prev[b.length]
}

/** For words that differ only in accents: both meanings if they are different words, else undefined. */
function meaningChange(got: string, want: string, lookup?: CheckOptions['lookup']): Meaning[] | undefined {
  if (MEANING_PAIRS[got] && MEANING_PAIRS[want]) {
    return [
      { word: got, gloss: MEANING_PAIRS[got] },
      { word: want, gloss: MEANING_PAIRS[want] },
    ]
  }
  const gotGloss = lookup?.(got)
  if (gotGloss === undefined) return undefined
  const wantGloss = lookup?.(want)
  return [{ word: got, gloss: gotGloss || 'iné slovo' }, ...(wantGloss ? [{ word: want, gloss: wantGloss }] : [])]
}

function compare(input: string, expected: string, options: CheckOptions): CheckResult {
  const result: CheckResult = { verdict: 'wrong', expected, accentWords: [] }
  const got = words(input)
  const want = words(expected)

  if (options.optionalSubject && got.length === want.length + 1 && SUBJECT_PRONOUNS.has(got[0]) && !SUBJECT_PRONOUNS.has(want[0])) {
    got.shift()
  }
  if (got.length === 0 || got.length !== want.length) return result

  const typos: string[] = []
  for (let i = 0; i < want.length; i++) {
    const a = got[i]
    const e = want[i]
    if (a === e) continue

    if (fold(a) === fold(e)) {
      const meanings = meaningChange(a, e, options.lookup)
      if (meanings) return { ...result, meanings }
      result.accentWords.push(e)
      continue
    }

    // A slip of one letter in a longer word, unless the answer is another real word.
    const isOtherWord = options.lookup?.(a) !== undefined
    if (e.length >= MIN_TYPO_LENGTH && !isOtherWord && levenshtein(fold(a), fold(e)) === 1) {
      typos.push(e)
      continue
    }
    return result
  }

  // Only one typo is forgiven per answer.
  if (typos.length > 1) return result
  if (typos.length === 1) return { ...result, verdict: 'typo', typoWord: typos[0] }
  return { ...result, verdict: result.accentWords.length ? 'accent' : 'correct' }
}

export function checkAnswer(input: string, expected: string | string[], options: CheckOptions = {}): CheckResult {
  const candidates = Array.isArray(expected) ? expected : [expected]
  return candidates
    .map((candidate) => compare(input, candidate, options))
    .reduce((best, r) => (RANK[r.verdict] < RANK[best.verdict] ? r : best))
}

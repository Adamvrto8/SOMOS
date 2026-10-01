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
  /** The forgiven typo is a missing or an extra space. */
  spacing?: true
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

const PUNCTUATION = /[¿?¡!.,;:"“”„«»—–]/g

/** Lowercased words without punctuation: "¿Cómo  estás?" → ["cómo", "estás"]. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(PUNCTUATION, ' ')
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

type WordMatch =
  | { kind: 'same' | 'accent' | 'typo' | 'other' }
  | { kind: 'meaning'; meanings: Meaning[] } // accent-only difference to another word

/** How one typed word (lowercased) compares to the expected one. */
function matchWord(a: string, e: string, options: CheckOptions): WordMatch {
  if (a === e) return { kind: 'same' }
  if (fold(a) === fold(e)) {
    const meanings = meaningChange(a, e, options.lookup)
    return meanings ? { kind: 'meaning', meanings } : { kind: 'accent' }
  }
  // A slip of one letter in a longer word, unless the answer is another real word.
  const isOtherWord = options.lookup?.(a) !== undefined
  if (e.length >= MIN_TYPO_LENGTH && !isOtherWord && levenshtein(fold(a), fold(e)) === 1) return { kind: 'typo' }
  return { kind: 'other' }
}

const hasExtraSubject = (got: string[], want: string[]) => SUBJECT_PRONOUNS.has(got[0]) && !SUBJECT_PRONOUNS.has(want[0])

/** The same letters with a space missing or added ("nieje" for "nie je"), not another real word ("porque" for "por qué"). */
function isSpacingSlip(got: string[], want: string[], lookup?: CheckOptions['lookup']): boolean {
  if (fold(got.join('')) !== fold(want.join(''))) return false
  return got.every((word) => want.includes(word) || lookup?.(word) === undefined)
}

function compare(input: string, expected: string, options: CheckOptions): CheckResult {
  const result: CheckResult = { verdict: 'wrong', expected, accentWords: [] }
  const got = words(input)
  const want = words(expected)

  if (options.optionalSubject && got.length === want.length + 1 && hasExtraSubject(got, want)) got.shift()
  if (got.length === 0) return result
  if (got.length !== want.length) return isSpacingSlip(got, want, options.lookup) ? { ...result, verdict: 'typo', spacing: true } : result

  const typos: string[] = []
  for (let i = 0; i < want.length; i++) {
    const match = matchWord(got[i], want[i], options)
    if (match.kind === 'same') continue
    if (match.kind === 'accent') result.accentWords.push(want[i])
    else if (match.kind === 'typo') typos.push(want[i])
    else return match.kind === 'meaning' ? { ...result, meanings: match.meanings } : result
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

// ---------- which words to fix ----------

/** One word of a wrong answer as the learner typed it, or the place where a word is missing. */
export interface DiffPart {
  text: string // '' for a missing word
  state: 'ok' | 'wrong' | 'missing'
  /** Wrong only in its accent ("esta" for "está"). */
  accent?: true
}

/** Close enough to be the same word misspelled: keeps "mercdo" lined up with "mercado". */
const isNear = (a: string, e: string) => levenshtein(fold(a), fold(e)) <= Math.max(1, Math.floor(e.length / 3))

/**
 * A wrong answer word by word, for a second try: which typed words are wrong and where
 * one is missing. The expected words themselves are not given away.
 */
export function diffWords(input: string, expected: string, options: CheckOptions = {}): DiffPart[] {
  const typed = input.replace(PUNCTUATION, ' ').split(/\s+/).filter(Boolean)
  const got = typed.map((w) => w.toLowerCase())
  const want = words(expected)
  const lead: DiffPart[] = []
  if (options.optionalSubject && got.length > 0 && hasExtraSubject(got, want)) {
    lead.push({ text: typed.shift()!, state: 'ok' })
    got.shift()
  }

  const part = (i: number, j: number): DiffPart => {
    const match = matchWord(got[i], want[j], options)
    if (match.kind === 'same' || match.kind === 'accent') return { text: typed[i], state: 'ok' }
    return match.kind === 'meaning' ? { text: typed[i], state: 'wrong', accent: true } : { text: typed[i], state: 'wrong' }
  }
  const pairCost = (i: number, j: number) => (part(i, j).state === 'ok' ? 0 : isNear(got[i], want[j]) ? 0.5 : 1)

  // Edit distance over words; cost[i][j] = cheapest way to turn got[i..] into want[j..].
  const cost = Array.from({ length: got.length + 1 }, (_, i) =>
    Array.from({ length: want.length + 1 }, (_, j) => (i === got.length ? want.length - j : j === want.length ? got.length - i : 0)),
  )
  for (let i = got.length - 1; i >= 0; i--) {
    for (let j = want.length - 1; j >= 0; j--) {
      cost[i][j] = Math.min(pairCost(i, j) + cost[i + 1][j + 1], 1 + cost[i + 1][j], 1 + cost[i][j + 1])
    }
  }

  const parts = lead
  let i = 0
  let j = 0
  while (i < got.length || j < want.length) {
    if (i < got.length && j < want.length && cost[i][j] === pairCost(i, j) + cost[i + 1][j + 1]) parts.push(part(i++, j++))
    else if (j < want.length && (i === got.length || cost[i][j] === 1 + cost[i][j + 1])) {
      parts.push({ text: '', state: 'missing' })
      j++
    } else parts.push({ text: typed[i++], state: 'wrong' })
  }
  return parts
}

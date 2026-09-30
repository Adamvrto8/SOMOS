// Grades a speech-recognition transcript against the sentence the learner read aloud
// (Vyslovovanie). Word by word and lenient: accents and punctuation come from the
// recognizer, not the learner, so they are ignored; extra spoken words don't count.

export type SpeechVerdict = 'correct' | 'typo' | 'wrong'

export interface WordMatch {
  word: string // as written in the sentence, punctuation included
  heard: boolean
}

export interface SpeechMatch {
  words: WordMatch[]
  missed: number
  verdict: SpeechVerdict
}

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function below100(n: number): string {
  if (n < 30) return UNITS[n]
  const unit = n % 10
  return unit ? `${TENS[Math.floor(n / 10)]} y ${UNITS[unit]}` : TENS[n / 10]
}

function below1000(n: number): string {
  if (n === 100) return 'cien'
  if (n < 100) return below100(n)
  const rest = n % 100
  return rest ? `${HUNDREDS[Math.floor(n / 100)]} ${below100(rest)}` : HUNDREDS[Math.floor(n / 100)]
}

/** Before "mil" / "millones" a final "uno" shortens: veintiún mil, treinta y un mil. */
const shortOne = (words: string) => words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

/** The number in words, up to 999 999 999; Google writes most spoken numbers as digits. */
export function numberWords(n: number): string | undefined {
  if (!Number.isInteger(n) || n < 0 || n >= 1_000_000_000) return undefined
  if (n < 1000) return below1000(n)
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000)
    const head = thousands === 1 ? 'mil' : `${shortOne(below1000(thousands))} mil`
    return n % 1000 ? `${head} ${below1000(n % 1000)}` : head
  }
  const millions = Math.floor(n / 1_000_000)
  const head = millions === 1 ? 'un millón' : `${shortOne(below1000(millions))} millones`
  return n % 1_000_000 ? `${head} ${numberWords(n % 1_000_000)}` : head
}

/** Clock time as said: 6:30 → seis y media, 9:00 → nueve, 8:45 → nueve menos cuarto. */
function timeWords(hour: number, minutes: number): string {
  const said = (h: number) => numberWords(h % 12 === 0 ? 12 : h % 12) ?? String(h)
  if (minutes === 0) return said(hour)
  if (minutes === 15) return `${said(hour)} y cuarto`
  if (minutes === 30) return `${said(hour)} y media`
  if (minutes === 45) return `${said(hour + 1)} menos cuarto`
  return `${said(hour)} y ${numberWords(minutes)}`
}

/** The recognizer's digits and symbols back into the words the sentence uses. */
function spokenForm(transcript: string): string {
  return transcript
    .replace(/\$\s?([\d.,]+)(?!\s*pesos)/g, '$1 pesos') // $5,000 → 5,000 pesos
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h: string, m: string) => timeWords(Number(h), Number(m)))
    .replace(/(\d)\s?°\s?C?/g, '$1 grados')
    .replace(/(\d)[.,](?=\d{3}\b)/g, '$1') // thousands separators
    .replace(/\d+/g, (digits) => numberWords(Number(digits)) ?? digits)
}

// "1" becomes "uno", but the sentence may say "un" or "una".
const ONE = new Set(['un', 'una', 'uno'])

function normalize(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:"«»()]/g, '')
}

const same = (a: string, b: string) => a === b || (ONE.has(a) && ONE.has(b))

/** Expected word i is heard when it is on the longest common subsequence with the transcript. */
function alignment(expected: string[], spoken: string[]): boolean[] {
  const n = expected.length
  const m = spoken.length
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = same(expected[i], spoken[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const heard = new Array<boolean>(n).fill(false)
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (same(expected[i], spoken[j])) {
      heard[i] = true
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++
    } else {
      j++
    }
  }
  return heard
}

export function matchSpeech(transcript: string, expected: string): SpeechMatch {
  const written = expected.split(/\s+/).filter((w) => normalize(w) !== '')
  const spoken = spokenForm(transcript)
    .split(/\s+/)
    .map(normalize)
    .filter(Boolean)
  const heard = alignment(written.map(normalize), spoken)
  const words = written.map((word, i) => ({ word, heard: heard[i] }))
  const missed = words.filter((w) => !w.heard).length
  const verdict: SpeechVerdict = missed === 0 ? 'correct' : missed === 1 && words.length >= 5 ? 'typo' : 'wrong'
  return { words, missed, verdict }
}

/** The recognizer offers a few guesses; the learner gets the kindest one. */
export function bestMatch(transcripts: string[], expected: string): { transcript: string; match: SpeechMatch } {
  let best = { transcript: transcripts[0] ?? '', match: matchSpeech(transcripts[0] ?? '', expected) }
  for (const transcript of transcripts.slice(1)) {
    const match = matchSpeech(transcript, expected)
    if (match.missed < best.match.missed) best = { transcript, match }
  }
  return best
}

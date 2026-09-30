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

/** 0–100 in words; the recognizer writes "3" for "tres". */
export function numberWords(n: number): string | undefined {
  if (!Number.isInteger(n) || n < 0 || n > 100) return undefined
  if (n === 100) return 'cien'
  if (n < 30) return UNITS[n]
  const unit = n % 10
  return unit ? `${TENS[Math.floor(n / 10)]} y ${UNITS[unit]}` : TENS[n / 10]
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
  const spoken = transcript
    .replace(/\d+/g, (digits) => numberWords(Number(digits)) ?? digits)
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

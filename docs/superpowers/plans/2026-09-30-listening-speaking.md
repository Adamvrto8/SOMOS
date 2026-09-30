# Listening and Speaking Exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two exercise types, Diktát (hear a sentence, type it) and Vyslovovanie (read a sentence aloud, checked by speech recognition), to the existing lesson system.

**Architecture:** Both types are sentence tasks (`itemId` = sentence id) added to `src/lib/lesson.ts` like `translation`, so random and numbered lessons, Chyby, attempts and progress work unchanged. A pure `speechMatch.ts` grades a transcript word by word; a thin `speech.ts` wraps Chrome's `SpeechRecognition`. The UI adds two task views plus a "skip the rest" path in the lesson player.

**Tech Stack:** React + TypeScript, Vitest, Web Speech API (`speechSynthesis`, `SpeechRecognition`/`webkitSpeechRecognition`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-30-listening-speaking-design.md`

## Global Constraints

- UI strings in Slovak; code, comments, commit messages in English. No `any` in data/lib code.
- Recognition language `es-MX`; `maxAlternatives: 3`, `interimResults: false`, `continuous: false`.
- TTS normal rate stays `0.9`; 🐢 slow rate `0.6`.
- Speaking verdict: `missed === 0` → `correct`; `missed === 1 && words.length >= 5` → `typo` (counts as correct); else `wrong`.
- Up to 3 recordings per speaking task; a recording that fails (nothing heard, offline, error) doesn't use a try; the 3rd recognized recording submits.
- Sentences whose `es` contains a digit (`/\d/`) are excluded from both types.
- Mobile first (375px), tap targets ≥ 44px, icons lucide 1.75 stroke.
- After lib changes `npm test`; before finishing `npm run build`. Commit per task, staging explicit paths (never `git add -A`: Adam's `.gitignore` edit stays uncommitted).

## Review Focus

- **Auto-submit after the 3rd recording** must grade that recording, not the previous React state: `check()` takes the answer as an argument (Task 4, manual check on the phone).
- **Leaving the task while recording** (Pokračovať, ✕, next task) must abort the recognizer and not set state after unmount (Task 4: the view aborts in its effect cleanup).
- **TTS still speaking when the mic opens** would let the recognizer hear the phone's own voice: `stopSpeaking()` before every recording (Task 2 + Task 4).
- **Recognizer writes digits** ("a las 3") or "1" for un/una: matched as words (Task 1 tests).
- **"Teraz nemôžem hovoriť" before any answer** goes back to Cvičiť instead of an empty result screen (Task 4, manual).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/speechMatch.ts` (new) | Pure: normalize, digits → words, LCS alignment, verdict, best alternative |
| `src/lib/speechMatch.test.ts` (new) | Its unit tests |
| `src/lib/speech.ts` (new) | `SpeechRecognition` wrapper: support flag, one recording, error codes + Slovak messages |
| `src/lib/speech.test.ts` (new) | Error-code mapping tests |
| `src/lib/tts.ts` | `speak(text, { rate })`, `stopSpeaking()` |
| `src/lib/lesson.ts` | `dictation` / `speaking` task types, pools, lessons, rebuild, grading |
| `src/lib/lesson.test.ts` | Extended for both types |
| `src/features/exercises/exercises.ts` | Two `EXERCISES` cards, `unavailable` note |
| `src/features/exercises/PracticePage.tsx` | Disabled card when `unavailable` |
| `src/features/exercises/tasks/DictationView.tsx` (new) | Autoplay, 🔊, 🐢, reveal SK, typed answer |
| `src/features/exercises/tasks/SpeechWords.tsx` (new) | Green/red word row |
| `src/features/exercises/tasks/SpeakingView.tsx` (new) | Mic button, tries, errors, skip |
| `src/features/exercises/tasks/TaskView.tsx` | Wires both views; `onSubmit(value?)`, `onSkipRest` |
| `src/features/exercises/LessonPage.tsx` | `check(value)`, `skipRest()`, override for speaking |
| `src/features/exercises/FeedbackSheet.tsx` | Reference for both kinds, speech word row + note |

Tasks are vertical slices: Task 1–2 are libraries, Task 3 ships Diktát end to end, Task 4 ships Vyslovovanie end to end.

---

### Task 1: `speechMatch.ts`: grade a transcript word by word

**Files:**
- Create: `src/lib/speechMatch.ts`
- Test: `src/lib/speechMatch.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SpeechVerdict = 'correct' | 'typo' | 'wrong'
  export interface WordMatch { word: string; heard: boolean }
  export interface SpeechMatch { words: WordMatch[]; missed: number; verdict: SpeechVerdict }
  export function numberWords(n: number): string | undefined
  export function matchSpeech(transcript: string, expected: string): SpeechMatch
  export function bestMatch(transcripts: string[], expected: string): { transcript: string; match: SpeechMatch }
  ```

- [ ] **Step 1: Write the failing tests**

`src/lib/speechMatch.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { bestMatch, matchSpeech, numberWords } from './speechMatch'

const heard = (transcript: string, expected: string) =>
  matchSpeech(transcript, expected).words.map((w) => `${w.word}${w.heard ? '' : '✗'}`).join(' ')

describe('matchSpeech', () => {
  it('accepts an exact transcript', () => {
    expect(matchSpeech('Hablo un poco de español', 'Hablo un poco de español.')).toMatchObject({ missed: 0, verdict: 'correct' })
  })

  it('ignores case, accents, ñ and punctuation', () => {
    expect(matchSpeech('hablo un poco de espanol', '¿Hablo un poco de español?').verdict).toBe('correct')
    expect(matchSpeech('¡ESTÁ BIEN!', 'Está bien.').verdict).toBe('correct')
  })

  it('keeps the sentence words as written and marks the missed ones', () => {
    expect(heard('hablo poco de español', 'Hablo un poco de español.')).toBe('Hablo un✗ poco de español.')
  })

  it('does not count extra spoken words against the learner', () => {
    expect(matchSpeech('eh hablo un poco de español sí', 'Hablo un poco de español.').verdict).toBe('correct')
  })

  it('reads digits as number words', () => {
    expect(matchSpeech('tengo 3 hermanos', 'Tengo tres hermanos.').verdict).toBe('correct')
    expect(matchSpeech('son las 21', 'Son las veintiuno.').verdict).toBe('correct')
    expect(matchSpeech('tengo 35 años', 'Tengo treinta y cinco años.').verdict).toBe('correct')
  })

  it('treats 1, un, una and uno as the same word', () => {
    expect(matchSpeech('es la 1', 'Es la una.').verdict).toBe('correct')
    expect(matchSpeech('quiero 1 café', 'Quiero un café.').verdict).toBe('correct')
  })

  it('is lenient by one word in sentences of five or more words', () => {
    expect(matchSpeech('hablo un poco de', 'Hablo un poco de español.')).toMatchObject({ missed: 1, verdict: 'typo' })
    expect(matchSpeech('tengo mucha', 'Tengo mucha hambre hoy.')).toMatchObject({ missed: 2, verdict: 'wrong' })
    expect(matchSpeech('tengo mucha hambre', 'Tengo mucha hambre hoy.')).toMatchObject({ missed: 1, verdict: 'wrong' })
  })

  it('fails an empty transcript', () => {
    expect(matchSpeech('', 'Hola.')).toMatchObject({ missed: 1, verdict: 'wrong' })
  })

  it('aligns in order, so a repeated word is matched once per occurrence', () => {
    expect(heard('mañana', 'Mañana voy mañana.')).toBe('Mañana voy✗ mañana.✗')
  })
})

describe('numberWords', () => {
  it.each([
    [0, 'cero'],
    [16, 'dieciséis'],
    [22, 'veintidós'],
    [30, 'treinta'],
    [47, 'cuarenta y siete'],
    [100, 'cien'],
  ])('%i → %s', (n, word) => {
    expect(numberWords(n)).toBe(word)
  })

  it('leaves bigger numbers alone', () => {
    expect(numberWords(1965)).toBeUndefined()
  })
})

describe('bestMatch', () => {
  it('picks the alternative with the fewest missed words, the first on ties', () => {
    const result = bestMatch(['hablo poco', 'hablo un poco de español', 'hablo un poco de español'], 'Hablo un poco de español.')
    expect(result.transcript).toBe('hablo un poco de español')
    expect(result.match.verdict).toBe('correct')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/speechMatch.test.ts`
Expected: FAIL, "Failed to resolve import './speechMatch'".

- [ ] **Step 3: Implement**

`src/lib/speechMatch.ts`:
```ts
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
```

Note on "treinta y cinco": the `y` of the sentence and the `y` produced by `numberWords(35)` align like any other word.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/speechMatch.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/speechMatch.ts src/lib/speechMatch.test.ts
git commit -m "feat(speech): word-by-word transcript matching"
```

---

### Task 2: `speech.ts` recognizer wrapper and TTS rate/stop

**Files:**
- Create: `src/lib/speech.ts`
- Test: `src/lib/speech.test.ts`
- Modify: `src/lib/tts.ts` (the `speak` function at the end of the file)

**Interfaces:**
- Produces:
  ```ts
  export type SpeechError = 'denied' | 'offline' | 'no-speech' | 'aborted' | 'failed'
  export const SPEECH_ERRORS: Record<SpeechError, string>
  export class SpeechFailure extends Error { code: SpeechError }
  export function speechErrorCode(error: string): SpeechError
  export const speechSupported: boolean
  export interface Recording { result: Promise<string[]>; stop: () => void; abort: () => void }
  export function startRecording(): Recording
  // tts.ts
  export function speak(text: string, options?: { rate?: number }): void
  export function stopSpeaking(): void
  export const SLOW_RATE = 0.6
  ```

- [ ] **Step 1: Write the failing test**

`src/lib/speech.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { speechErrorCode } from './speech'

describe('speechErrorCode', () => {
  it.each([
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'denied'],
    ['network', 'offline'],
    ['no-speech', 'no-speech'],
    ['audio-capture', 'no-speech'],
    ['aborted', 'aborted'],
    ['language-not-supported', 'failed'],
    ['something-new', 'failed'],
  ])('%s → %s', (error, code) => {
    expect(speechErrorCode(error)).toBe(code)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/speech.test.ts`
Expected: FAIL, "Failed to resolve import './speech'".

- [ ] **Step 3: Implement `speech.ts`**

```ts
// Speech recognition for Vyslovovanie: Chrome's built-in SpeechRecognition (free, Mexican
// Spanish). Chrome sends the audio to Google, so it needs internet.

export type SpeechError = 'denied' | 'offline' | 'no-speech' | 'aborted' | 'failed'

export const SPEECH_ERRORS: Record<SpeechError, string> = {
  denied: 'Mikrofón je zablokovaný. Povoľ ho v Nastaveniach Androidu → Aplikácie → SOMOS → Povolenia.',
  offline: 'Rozpoznávanie reči potrebuje internet.',
  'no-speech': 'Nič som nepočul. Skús to znova.',
  aborted: 'Nahrávanie sa prerušilo. Skús to znova.',
  failed: 'Nepodarilo sa. Skús to znova.',
}

export class SpeechFailure extends Error {
  code: SpeechError
  constructor(code: SpeechError) {
    super(code)
    this.code = code
  }
}

/** Maps the recognizer's `error` event value to what the UI distinguishes. */
export function speechErrorCode(error: string): SpeechError {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied'
    case 'network':
      return 'offline'
    case 'no-speech':
    case 'audio-capture':
      return 'no-speech'
    case 'aborted':
      return 'aborted'
    default:
      return 'failed'
  }
}

// TypeScript's DOM library has no types for the Web Speech recognizer.
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResultList {
  length: number
  [index: number]: { length: number; [index: number]: RecognitionAlternative }
}
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: RecognitionResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition

const speechWindow =
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor })
const Recognizer = speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition

export const speechSupported = Boolean(Recognizer)

export interface Recording {
  /** The recognizer's guesses for what was said, best first; rejects with SpeechFailure. */
  result: Promise<string[]>
  /** Stop listening and recognize what was said so far. */
  stop: () => void
  /** Stop and throw the recording away (leaving the task). */
  abort: () => void
}

/** One recording; ends by itself when the learner stops talking. */
export function startRecording(): Recording {
  if (!Recognizer) return { result: Promise.reject(new SpeechFailure('failed')), stop() {}, abort() {} }
  if (!navigator.onLine) return { result: Promise.reject(new SpeechFailure('offline')), stop() {}, abort() {} }

  const recognition = new Recognizer()
  recognition.lang = 'es-MX'
  recognition.interimResults = false
  recognition.maxAlternatives = 3
  recognition.continuous = false

  const result = new Promise<string[]>((resolve, reject) => {
    let alternatives: string[] = []
    let failure: SpeechFailure | undefined
    recognition.onresult = ({ results }) => {
      const last = results[results.length - 1]
      alternatives = Array.from({ length: last.length }, (_, i) => last[i].transcript.trim()).filter(Boolean)
    }
    recognition.onerror = ({ error }) => {
      failure = new SpeechFailure(speechErrorCode(error))
    }
    recognition.onend = () => {
      if (alternatives.length > 0) resolve(alternatives)
      else reject(failure ?? new SpeechFailure('no-speech'))
    }
    try {
      recognition.start()
    } catch {
      reject(new SpeechFailure('failed'))
    }
  })

  return { result, stop: () => recognition.stop(), abort: () => recognition.abort() }
}
```

- [ ] **Step 4: Change `speak` in `src/lib/tts.ts` and add `stopSpeaking`**

Replace the existing `speak` function (the last one in the file) with:
```ts
/** 🐢 in Diktát. */
export const SLOW_RATE = 0.6

export function speak(text: string, { rate = 0.9 }: { rate?: number } = {}) {
  if (!synth) return
  if (state.voices.length === 0) refreshVoices()
  const voice = activeVoice()
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang ?? 'es-MX'
  if (voice) utterance.voice = voice
  utterance.rate = rate
  synth.speak(utterance)
}

/** Silences the phone before the microphone opens, so the recognizer doesn't hear it. */
export function stopSpeaking() {
  synth?.cancel()
}
```
The existing callers (`SpeakButton`, `VoiceSettings`, `ConjugationTable`) call `speak(text)` and keep working.

- [ ] **Step 5: Run the tests and typecheck**

Run: `npx vitest run src/lib/speech.test.ts && npx tsc -b`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/speech.ts src/lib/speech.test.ts src/lib/tts.ts
git commit -m "feat(speech): recognizer wrapper and slower TTS"
```

---

### Task 3: Diktát end to end

**Files:**
- Modify: `src/lib/lesson.ts`, `src/lib/lesson.test.ts`
- Modify: `src/features/exercises/exercises.ts`, `src/features/exercises/FeedbackSheet.tsx`, `src/features/exercises/tasks/TaskView.tsx`
- Create: `src/features/exercises/tasks/DictationView.tsx`

**Interfaces:**
- Consumes: `speak`, `SLOW_RATE`, `ttsSupported` from `src/lib/tts.ts` (Task 2).
- Produces: `ExerciseType` includes `'dictation'`; `DictationTask { kind: 'dictation'; itemId: string; sentence: Sentence }`; `listeningSentences(filter)` (module-private) reused by Task 4.

- [ ] **Step 1: Extend the lesson tests (failing)**

In `src/lib/lesson.test.ts`:
- add `'dictation'` to the three `it.each([...] as const)` type lists (createLesson "builds a %s lesson", taskFromItem "rebuilds a %s task").
- add inside `describe('createLesson', …)`:
```ts
  it('leaves sentences with digits out of dictation', () => {
    const ids = itemIds(createLesson({ type: 'dictation' }, 1000, seeded(30)))
    expect(ids).not.toContain('s479')
    expect(ids).toHaveLength(sentences.filter((s) => !/\d/.test(s.es)).length)
  })
```
- add inside the grading `describe` (the one with "accepts a translation with an extra subject pronoun"):
```ts
  it('grades dictation against the exact sentence', () => {
    const task = taskFromItem('dictation', 's004')
    if (!task || task.kind !== 'dictation') throw new Error('task not found')
    expect(gradeTask(task, 'Hablo un poco de español').verdict).toBe('correct')
    expect(gradeTask(task, 'hablo un poco de espanol').correct).toBe(true) // accent + ñ only
    expect(gradeTask(task, 'Yo hablo un poco de español').correct).toBe(false) // not what was said
  })
```

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: FAIL (type errors / unknown exercise type `dictation`).

- [ ] **Step 2: Add the type to `src/lib/lesson.ts`**

- `export type ExerciseType = 'cloze' | 'choice' | 'conjugation' | 'builder' | 'translation' | 'vocab' | 'dictation'`
- after `TranslationTask`:
```ts
export interface DictationTask {
  kind: 'dictation'
  itemId: string // sentence id
  sentence: Sentence
}
```
- `export type Task = ClozeTask | ChoiceTask | ConjugationTask | BuilderTask | TranslationTask | VocabTask | DictationTask`
- after `translationSentences`:
```ts
/** Sentences to hear or say: a digit ("1965") has no single spoken or typed form. */
function listeningSentences(filter: LessonFilter) {
  return sentences.filter((s) => matchesSentence(s, filter) && !/\d/.test(s.es))
}
```
- `availableCount`: `case 'dictation': return listeningSentences(filter).length`
- `createLesson`:
```ts
    case 'dictation':
      return order(listeningSentences(filter), (s) => s.id)
        .slice(0, size)
        .map((sentence): DictationTask => ({ kind: 'dictation', itemId: sentence.id, sentence }))
```
- `seedFor`: `case 'dictation': return 314159265`
- `getStablePool`:
```ts
    case 'dictation': {
      const ordered = orderSentences(listeningSentences(filter), 'dictation', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence): DictationTask => ({ kind: 'dictation', itemId: sentence.id, sentence }))
    }
```
- `taskFromItem`:
```ts
    case 'dictation': {
      const sentence = sentenceById.get(itemId)
      return sentence ? { kind: 'dictation', itemId, sentence } : undefined
    }
```
- `EXERCISE_TYPES`: append `'dictation'`.
- `gradeTask`: `case 'dictation': return fromCheck(checkAnswer(text, task.sentence.es, { lookup: lookupForm }))`

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: PASS.

- [ ] **Step 3: Exercise card in `src/features/exercises/exercises.ts`**

Add `Headphones` to the lucide import and append to `EXERCISES`:
```ts
  {
    type: 'dictation',
    label: 'Diktát',
    description: 'Počúvaj vetu a napíš ju.',
    instruction: 'Napíš, čo počuješ',
    icon: Headphones,
  },
```

- [ ] **Step 4: Create `src/features/exercises/tasks/DictationView.tsx`**

```tsx
import { Eye, Snail, Volume2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../components/Button'
import type { DictationTask } from '../../../lib/lesson'
import { SLOW_RATE, speak, ttsSupported } from '../../../lib/tts'
import type { Status } from './status'
import { TypedAnswer } from './TypedAnswer'

interface DictationViewProps {
  task: DictationTask
  answer: string
  onAnswer: (answer: string) => void
  onSubmit: () => void
  status?: Status
}

/** Diktát: hear the sentence (normal or slow) and type it. The Slovak meaning stays hidden until asked for. */
export function DictationView({ task, answer, onAnswer, onSubmit, status }: DictationViewProps) {
  // Without a voice the task still works as a translation.
  const [showMeaning, setShowMeaning] = useState(!ttsSupported)
  const text = task.sentence.es

  // Starting the lesson was a tap, so Chrome lets the page speak right away.
  useEffect(() => {
    speak(text)
  }, [text])

  return (
    <div className="space-y-5">
      {ttsSupported ? (
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" icon={Volume2} onClick={() => speak(text)}>
            Prehrať
          </Button>
          <Button variant="secondary" icon={Snail} onClick={() => speak(text, { rate: SLOW_RATE })}>
            Pomaly
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Tento prehliadač nevie prehrávať reč.</p>
      )}

      {showMeaning || status ? (
        <p className="text-ink-muted">{task.sentence.sk}</p>
      ) : (
        <button
          type="button"
          onClick={() => setShowMeaning(true)}
          className="flex h-11 items-center gap-2 text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          <Eye size={16} strokeWidth={1.75} aria-hidden />
          Zobraziť preklad
        </button>
      )}

      <TypedAnswer
        value={answer}
        onChange={onAnswer}
        onSubmit={onSubmit}
        status={status}
        label="Čo si počul"
        placeholder="Po španielsky…"
        multiline
      />
    </div>
  )
}
```

- [ ] **Step 5: Wire it into `TaskView.tsx`**

Add the import `import { DictationView } from './DictationView'` and a case before `vocab`:
```tsx
    case 'dictation':
      return <DictationView task={task} answer={text} onAnswer={onAnswer} onSubmit={onSubmit} status={status} />
```

- [ ] **Step 6: Feedback reference in `FeedbackSheet.tsx`**

In `reference()`, extend the sentence case:
```ts
    case 'builder':
    case 'translation':
    case 'dictation':
      return { correct: task.sentence.es, correctLang: 'es', detail: task.sentence.sk, detailLang: 'sk', speak: task.sentence.es }
```
(⭐ already falls through to "save the sentence".)

- [ ] **Step 7: Test, typecheck, build**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 8: Try it in the browser**

Run `npm run dev` (don't stop Adam's `--host` server on 5173 if it is running; use the port Vite prints). Open Cvičiť → Diktát → start a lesson at 375px width: the sentence plays on the first task, 🔊 and 🐢 replay it, "Zobraziť preklad" shows the Slovak line, a correct typed answer is green, and a wrong one is red and appears in Archív → Chyby.

- [ ] **Step 9: Commit**

```bash
git add src/lib/lesson.ts src/lib/lesson.test.ts src/features/exercises/exercises.ts src/features/exercises/FeedbackSheet.tsx src/features/exercises/tasks/TaskView.tsx src/features/exercises/tasks/DictationView.tsx
git commit -m "feat(exercises): Diktát, hear a sentence and type it"
```

---

### Task 4: Vyslovovanie end to end

**Files:**
- Modify: `src/lib/lesson.ts`, `src/lib/lesson.test.ts`
- Modify: `src/features/exercises/exercises.ts`, `src/features/exercises/PracticePage.tsx`, `src/features/exercises/tasks/TaskView.tsx`, `src/features/exercises/LessonPage.tsx`, `src/features/exercises/FeedbackSheet.tsx`
- Create: `src/features/exercises/tasks/SpeechWords.tsx`, `src/features/exercises/tasks/SpeakingView.tsx`

**Interfaces:**
- Consumes: `matchSpeech`, `bestMatch`, `SpeechMatch` (Task 1); `startRecording`, `Recording`, `SpeechFailure`, `SPEECH_ERRORS`, `SpeechError`, `speechSupported` (Task 2); `speak`, `stopSpeaking` (Task 2); `listeningSentences` (Task 3).
- Produces: `ExerciseType` includes `'speaking'`; `SpeakingTask { kind: 'speaking'; itemId: string; sentence: Sentence }`; `Grade.speech?: SpeechMatch`; `TaskView` props `onSubmit: (value?: Answer) => void`, `onSkipRest?: () => void`; `ExerciseInfo.unavailable?: string`.

- [ ] **Step 1: Extend the lesson tests (failing)**

In `src/lib/lesson.test.ts`:
- add `'speaking'` to the same `it.each` type lists as in Task 3.
- extend the digit test from Task 3 to both types:
```ts
  it.each(['dictation', 'speaking'] as const)('leaves sentences with digits out of %s', (type) => {
    const ids = itemIds(createLesson({ type }, 1000, seeded(30)))
    expect(ids).not.toContain('s479')
    expect(ids).toHaveLength(sentences.filter((s) => !/\d/.test(s.es)).length)
  })
```
(replace the single-type version).
- add to the grading `describe`:
```ts
  it('grades speaking word by word, lenient by one word', () => {
    const task = taskFromItem('speaking', 's004') // "Hablo un poco de español." (5 words)
    if (!task || task.kind !== 'speaking') throw new Error('task not found')
    expect(gradeTask(task, 'hablo un poco de espanol')).toMatchObject({ correct: true, verdict: 'correct' })
    const almost = gradeTask(task, 'hablo un poco de')
    expect(almost).toMatchObject({ correct: true, verdict: 'typo' })
    expect(almost.speech?.missed).toBe(1)
    expect(gradeTask(task, 'hablo poco')).toMatchObject({ correct: false, verdict: 'wrong' })
  })
```

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: FAIL (unknown exercise type `speaking`).

- [ ] **Step 2: Add the type to `src/lib/lesson.ts`**

- import: `import { matchSpeech, type SpeechMatch } from './speechMatch'`
- `ExerciseType` gains `| 'speaking'`.
- after `DictationTask`:
```ts
export interface SpeakingTask {
  kind: 'speaking'
  itemId: string // sentence id
  sentence: Sentence
}
```
- `Task` union gains `| SpeakingTask`.
- `Grade` gains `speech?: SpeechMatch // Vyslovovanie: which words were heard`.
- `availableCount`: add `case 'speaking':` directly above the existing `case 'dictation':` (they share the return)
- `createLesson`:
```ts
    case 'speaking':
      return order(listeningSentences(filter), (s) => s.id)
        .slice(0, size)
        .map((sentence): SpeakingTask => ({ kind: 'speaking', itemId: sentence.id, sentence }))
```
- `seedFor`: `case 'speaking': return 271828182`
- `getStablePool`:
```ts
    case 'speaking': {
      const ordered = orderSentences(listeningSentences(filter), 'speaking', !filter.topic || filter.topic === 'all')
      return ordered.map((sentence): SpeakingTask => ({ kind: 'speaking', itemId: sentence.id, sentence }))
    }
```
- `taskFromItem`:
```ts
    case 'speaking': {
      const sentence = sentenceById.get(itemId)
      return sentence ? { kind: 'speaking', itemId, sentence } : undefined
    }
```
- `EXERCISE_TYPES`: append `'speaking'`.
- `gradeTask`:
```ts
    case 'speaking': {
      const speech = matchSpeech(text, task.sentence.es)
      return { correct: speech.verdict !== 'wrong', verdict: speech.verdict, expected: task.sentence.es, speech }
    }
```

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: PASS.

- [ ] **Step 3: Exercise card + disabled state**

`src/features/exercises/exercises.ts`: add `Mic` to the lucide import, import `speechSupported` from `'../../lib/speech'`, add to `ExerciseInfo`:
```ts
  /** Why the exercise can't be used in this browser; the card is then disabled. */
  unavailable?: string
```
and append to `EXERCISES`:
```ts
  {
    type: 'speaking',
    label: 'Vyslovovanie',
    description: 'Prečítaj vetu nahlas.',
    instruction: 'Povedz vetu nahlas',
    icon: Mic,
    unavailable: speechSupported ? undefined : 'Tento prehliadač nepodporuje rozpoznávanie reči.',
  },
```

`src/features/exercises/PracticePage.tsx`, in the `EXERCISES.map(...)` card: destructure `unavailable`, add `disabled={Boolean(unavailable)}` to the `<button>`, add `'disabled:opacity-50 disabled:pointer-events-none'` to its class list, and render the description as `{unavailable ?? description}`.

- [ ] **Step 4: Create `src/features/exercises/tasks/SpeechWords.tsx`**

```tsx
import type { WordMatch } from '../../../lib/speechMatch'

/** The sentence word by word: green = recognized, red = missed. */
export function SpeechWords({ words }: { words: WordMatch[] }) {
  return (
    <p lang="es" className="font-serif text-xl leading-relaxed">
      {words.map((w, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <span className={w.heard ? 'text-leaf' : 'text-error underline decoration-2 underline-offset-4'}>{w.word}</span>
        </span>
      ))}
    </p>
  )
}
```

- [ ] **Step 5: Create `src/features/exercises/tasks/SpeakingView.tsx`**

```tsx
import { Mic, Square, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SPEECH_ERRORS, SpeechFailure, startRecording, type Recording, type SpeechError } from '../../../lib/speech'
import { bestMatch, type SpeechMatch } from '../../../lib/speechMatch'
import type { SpeakingTask } from '../../../lib/lesson'
import { speak, stopSpeaking } from '../../../lib/tts'
import { SpeechWords } from './SpeechWords'
import type { Status } from './status'

// Only a recording that was recognized uses up a try; errors (nothing heard, offline…) don't.
const MAX_TRIES = 3

interface SpeakingViewProps {
  task: SpeakingTask
  onAnswer: (answer: string) => void
  onSubmit: (answer: string) => void
  onSkipRest?: () => void
  status?: Status
}

/** Vyslovovanie: read the sentence aloud; up to 3 recordings, the best one is submitted. */
export function SpeakingView({ task, onAnswer, onSubmit, onSkipRest, status }: SpeakingViewProps) {
  const [tries, setTries] = useState(0)
  const [recording, setRecording] = useState(false)
  const [last, setLast] = useState<{ transcript: string; match: SpeechMatch } | null>(null)
  const [error, setError] = useState<SpeechError | null>(null)
  const current = useRef<Recording | null>(null)
  const best = useRef<{ transcript: string; missed: number } | null>(null)
  const graded = status !== undefined

  // Leaving the task (next task, ✕) throws away a recording in progress.
  useEffect(() => () => current.current?.abort(), [])

  const record = async () => {
    if (recording) return current.current?.stop()
    stopSpeaking() // the recognizer must not hear the phone itself
    setError(null)
    setRecording(true)
    const rec = startRecording()
    current.current = rec
    try {
      const result = bestMatch(await rec.result, task.sentence.es)
      if (current.current !== rec) return // unmounted meanwhile
      const used = tries + 1
      setTries(used)
      setLast(result)
      if (!best.current || result.match.missed < best.current.missed) {
        best.current = { transcript: result.transcript, missed: result.match.missed }
        onAnswer(result.transcript)
      }
      if (used >= MAX_TRIES) onSubmit(best.current.transcript)
    } catch (e) {
      if (current.current !== rec) return
      setError(e instanceof SpeechFailure ? e.code : 'failed')
    } finally {
      if (current.current === rec) {
        current.current = null
        setRecording(false)
      }
    }
  }

  const micBlocked = error === 'denied'

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-line bg-surface p-5">
        <div className="flex items-start gap-2">
          {last ? (
            <div className="min-w-0 flex-1">
              <SpeechWords words={last.match.words} />
            </div>
          ) : (
            <p lang="es" className="min-w-0 flex-1 font-serif text-2xl leading-snug font-semibold">
              {task.sentence.es}
            </p>
          )}
          <button
            type="button"
            onClick={() => speak(task.sentence.es)}
            aria-label="Prehrať vetu"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <Volume2 size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        <p className="mt-2 text-ink-muted">{task.sentence.sk}</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void record()}
          disabled={graded || micBlocked}
          aria-label={recording ? 'Zastaviť nahrávanie' : 'Nahrať vetu'}
          className={[
            'flex size-20 items-center justify-center rounded-full text-on-accent shadow-md transition duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick',
            'disabled:pointer-events-none disabled:opacity-50',
            recording ? 'animate-pulse bg-error' : 'bg-brick active:scale-95',
          ].join(' ')}
        >
          {recording ? <Square size={28} strokeWidth={1.75} aria-hidden /> : <Mic size={32} strokeWidth={1.75} aria-hidden />}
        </button>
        <p role="status" className="min-h-5 text-sm text-ink-muted">
          {recording ? 'Počúvam…' : tries > 0 && !graded ? `Pokus ${tries}/${MAX_TRIES}` : ''}
        </p>
        {last && !recording && (
          <p className="text-center text-sm text-ink-muted">
            Rozpoznal som: <span lang="es">{last.transcript}</span>
          </p>
        )}
        {error && <p className="text-center text-sm text-error">{SPEECH_ERRORS[error]}</p>}
      </div>

      {onSkipRest && !graded && (
        <button
          type="button"
          onClick={onSkipRest}
          className="h-11 w-full text-sm font-medium text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          Teraz nemôžem hovoriť
        </button>
      )}
    </div>
  )
}
```
`tries` grows only when a recording was recognized, so no error uses up a try (the spec only required
that for "nothing heard" and technical errors; offline and denied can't be retried usefully anyway).

- [ ] **Step 6: Wire `TaskView.tsx`**

- Props: `onSubmit: (value?: Answer) => void` and new `onSkipRest?: () => void`; destructure `onSkipRest`.
- Import `SpeakingView`, add the case:
```tsx
    case 'speaking':
      return <SpeakingView task={task} onAnswer={onAnswer} onSubmit={onSubmit} onSkipRest={onSkipRest} status={status} />
```
- The existing `TypedAnswer` and `DictationView` calls pass `onSubmit` through unchanged, and they call it with no argument.

- [ ] **Step 7: `LessonPage.tsx`: check with a value, skip the rest, override**

Replace `canCheck` and `check` with:
```ts
  const isAnswered = (value: Answer) =>
    task
      ? task.kind === 'builder'
        ? Array.isArray(value) && value.length === task.tiles.length
        : typeof value === 'string' && value.trim() !== ''
      : false
  const canCheck = isAnswered(answer)

  /** `value` lets a task submit an answer it has just set (Vyslovovanie's 3rd recording). */
  const check = (value: Answer = answer) => {
    if (!task || grade || !isAnswered(value)) return
    setAnswer(value)
    setGrade(gradeTask(task, value))
    // Close the phone keyboard so the feedback sheet is visible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  }

  /** "Teraz nemôžem hovoriť": end here; the tasks not reached count neither way. */
  const skipRest = () => {
    if (!tasks || grade) return
    if (answers.length === 0) return exit()
    setTasks(tasks.slice(0, index))
  }
```
- The Skontrolovať button: `onClick={() => check()}` (so the click event isn't passed as the answer).
- `TaskView`: add `onSkipRest={skipRest}`.
- `FeedbackSheet` `onOverride`: `task.kind === 'translation' || task.kind === 'vocab' || task.kind === 'speaking' ? … : undefined`.

After `setTasks(tasks.slice(0, index))`, `index >= total`, so the result screen shows the answers so far. A numbered lesson keeps the credit already recorded for right answers (as when quitting with ✕); the skipped tasks add nothing.

- [ ] **Step 8: `FeedbackSheet.tsx`: speaking reference, words and note**

- `reference()`: add `case 'speaking':` to the `builder`/`translation`/`dictation` group.
- Import `SpeechWords` from `./tasks/SpeechWords`.
- Title: `const title = grade.speech && grade.verdict === 'typo' ? 'Takmer!' : tone.title` and render `{title}` instead of `{tone.title}`.
- Notes: before the "Nepravidelný tvar" line:
```tsx
  if (grade.speech && grade.verdict === 'typo') notes.push(<>Takmer — jedno slovo som nepočul.</>)
```
- Under the reference block (after the `ref.detail` div, inside `<div className="mt-3">`):
```tsx
          {grade.speech && grade.verdict !== 'correct' && (
            <div className="mt-2">
              <p className="text-xs font-semibold tracking-widest text-ink-muted uppercase">Čo som počul</p>
              <SpeechWords words={grade.speech.words} />
            </div>
          )}
```

- [ ] **Step 9: Test, typecheck, build**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 10: Try it in the browser**

With `npm run dev` in desktop Chrome (it has `webkitSpeechRecognition`), at 375px width: Cvičiť → Vyslovovanie → start. Allow the microphone, read the sentence: words turn green/red and show "Pokus 1/3". Skontrolovať grades the best try; a third recording submits by itself. "Teraz nemôžem hovoriť" on the first task goes back to Cvičiť; after one answer it shows the result screen. With the network offline (DevTools → Network → Offline) 🎤 shows "Rozpoznávanie reči potrebuje internet.". In Firefox the card is greyed out with the note.

- [ ] **Step 11: Commit**

```bash
git add src/lib/lesson.ts src/lib/lesson.test.ts src/features/exercises/exercises.ts src/features/exercises/PracticePage.tsx src/features/exercises/tasks/TaskView.tsx src/features/exercises/tasks/SpeechWords.tsx src/features/exercises/tasks/SpeakingView.tsx src/features/exercises/LessonPage.tsx src/features/exercises/FeedbackSheet.tsx
git commit -m "feat(exercises): Vyslovovanie, read a sentence aloud"
```

---

### Task 5: Docs, final check, push

**Files:**
- Modify: `CLAUDE.md` (sections 1 and 5)

- [ ] **Step 1: Update `CLAUDE.md`**

In §1 "Exercises", after the "Conjugation drill" bullet add:
```
   - **Diktát** — hear a sentence (🔊, 🐢 slower), type it; checked like translation
   - **Vyslovovanie** — read a sentence aloud; Chrome speech recognition (es-MX, online), word by word,
     ≤1 missed word in 5+ words = 🟡; 3 tries; "Teraz nemôžem hovoriť" ends the lesson (`speechMatch.ts`, `speech.ts`)
```
In §2 table, "Pronunciation" row: append `; SpeechRecognition (es-MX) for Vyslovovanie`.

- [ ] **Step 2: Full verification**

Run: `npm run validate:data && npm test && npm run build`
Expected: all green.

- [ ] **Step 3: Commit and push**

```bash
git add CLAUDE.md docs/superpowers/plans/2026-09-30-listening-speaking.md
git commit -m "docs: listening and speaking exercises"
git push origin main
```

- [ ] **Step 4: Phone test list for Adam** (installed PWA, Android, on mobile data or a Wi-Fi that reaches Vercel)
  1. Close and reopen SOMOS; Nastavenia show the new commit.
  2. Cvičiť → Diktát → a lesson: autoplay, 🐢, Zobraziť preklad, a wrong answer lands in Chyby.
  3. Cvičiť → Vyslovovanie → first 🎤 asks for the microphone → allow; colours, Pokus n/3, 🟡 "Takmer!".
  4. Airplane mode → 🎤 → "Rozpoznávanie reči potrebuje internet." → "Teraz nemôžem hovoriť".
  5. Chyby → Precvičiť: dictation and speaking mistakes play there too.

# Listening and speaking exercises — design

Date: 2026-09-30 · Status: approved in chat, awaiting spec review

## Goal

Everything SOMOS practises today is reading and typing. Two new exercise types add the missing
input and output channels, reusing the 598 sentences, the TTS voice and the lesson player:

- **Diktát** (listening): hear a Spanish sentence, type what you heard.
- **Vyslovovanie** (speaking): read a Spanish sentence aloud; speech recognition checks it.

Both stay free. Dictation works offline (when the phone has a Spanish voice); speaking needs internet.

Non-goals: "listen and pick the meaning" tasks, translate-and-say (SK prompt → spoken ES),
pronunciation scoring beyond "was the word recognized", paid or on-device speech recognition.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Listening format | Dictation only, typed, checked like Preklad viet |
| Speaking format | Read aloud: ES sentence + SK meaning + 🔊 visible, learner says it |
| Speaking strictness | Word by word, lenient: all words heard ✅; ≤1 missed word in a sentence of ≥5 words 🟡 (counts as correct); otherwise ❌ → Chyby |
| Tries | Up to 3 recordings per sentence; Skontrolovať submits the best one; the 3rd recording submits by itself |
| Recognition engine | Chrome's Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`, `lang: 'es-MX'`), free, online |
| No mic / offline | "Teraz nemôžem hovoriť" ends the lesson; skipped tasks count neither way |

## What the learner sees

**Cvičiť** gets two cards after the existing six, with the usual topic + level filter and numbered lessons:

- **Diktát** (icon `Headphones`): "Počúvaj vetu a napíš ju." Instruction above each task: "Napíš, čo počuješ".
- **Vyslovovanie** (icon `Mic`): "Prečítaj vetu nahlas." Instruction: "Povedz vetu nahlas".
  In a browser without speech recognition the card is disabled with the note
  "Tento prehliadač nepodporuje rozpoznávanie reči."

**Dictation task**
- The sentence is spoken once when the task appears. (Chrome only speaks after a user gesture on the page;
  starting a lesson is one, so autoplay works; if it's still blocked, 🔊 is right there.)
- Buttons: 🔊 "Prehrať" (normal rate 0.9) and 🐢 "Pomaly" (rate 0.6).
- "Zobraziť preklad" reveals the Slovak sentence (hidden by default, so it isn't a translation exercise).
- The multiline typed answer field (with the á é í ó ú ñ ü ¿ ¡ keys) → Skontrolovať.
- Without any TTS support the task shows the note "Tento prehliadač nevie prehrávať reč." and the
  Slovak sentence is revealed, so the task can still be done as a translation.

**Speaking task**
- Spanish sentence (serif, large), Slovak meaning under it, 🔊 to hear it first.
- A big round 🎤 button. While it's recording it pulses and says "Počúvam…". Recording stops by itself
  when the learner stops talking (the recognizer's end of speech), or when they tap the button again.
- After each recording the sentence is shown word by word: heard words green, missed words red,
  plus "Rozpoznal som: <transcript>" in muted text and "Pokus n/3".
- Skontrolovať is enabled after the first recording and submits the best attempt so far.
  The 3rd recording submits automatically.
- Errors (Slovak, under the button, recording can be retried unless noted):
  - mic permission denied → "Mikrofón je zablokovaný. Povoľ ho v Nastaveniach Androidu → Aplikácie → SOMOS → Povolenia." (no retry)
  - offline / network → "Rozpoznávanie reči potrebuje internet."
  - nothing heard → "Nič som nepočul. Skús to znova." (does not use up a try)
  - anything else → "Nepodarilo sa. Skús to znova." (does not use up a try)
- "Teraz nemôžem hovoriť" (text button under the mic) ends the lesson; see the lesson player below.

**Feedback sheet** (both types): the correct Spanish sentence, Slovak meaning, 🔊, ⭐ saves the
sentence, as for Preklad viet. The speaking sheet also shows the coloured words, and it keeps
"Moja odpoveď bola tiež správna" (the recognizer can mishear). Dictation has no override: the
target text is exact.

## Logic

### `src/lib/lesson.ts`

- `ExerciseType` gains `'dictation' | 'speaking'`; `EXERCISE_TYPES` too.
- `DictationTask { kind: 'dictation'; itemId: string /* sentence id */; sentence: Sentence }`,
  `SpeakingTask { kind: 'speaking'; itemId; sentence }`.
- Pool: `sentences` matching the filter whose `es` contains no digit (`/\d/`), today only s479.
- `availableCount`, `createLesson`, `getStablePool` (via `orderSentences`, new seeds in `seedFor`),
  `taskFromItem` handle both, exactly like `translation`.
- `gradeTask`:
  - dictation → `checkAnswer(text, sentence.es, { lookup: lookupForm })`
  - speaking → `gradeSpeech(text, sentence.es)` from `speechMatch.ts`, mapped to a `Grade`
    (verdict `correct` / `typo` for 🟡 / `wrong`), with `speech` details for the UI.
- `Grade` gets an optional `speech?: SpeechMatch` field.

### New `src/lib/speechMatch.ts` (pure, unit-tested)

```ts
interface WordMatch { word: string; heard: boolean }   // word as written in the sentence
interface SpeechMatch { words: WordMatch[]; missed: number; verdict: 'correct' | 'typo' | 'wrong' }
function matchSpeech(transcript: string, expected: string): SpeechMatch
function bestMatch(transcripts: string[], expected: string): { transcript: string; match: SpeechMatch }
```

- Normalization of each word: lowercase, strip accents and ñ→n, strip punctuation `¿?¡!.,;:"`.
  Accents are ignored on purpose: the recognizer, not the learner, decides them.
- Digits in the transcript become Spanish number words (0–100 via a small table; "3" → "tres",
  "21" → "veintiuno"); a longer number stays as it is.
- Alignment: longest common subsequence of normalized words; an expected word is `heard` when it
  is in the LCS. Extra spoken words don't count against the learner.
- Verdict: `missed === 0` → correct; `missed === 1 && words.length >= 5` → typo; otherwise wrong.
- `bestMatch` picks the alternative with the fewest missed words (first on ties); the recognizer
  asks for `maxAlternatives: 3`.

### New `src/lib/speech.ts`

- `speechSupported: boolean`: `SpeechRecognition` or `webkitSpeechRecognition` exists.
- `listen(signal?: AbortSignal): Promise<string[]>` (one recording, `lang 'es-MX'`,
  `interimResults: false`, `maxAlternatives: 3`, `continuous: false`) resolves with the alternatives
  of the final result. It rejects with `SpeechFailure(code)`, where code is `'denied' | 'offline' | 'no-speech' | 'aborted' | 'failed'`
  (from the `error` event: `not-allowed`/`service-not-allowed` → denied, `network` → offline,
  `no-speech`/`audio-capture` → no-speech, `aborted` → aborted). It also checks `navigator.onLine` first.
- `SPEECH_ERRORS: Record<code, string>`: the Slovak messages above.
- Typed with a small local interface (no `any`); TypeScript's DOM lib lacks these types.

### `src/lib/tts.ts`

`speak(text, { rate }?)`, default rate stays 0.9; 🐢 uses 0.6.

## Screens

- `src/features/exercises/exercises.ts`: two `EXERCISES` entries. `ExerciseInfo` gets optional
  `unavailable?: string`, set for speaking when `!speechSupported`; `PracticePage` renders such a
  card disabled with that note.
- `tasks/DictationView.tsx` and `tasks/SpeakingView.tsx`, wired into `TaskView`. Speaking stores
  the best transcript as the `Answer` (a string) and calls `onSubmit` after the 3rd attempt.
  A new `onSkipRest` prop reaches the speaking view.
- `LessonPage.tsx`: `skipRest()` goes to the result screen with the answers so far. With no answer yet
  it goes back to Cvičiť. A lesson ended this way never marks a numbered lesson as passed.
  The override button also shows for `speaking`.
- `FeedbackSheet.tsx`: `dictation` and `speaking` like `translation`; speaking adds the word row.
  A speaking 🟡 has no `check` (no typed-word details), so its note is "Takmer — jedno slovo som nepočul."
  instead of the typo explanation.
- `taskSummary.ts` already falls through to sentence SK → ES; nothing to change.
- Chyby, lesson progress, "Pokračuj v lekcii", stats: keyed by exercise type, work unchanged.

## Testing

- `speechMatch.test.ts`: exact match, accents and case ignored, punctuation ignored,
  "3" ↔ "tres", extra words, one missed word in 5+ words → typo, in 4 words → wrong,
  two missed → wrong, `bestMatch` picks the best alternative.
- `lesson.test.ts`: the `it.each` lists include both new types; digit sentences are excluded;
  `taskFromItem('dictation' | 'speaking', 's004')` round-trips; grading of both kinds.
- `npm test`, `npm run build`.
- On the phone (installed PWA, Android Chrome): mic permission prompt appears on the first 🎤;
  one Diktát lesson (autoplay, 🐢, reveal); one Vyslovovanie lesson (colours, 3 tries, 🟡);
  airplane mode → offline message + "Teraz nemôžem hovoriť"; wrong answers show up in Chyby
  and can be practised there.

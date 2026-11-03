# New exercise types: pravda/nepravda, nájdi chybu, priraďovanie (part C, step 4)

Date: 2026-11-03. Branch `grammar-varied-blanks`, worktree `C:\CODE\SOMOS-varied-blanks` (builds on steps 2 and 3).
Follows the part B report §4, item 4 ("new exercise types: matching, find the mistake, listening comprehension…").

## 1. Goal

Cvičiť has eight types (cloze, choice, vocab, conjugation, builder, translation, dictation, speaking). All but
choice and builder ask the learner to produce a form. Three new types train other skills: judging whether
Spanish is right, spotting an error, and pairing words. All three need **no new content**: they are built from
the 2300 existing blanks and the 1680 words.

Adam's choices (2026-11-03): matching, find the mistake and true/false (with swipe). Listening comprehension
("hear a sentence, pick the meaning") stays for later; dictation already covers listening.

Non-goals: new sentences or words, audio, a new exercise page layout, anything for duels, tests or the path in
this step (see §4).

## 2. The shared idea: a corrupted sentence

A blank (`Cloze`) has `answer` and `distractors`. Swapping the answer for a distractor gives a sentence that is
wrong **against its Slovak translation**: the Spanish no longer says what the Slovak above it says. That is the
definition of "mistake" in both new sentence types; it does not depend on the corrupted sentence being
ungrammatical in isolation (a distractor that is a valid but different sentence is still a mistake here).

```ts
// src/lib/corrupt.ts (pure, no React)
interface Corrupted { tokens: string[]; index: number; wrong: string; right: string }
corrupt(sentence: Sentence, clozeIndex: number, distractorIndex: number): Corrupted | undefined
```

- Replaces `tokens[cloze.tokenIndex]` with `cloze.distractors[distractorIndex]`, keeping a sentence-initial
  capital. `es` is rebuilt from tokens with the same spacing rules the validator uses.
- Eligible blank: at least 2 distractors, answer ≠ distractor ignoring case, no digit in the sentence (as dictation).
- Open risk: some distractor may still read as correct in context (de/desde). Mitigations: the existing
  "Nahlásiť chybu" button works on these tasks (§5), Adam spot-checks on the phone, and the validator is extended
  so a distractor never equals the answer or another distractor (cheap, catches slips).

## 3. The three types

### 3.1 Pravda / nepravda (`truefalse`)

- Card: the Spanish sentence, the Slovak translation below it. "Hovorí španielčina to isté?"
- Half of the tasks show the original sentence (true), half the corrupted one (false). Which is decided by the
  task's `itemId`, so a rebuilt task is the same.
- Answer by **swipe**: right = pravda, left = nepravda. The card follows the finger, tilts, shows a ✓ / ✗ stamp
  past a threshold (80 px or a fling) and snaps back below it. Two buttons (✓ Pravda, ✗ Nepravda) do the same for
  keyboard and screen reader users; the swipe is an addition, not the only way.
- Feedback sheet (existing): right or wrong; on a false sentence it shows the original sentence with the changed
  word marked; on a mistaken "true" answer it says what was wrong.
- No retry (a second try would be a coin flip): `canRetry` false, like speaking.
- `itemId`: `s123#0:t` (original) or `s123#0:f2` (corrupted with distractor 2).
- Pool: one eligible blank per sentence per lesson; parity (t/f) alternates by pool position and level seed.

### 3.2 Nájdi chybu (`findmistake`)

- Card: a corrupted sentence as tappable word chips, the Slovak translation above. "Klepni na slovo, ktoré je zle."
- Step 1: tap the wrong word. Step 2 (appears after a right tap): pick the fix from `[right, ...other distractors]`
  (shuffled, 3–4 options), reusing `ChoiceOptions`.
- A wrong tap in step 1 shakes the chip and lets the learner tap again; a second wrong tap ends the task as wrong
  and shows the answer. A wrong fix in step 2 is wrong, no retry. Right = the right word and the right fix.
- `itemId`: `s123#0:2` (blank 0, distractor 2). Punctuation tokens are not tappable.
- Grade: `Answer` is a `string[]` `[tappedIndex, chosenFix]`; `Grade.expected` is the correct sentence.

### 3.3 Priraďovanie (`matching`)

- A task is a **round**: 5 words as Spanish chips on the left (nouns with article: *la casa*), their Slovak
  translations shuffled on the right. Tap one of each side to pair; a right pair locks green, a wrong one flashes
  red and unlocks. A lesson is 4 rounds (size 4), so about 20 words, not 50.
- The round is correct when it ends with at most 2 wrong pairings; the feedback names the words that were
  paired wrong. All 5 pairs are needed to finish a round (a wrong pairing never ends it).
- Words of one round share a topic and level (so they are not trivially separated), have no shared first
  translation (the existing `translationKey` rule for vocab) and skip `drill: false` words (articles).
- `itemId`: `m:id1,id2,id3,id4,id5` (sorted word ids). In a Chyby lesson the same five come back.
- Pool: `vocabWords` filtered like vocab (topic, level), chunked into rounds by the seeded order vocab uses.

## 4. Where it plugs in

| Part | Change |
|---|---|
| `src/lib/lesson.ts` | `ExerciseType` += three; tasks `TrueFalseTask`, `FindMistakeTask`, `MatchingTask`; cases in `availableCount`, `createLesson`, `getStablePool`, `taskFromItem`, `EXERCISE_TYPES`, `seedFor`, `taskLevel`, `gradeTask`, `canRetry`, `retryTasks` (reshuffle options/pairs) |
| `src/lib/corrupt.ts` (new) | `corrupt`, eligibility, parity; unit-tested |
| `src/features/exercises/exercises.ts` | three cards (icons `ThumbsUp`/`SearchCheck`/`Link2`), no `unavailable` |
| `tasks/` | `TrueFalseView.tsx` (+ `useSwipe.ts` hook), `FindMistakeView.tsx`, `MatchingView.tsx`; `TaskView.tsx` switch |
| `FeedbackSheet.tsx`, `taskSummary.ts`, `TaskAnswerList.tsx`, `LessonPage.tsx` | per-kind labels and answer display |
| `src/lib/contentReport.ts`, `contentReportsAdmin.ts` | a report on these tasks names the sentence (`truefalse`, `findmistake`) or the words (`matching`) |
| `src/lib/stats.ts` | per-exercise stat rows include the new types (they are keyed by exercise string already) |
| `src/i18n/sk.ts`, `en.ts` | `exercise.types.*` label, description, instruction; feedback strings |
| `scripts/validate-data.ts` | distractors differ from the answer and from each other |

Out of scope on purpose: `src/lib/tests.ts` (level exams and topic tests keep their types), `path.ts` (guided path
units), `tips.ts` (no grammar tip per new type), duels, review. Each is a candidate for a later step once Adam has
tried the types on the phone.

## 5. Mistakes and the daily goal

- A wrong task goes to Chyby with its `exercise` + `itemId` like any other and is practised again through
  `taskFromItem`; a stale `itemId` (a sentence or word removed) returns `undefined`, as today.
- Right answers count for the daily goal and the streak like every other attempt (CLAUDE.md §1.7).
- Lessons prefer the items answered least often (`seen`), as the other types do.

## 6. Testing

- Unit (`corrupt.test.ts`, `lesson.test.ts`): corrupt keeps capitals and spacing; ineligible blanks (digits, <2
  distractors) are skipped; `taskFromItem` round-trips every `itemId`; true/false parity is stable; matching
  rounds have 5 distinct, non-synonym, same-topic words; grading cases for all three types including the
  at-most-2-wrong rule and the two-taps rule.
- `validate:data`: the new distractor checks pass on today's data (fix data if they find slips).
- e2e (one file): true/false by swipe and by button, find-the-mistake end to end, matching one round; at 375 px.
- Adam on the phone: swipe feel (threshold, tilt), tap targets of the chips (≥44 px), whether any corrupted
  sentence reads as correct (use Nahlásiť chybu), whether 4 rounds of matching is the right length.

## 7. Open choices (defaults chosen, tell Claude to change them)

1. Matching round size 5 and lesson size 4 rounds.
2. Correct round = at most 2 wrong pairings.
3. Find the mistake allows one wrong tap before it counts as wrong.
4. No new types in tests, path or duels in this step.

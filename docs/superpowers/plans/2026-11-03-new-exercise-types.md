# New exercise types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three exercise types to Cvičiť — pravda/nepravda (`truefalse`, swipe), nájdi chybu (`findmistake`) and priraďovanie (`matching`) — built from existing blanks and words, with no new content.

**Architecture:** A pure module `src/lib/corrupt.ts` swaps a blank's answer for one of its distractors; `truefalse` and `findmistake` are two views of that corrupted sentence. `matching` pairs 5 words per round. Each type is a vertical slice through `src/lib/lesson.ts` (task, pool, grading, rebuild from `exercise` + `itemId`) and a view in `src/features/exercises/tasks/`, wired into the feedback sheet, reports, tips and the two server allowlists. The three views submit by themselves, so the lesson footer's "Skontrolovať" is hidden for them.

**Tech Stack:** Vite + React + TypeScript, Vitest, Playwright, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-03-new-exercise-types-design.md`

## Global Constraints

- UI strings Slovak in `src/i18n/sk.ts` and English in `src/i18n/en.ts` (`en: Dictionary` is type-checked against `sk`, so a missing key fails `tsc`); code, comments, commit messages English.
- Spanish content stays Mexican, no vosotros; this plan adds no content.
- Tap targets ≥ 44 px; mobile first (375 px), content max width 480 px.
- A wrong task goes to Chyby with `exercise` + `itemId`; `taskFromItem` rebuilds it and returns `undefined` for a stale id (never throws).
- No new `any`; no `vosotros`; `TABLE_TENSES`, tests, path, duels and tips are untouched (spec §4 "out of scope").
- Never stage `CLAUDE.md`, `poznaky.txt`, `.gitignore` or `Design/` (Adam's uncommitted work in the main checkout). Stage explicit paths. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `C:\CODE\SOMOS-varied-blanks`, branch `grammar-varied-blanks`. Run the e2e suite there with `E2E_PORT=5299` and `--workers=3`.
- After `src/lib` changes `npm test`; after each slice `npx tsc -b`; before finishing `npm run validate:data`, `npm run build`, `E2E_PORT=5299 npm run test:e2e -- --workers=3`.

**Deviations from the spec, decided while planning (tell Adam):**
- No new validator check. `scripts/validate-data.ts` already rejects duplicate distractors, a distractor equal to the answer and empty distractors (lines 483-488). The data-wide guarantee is a unit test in `corrupt.test.ts` instead.
- No `useSwipe.ts` hook: the decision is a pure function `swipeDirection` in `src/lib/swipe.ts` (unit-tested), the pointer handlers live in `TrueFalseView.tsx`.
- `ExercisePage` shows an exam card when every lesson of "Všetko × level" is passed. The new types have no exam (tests are out of scope), so `ExercisePage` is told to offer it only for types `tests.ts` knows (`isExerciseType`).
- The three views submit on their own, so `LessonPage` renders no footer for them while the task is open.
- Matching lessons have 4 rounds (`lessonSizeOf('matching')`), every other type keeps `LESSON_SIZE` = 10. Words with a Spanish form over 24 characters or a first translation over 28 are left out of matching so the chips stay readable.

## Review Focus

1. **A corrupted sentence that reads as correct** (a distractor that fits, de/desde). The unit test checks the mechanics only; the safety net is the report button. Task 2 pins that a report on `truefalse`/`findmistake` has a `detail` the server accepts (`/^[a-z0-9:-]{0,40}$/`) and that the server allowlists contain the new types.
2. **A stale `itemId`** (sentence removed, blank removed, distractor list shortened, word removed, malformed text) from Chyby or a backup: `taskFromItem` returns `undefined`, `mistakesLesson` skips it. Pinned per slice.
3. **Spacing and capitals of the rebuilt sentence** (`¿…?`, `¡…!`, a sentence-initial blank). `rebuild(tokens)` equals `es` for every sentence in the data; a lowercase distractor in a capital slot is capitalised. Pinned in Task 1.
4. **Small pools for matching** (a topic × level with fewer than 5 usable words, words sharing a first translation such as otec: padre/papá). No round has fewer than 5 words or two words with the same first translation; an empty pool gives 0 lessons, not a crash. Pinned in Task 4.
5. **Getting stuck on a task that submits by itself**: find-the-mistake after two wrong taps, matching after a wrong pairing, truefalse by button when the swipe is not possible. Pinned by the e2e file in Task 5 (wrong path of each type ends with "Nesprávne" and "Pokračovať").

---

### Task 1: Corrupting a sentence (`corrupt.ts`, `swipe.ts`)

**Files:**
- Create: `src/lib/corrupt.ts`
- Create: `src/lib/swipe.ts`
- Test: `src/lib/corrupt.test.ts`
- Test: `src/lib/swipe.test.ts`

**Interfaces:**
- Consumes: `Cloze`, `Sentence` from `../data/types`; `spaceBefore` from `./text` (`(tokens: string[], i: number) => boolean`).
- Produces:
  - `interface Corrupted { tokens: string[]; index: number; wrong: string; right: string; es: string }`
  - `stableHash(text: string): number` (unsigned 32-bit)
  - `rebuild(tokens: string[]): string`
  - `swappableDistractors(cloze: Cloze): number[]` (indices into `cloze.distractors` of one-word distractors that differ from the answer)
  - `eligibleClozes(sentence: Sentence): number[]` (blank indices with ≥ 2 swappable distractors; `[]` for a sentence with a digit)
  - `distractorFor(sentence: Sentence, clozeIndex: number, r: number): number | undefined` (`r` in [0, 1))
  - `corrupt(sentence: Sentence, clozeIndex: number, distractorIndex: number): Corrupted | undefined`
  - `SWIPE_DISTANCE = 80`, `swipeDirection(dx: number, ms: number): 'left' | 'right' | null`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/corrupt.test.ts
import { describe, expect, it } from 'vitest'
import { sentenceById, sentences } from '../data'
import type { Sentence } from '../data/types'
import { corrupt, distractorFor, eligibleClozes, rebuild, swappableDistractors } from './corrupt'

const make = (over: Partial<Sentence> & Pick<Sentence, 'tokens' | 'cloze'>): Sentence => ({
  id: 'sx',
  es: rebuild(over.tokens),
  sk: 'x',
  level: 'A1',
  topics: ['basics'],
  ...over,
})

describe('rebuild', () => {
  it('gives back the sentence text for every sentence of the data', () => {
    const bad = sentences.filter((s) => rebuild(s.tokens) !== s.es).map((s) => s.id)
    expect(bad).toEqual([])
  })
})

describe('corrupt', () => {
  it('swaps the answer for a distractor and rebuilds the text', () => {
    const sentence = sentenceById.get('s372')! // Quiero un café sin azúcar. (sin: con, para, por)
    const result = corrupt(sentence, 0, 0)!
    expect(result.es).toBe('Quiero un café con azúcar.')
    expect(result.index).toBe(3)
    expect(result.wrong).toBe('con')
    expect(result.right).toBe('sin')
    expect(result.tokens[3]).toBe('con')
  })

  it('keeps a capital in the first slot', () => {
    const sentence = make({
      tokens: ['El', 'perro', 'ladra', '.'],
      cloze: [{ tokenIndex: 0, answer: 'El', lemma: 'el', hint: 'člen', distractors: ['la', 'Los', 'Las'] }],
    })
    expect(corrupt(sentence, 0, 0)!.es).toBe('La perro ladra.')
  })

  it('keeps the spacing around ¿ ¡ and punctuation', () => {
    const sentence = make({
      tokens: ['¿', 'Dónde', 'está', 'la', 'casa', '?'],
      cloze: [{ tokenIndex: 1, answer: 'Dónde', lemma: 'dónde', hint: 'kde', distractors: ['Cuándo', 'Cómo', 'Qué'] }],
    })
    expect(corrupt(sentence, 0, 0)!.es).toBe('¿Cuándo está la casa?')
  })

  it('refuses a missing blank, a missing distractor and a distractor of several words', () => {
    const sentence = make({
      tokens: ['Voy', 'a', 'casa', '.'],
      cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'predložka', distractors: ['en', 'a la', 'de'] }],
    })
    expect(corrupt(sentence, 3, 0)).toBeUndefined()
    expect(corrupt(sentence, 0, 7)).toBeUndefined()
    expect(corrupt(sentence, 0, 1)).toBeUndefined() // "a la" is two words
    expect(corrupt(sentence, 0, 0)).toBeDefined()
  })
})

describe('eligibility', () => {
  const base = { tokens: ['Voy', 'a', 'casa', '.'] }
  it('needs two one-word distractors that differ from the answer', () => {
    const ok = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en', 'de'] }] })
    const few = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en'] }] })
    const spaced = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en', 'a la'] }] })
    const same = make({ ...base, cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['A', 'en'] }] })
    expect(eligibleClozes(ok)).toEqual([0])
    expect(eligibleClozes(few)).toEqual([])
    expect(eligibleClozes(spaced)).toEqual([])
    expect(eligibleClozes(same)).toEqual([])
  })

  it('leaves a sentence with a digit out', () => {
    const digit = make({
      tokens: ['Tengo', '3', 'gatos', '.'],
      cloze: [{ tokenIndex: 0, answer: 'Tengo', lemma: 'tener', hint: 'tener · yo · presente', distractors: ['Tienes', 'Tiene'] }],
    })
    expect(eligibleClozes(digit)).toEqual([])
  })

  it('picks the distractor by r', () => {
    const sentence = make({
      tokens: ['Voy', 'a', 'casa', '.'],
      cloze: [{ tokenIndex: 1, answer: 'a', lemma: 'a', hint: 'x', distractors: ['en', 'a la', 'de', 'con'] }],
    })
    expect(swappableDistractors(sentence.cloze![0])).toEqual([0, 2, 3])
    expect(distractorFor(sentence, 0, 0)).toBe(0)
    expect(distractorFor(sentence, 0, 0.5)).toBe(2)
    expect(distractorFor(sentence, 0, 0.99)).toBe(3)
    expect(distractorFor(sentence, 5, 0.5)).toBeUndefined()
  })
})

describe('the data', () => {
  it('corrupts every eligible blank with every swappable distractor into a different sentence', () => {
    let checked = 0
    for (const sentence of sentences) {
      for (const index of eligibleClozes(sentence)) {
        for (const d of swappableDistractors(sentence.cloze![index])) {
          const result = corrupt(sentence, index, d)
          expect(result, `${sentence.id}#${index}:${d}`).toBeDefined()
          expect(result!.es).not.toBe(sentence.es)
          expect(rebuild(result!.tokens)).toBe(result!.es)
          expect(result!.tokens).toHaveLength(sentence.tokens.length)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(3000)
  })
})
```

```ts
// src/lib/swipe.test.ts
import { describe, expect, it } from 'vitest'
import { swipeDirection } from './swipe'

describe('swipeDirection', () => {
  it('needs 80 px', () => {
    expect(swipeDirection(80, 500)).toBe('right')
    expect(swipeDirection(-80, 500)).toBe('left')
    expect(swipeDirection(79, 500)).toBeNull()
  })
  it('takes a quick short fling', () => {
    expect(swipeDirection(45, 50)).toBe('right')
    expect(swipeDirection(-45, 50)).toBe('left')
    expect(swipeDirection(45, 300)).toBeNull()
    expect(swipeDirection(-30, 10)).toBeNull()
  })
  it('ignores a tap', () => {
    expect(swipeDirection(0, 80)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run src/lib/corrupt.test.ts src/lib/swipe.test.ts`
Expected: FAIL, "Failed to resolve import ./corrupt" / "./swipe".

- [ ] **Step 3: Implement**

```ts
// src/lib/swipe.ts
// When a drag of a card counts as an answer: far enough, or a short quick fling.

export const SWIPE_DISTANCE = 80
const FLING_DISTANCE = 40
const FLING_SPEED = 0.6 // px per ms

export function swipeDirection(dx: number, ms: number): 'left' | 'right' | null {
  const far = Math.abs(dx) >= SWIPE_DISTANCE
  const fling = Math.abs(dx) >= FLING_DISTANCE && Math.abs(dx) / Math.max(ms, 1) >= FLING_SPEED
  if (!far && !fling) return null
  return dx > 0 ? 'right' : 'left'
}
```

```ts
// src/lib/corrupt.ts
import type { Cloze, Sentence } from '../data/types'
import { spaceBefore } from './text'

// A sentence with one wrong word: the answer of a blank swapped for one of its distractors. "Wrong" means the
// Spanish no longer says what the Slovak translation says (spec 2026-11-03-new-exercise-types-design.md §2).

export interface Corrupted {
  tokens: string[] // the sentence with the swapped word
  index: number // the token that was swapped
  wrong: string // what stands there now
  right: string // the original token
  es: string // the corrupted sentence as text
}

export const stableHash = (text: string): number => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** The sentence text from its tokens: no space before .,?! and none after ¿¡. */
export const rebuild = (tokens: string[]): string => tokens.map((t, i) => (spaceBefore(tokens, i) ? ' ' : '') + t).join('')

/** Distractors that can stand in the answer's place: one word, and not the answer itself. */
export function swappableDistractors(cloze: Cloze): number[] {
  const out: number[] = []
  ;(cloze.distractors ?? []).forEach((d, i) => {
    if (!/\s/.test(d) && d.toLowerCase() !== cloze.answer.toLowerCase()) out.push(i)
  })
  return out
}

/** Blanks that can be corrupted: two swappable distractors, in a sentence without a digit. */
export function eligibleClozes(sentence: Sentence): number[] {
  if (/\d/.test(sentence.es)) return []
  return (sentence.cloze ?? []).flatMap((cloze, index) => (swappableDistractors(cloze).length >= 2 ? [index] : []))
}

/** One of the swappable distractors, chosen by `r` in [0, 1). */
export function distractorFor(sentence: Sentence, clozeIndex: number, r: number): number | undefined {
  const cloze = sentence.cloze?.[clozeIndex]
  if (!cloze) return undefined
  const options = swappableDistractors(cloze)
  return options[Math.min(options.length - 1, Math.floor(r * options.length))]
}

export function corrupt(sentence: Sentence, clozeIndex: number, distractorIndex: number): Corrupted | undefined {
  const cloze = sentence.cloze?.[clozeIndex]
  if (!cloze || !swappableDistractors(cloze).includes(distractorIndex)) return undefined
  const right = sentence.tokens[cloze.tokenIndex]
  let wrong = cloze.distractors![distractorIndex]
  // A capital stays in a capital slot: the sentence-initial blank.
  if (/^\p{Lu}/u.test(right) && /^\p{Ll}/u.test(wrong)) wrong = wrong.charAt(0).toUpperCase() + wrong.slice(1)
  const tokens = sentence.tokens.map((token, i) => (i === cloze.tokenIndex ? wrong : token))
  return { tokens, index: cloze.tokenIndex, wrong, right, es: rebuild(tokens) }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/corrupt.test.ts src/lib/swipe.test.ts`
Expected: PASS. If the data test finds a sentence whose `rebuild(tokens) !== es`, the validator should already have rejected it: read the failing ids before touching code.

- [ ] **Step 5: Commit**

```bash
git add src/lib/corrupt.ts src/lib/corrupt.test.ts src/lib/swipe.ts src/lib/swipe.test.ts
git commit -m "feat(exercises): corrupt a sentence with a distractor; swipe decision

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pravda / nepravda (`truefalse`), the first slice

**Files:**
- Modify: `src/lib/lesson.ts` (type, task, pool, grading, rebuild)
- Modify: `src/lib/tests.ts:44` (export `isExerciseType`)
- Modify: `src/features/exercises/ExercisePage.tsx` (no exam card for the new types)
- Modify: `src/features/exercises/exercises.ts` (card)
- Create: `src/features/exercises/tasks/TrueFalseView.tsx`
- Modify: `src/features/exercises/tasks/TaskView.tsx`, `src/features/exercises/FeedbackSheet.tsx`, `src/features/exercises/LessonPage.tsx`
- Modify: `src/lib/contentReport.ts`, `src/lib/tips.ts`, `api/report.ts:35`, `api/usage.ts:43`
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts`
- Test: `src/lib/lesson.test.ts`

**Interfaces:**
- Consumes: Task 1 (`corrupt`, `distractorFor`, `eligibleClozes`, `stableHash`, `Corrupted`, `SWIPE_DISTANCE`, `swipeDirection`).
- Produces:
  - `ExerciseType` gains `'truefalse'`
  - `interface TrueFalseTask { kind: 'truefalse'; itemId: string; sentence: Sentence; cloze: Cloze; truth: boolean; corrupted?: Corrupted }` (`corrupted` is set exactly when `truth` is false)
  - `trueFalseTask(sentence: Sentence, clozeIndex: number, truth: boolean, distractorIndex?: number): TrueFalseTask | undefined`
  - item ids `s123#0:t` and `s123#0:f2`; the learner's answer is the string `'true'` or `'false'`
  - `canRetry(task)` false for `truefalse`

- [ ] **Step 1: Write the failing tests**

In `src/lib/lesson.test.ts` add `trueFalseTask` to the import from `./lesson`, add `import { taskSubject } from './contentReport'`, add `'truefalse'` to the `it.each([...])` list of the first test of `describe('createLesson')`, and append:

```ts
describe('truefalse', () => {
  it('shows the sentence as it is, or with one word swapped', () => {
    const sentence = sentenceById.get('s372')! // Quiero un café sin azúcar.
    const real = trueFalseTask(sentence, 0, true)!
    const fake = trueFalseTask(sentence, 0, false, 0)!
    expect(real.itemId).toBe('s372#0:t')
    expect(real.corrupted).toBeUndefined()
    expect(fake.itemId).toBe('s372#0:f0')
    expect(fake.corrupted!.es).toBe('Quiero un café con azúcar.')
  })

  it('is graded by the swipe: right = pravda, left = nepravda', () => {
    const sentence = sentenceById.get('s372')!
    const real = trueFalseTask(sentence, 0, true)!
    const fake = trueFalseTask(sentence, 0, false, 0)!
    expect(gradeTask(real, 'true').correct).toBe(true)
    expect(gradeTask(real, 'false').correct).toBe(false)
    expect(gradeTask(fake, 'false').correct).toBe(true)
    expect(gradeTask(fake, 'true').correct).toBe(false)
    expect(gradeTask(fake, 'true').expected).toBe(sentence.es)
  })

  it('has no second try', () => {
    expect(canRetry(trueFalseTask(sentenceById.get('s372')!, 0, true)!)).toBe(false)
  })

  it('gives both truths in a lesson and one blank per sentence', () => {
    const tasks = createLesson({ type: 'truefalse' }, 40, seeded(5))
    const truths = tasks.map((t) => (t.kind === 'truefalse' ? t.truth : undefined))
    expect(truths).toContain(true)
    expect(truths).toContain(false)
    const ids = tasks.map((t) => (t.kind === 'truefalse' ? t.sentence.id : ''))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is rebuilt from its item id, and a stale id gives nothing', () => {
    for (const task of createLesson({ type: 'truefalse' }, 30, seeded(6))) {
      const again = taskFromItem('truefalse', task.itemId)
      expect(again?.itemId).toBe(task.itemId)
      if (task.kind === 'truefalse' && again?.kind === 'truefalse') expect(again.corrupted?.es).toBe(task.corrupted?.es)
    }
    for (const stale of ['nope#0:t', 's372#9:t', 's372#0:f9', 's372#0:x', 'garbage', '', 's372#0:f-1']) {
      expect(taskFromItem('truefalse', stale), stale).toBeUndefined()
    }
  })

  it('has a stable pool for numbered lessons, with both truths', () => {
    const a = getStablePool({ type: 'truefalse', level: 'A1' })
    const b = getStablePool({ type: 'truefalse', level: 'A1' })
    expect(itemIds(a)).toEqual(itemIds(b))
    const truths = new Set(a.map((t) => t.kind === 'truefalse' && t.truth))
    expect(truths.size).toBe(2)
    expect(availableCount({ type: 'truefalse', level: 'A1' })).toBeGreaterThanOrEqual(a.length)
  })

  it('is reported with a detail the server accepts', () => {
    for (const task of createLesson({ type: 'truefalse' }, 20, seeded(7))) {
      const subject = taskSubject(task)
      expect(subject.exercise).toBe('truefalse')
      expect(subject.target).toMatch(/^sentence:[a-z0-9ñ-]{1,60}$/)
      expect(subject.detail).toMatch(/^[a-z0-9:-]{0,40}$/)
      if (task.kind === 'truefalse') expect(subject.shown.es).toBe(task.corrupted?.es ?? task.sentence.es)
    }
  })

  it('is rebuilt from mistakes like any other type', () => {
    const task = createLesson({ type: 'truefalse' }, 1, seeded(8))[0]
    const lesson = mistakesLesson([{ exercise: 'truefalse', itemId: task.itemId, wrongCount: 1, lastWrongAt: 1 }])
    expect(itemIds(lesson)).toEqual([task.itemId])
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/lesson.test.ts -t truefalse`
Expected: FAIL (`trueFalseTask` is not exported; the it.each case has no `truefalse` branch).

- [ ] **Step 3: `lesson.ts` — type, task, pool, grading**

Add to the imports at the top of `src/lib/lesson.ts`:

```ts
import { corrupt, distractorFor, eligibleClozes, stableHash, type Corrupted } from './corrupt'
```

Replace line 11 with:

```ts
export type ExerciseType = 'cloze' | 'choice' | 'conjugation' | 'builder' | 'translation' | 'vocab' | 'dictation' | 'speaking' | 'truefalse'
```

After `SpeakingTask` add, and add `| TrueFalseTask` to the `Task` union:

```ts
export interface TrueFalseTask {
  kind: 'truefalse'
  itemId: string // "s123#0:t" (as it is) or "s123#0:f2" (the 3rd distractor swapped in)
  sentence: Sentence
  cloze: Cloze
  truth: boolean // whether the sentence on screen is the original
  corrupted?: Corrupted // set when truth is false
}
```

After `listeningSentences` add the pool of blanks that can be corrupted:

```ts
/** Blanks whose answer can be swapped for a distractor (src/lib/corrupt.ts). */
function corruptItems(filter: LessonFilter) {
  return sentences
    .filter((s) => matchesSentence(s, filter))
    .flatMap((sentence) => eligibleClozes(sentence).map((index) => ({ sentence, index, itemId: `${sentence.id}#${index}` })))
}
```

In `availableCount` add `case 'truefalse': return corruptItems(filter).length`.

Before `// ---------- lesson ----------` add the builder:

```ts
export function trueFalseTask(sentence: Sentence, clozeIndex: number, truth: boolean, distractorIndex = 0): TrueFalseTask | undefined {
  const cloze = sentence.cloze?.[clozeIndex]
  if (!cloze) return undefined
  const base = `${sentence.id}#${clozeIndex}`
  if (truth) return { kind: 'truefalse', itemId: `${base}:t`, sentence, cloze, truth }
  const corrupted = corrupt(sentence, clozeIndex, distractorIndex)
  return corrupted && { kind: 'truefalse', itemId: `${base}:f${distractorIndex}`, sentence, cloze, truth, corrupted }
}
```

In `createLesson` add before `case 'vocab'`:

```ts
    case 'truefalse':
      return takeLimited(order(corruptItems(filter), (i) => i.itemId), size, (i) => i.sentence.id, 1).flatMap((i) => {
        const task = trueFalseTask(i.sentence, i.index, random() < 0.5, distractorFor(i.sentence, i.index, random()))
        return task ? [task] : []
      })
```

In `seedFor` add `case 'truefalse': return 161803398`.

In `getStablePool` add before `case 'vocab'`:

```ts
    case 'truefalse': {
      const matching = sentences.filter((s) => matchesSentence(s, filter) && eligibleClozes(s).length > 0)
      return orderSentences(matching, 'truefalse').flatMap((sentence) => {
        const index = eligibleClozes(sentence)[0]
        const truth = stableHash(sentence.id) % 2 === 0
        const task = trueFalseTask(sentence, index, truth, distractorFor(sentence, index, stableHash(`${sentence.id}d`) / 2 ** 32))
        return task ? [task] : []
      })
    }
```

In `taskFromItem` add before `case 'vocab'`:

```ts
    case 'truefalse': {
      const found = /^([^#]+)#(\d+):(t|f(\d+))$/.exec(itemId)
      const sentence = found && sentenceById.get(found[1])
      if (!found || !sentence) return undefined
      return trueFalseTask(sentence, Number(found[2]), found[3] === 't', found[4] === undefined ? 0 : Number(found[4]))
    }
```

Replace the `EXERCISE_TYPES` line (617) with:

```ts
const EXERCISE_TYPES: ExerciseType[] = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'truefalse']
```

Replace `canRetry`:

```ts
/** Tasks that are answered once: Vyslovovanie has its own three recordings, a swipe is not tried twice. */
const NO_RETRY: Task['kind'][] = ['speaking', 'truefalse']

/** A wrong answer may be fixed and checked again; the task counts as wrong only when the learner gives up. */
export function canRetry(task: Task): boolean {
  return !NO_RETRY.includes(task.kind)
}
```

In `gradeTask` add before `case 'dictation'`:

```ts
    case 'truefalse':
      return exact((text === 'true') === task.truth, task.sentence.es)
```

- [ ] **Step 4: Run the lesson tests**

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: the `truefalse` cases fail only on `taskSubject` (next step); everything else PASSES.

- [ ] **Step 5: Report, tips, server allowlists**

`src/lib/contentReport.ts`, in `taskSubject` before `case 'builder':` add:

```ts
    case 'truefalse':
      // What was on screen: the swapped sentence for a false one.
      return {
        target: `sentence:${task.sentence.id}`,
        detail: task.itemId.split('#')[1] ?? '',
        exercise: task.kind,
        shown: { es: task.corrupted?.es ?? task.sentence.es, translation: sentenceTranslation(task.sentence) },
      }
```

`src/lib/tips.ts`, in `tipFor` change the first cases to:

```ts
    case 'cloze':
    case 'choice':
    case 'truefalse':
      return tipForCloze(task.sentence, task.cloze)
```

`api/report.ts:35` and `api/usage.ts:43`: add `'truefalse'` before `'word'` / `'mixed'`:

```ts
const EXERCISES = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'truefalse', 'word']
```

```ts
const TYPES = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'truefalse', 'mixed']
```

- [ ] **Step 6: i18n**

`src/i18n/sk.ts`, in `exercise.types` after `speaking`:

```ts
      truefalse: { label: 'Pravda alebo nie', description: 'Rozhodni, či je španielska veta správna.', instruction: 'Je španielska veta správna?' },
```

in `lesson.task` after `options`:

```ts
      tfCard: 'Veta na posúdenie',
      tfQuestion: 'Hovorí španielčina to isté ako slovenčina?',
      tfHint: 'Potiahni vetu doprava (pravda) alebo doľava (nepravda).',
      tfTrue: 'Pravda',
      tfFalse: 'Nepravda',
```

and in `lesson` (next to `savedToMistakes`):

```ts
    changedWord: (wrong: string, right: string) => `Vo vete bolo „${wrong}“ namiesto „${right}“.`,
```

`src/i18n/en.ts` mirrors them:

```ts
      truefalse: { label: 'True or false', description: 'Decide whether the Spanish sentence is right.', instruction: 'Is the Spanish sentence right?' },
```

```ts
      tfCard: 'Sentence to judge',
      tfQuestion: 'Does the Spanish say the same as the translation?',
      tfHint: 'Swipe the sentence right (true) or left (false).',
      tfTrue: 'True',
      tfFalse: 'False',
```

```ts
    changedWord: (wrong: string, right: string) => `The sentence had “${wrong}” instead of “${right}”.`,
```

- [ ] **Step 7: The view**

```tsx
// src/features/exercises/tasks/TrueFalseView.tsx
import { Check, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '../../../components/Button'
import { useT } from '../../../i18n'
import type { Answer, TrueFalseTask } from '../../../lib/lesson'
import { sentenceTranslation } from '../../../lib/localized'
import { SWIPE_DISTANCE, swipeDirection } from '../../../lib/swipe'
import type { Status } from './status'

interface TrueFalseViewProps {
  task: TrueFalseTask
  onAnswer: (answer: Answer) => void
  onSubmit: (value?: Answer) => void
  status?: Status
}

const BORDER: Record<Status | 'open', string> = {
  open: 'border-line',
  correct: 'border-leaf bg-leaf/10',
  warn: 'border-amber bg-amber/10',
  wrong: 'border-error bg-error/10',
}

/** The sentence is a card: swipe it right for pravda, left for nepravda, or press a button. */
export function TrueFalseView({ task, onAnswer, onSubmit, status }: TrueFalseViewProps) {
  const text = useT().lesson.task
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; at: number } | null>(null)
  const locked = status !== undefined

  const answer = (value: 'true' | 'false') => {
    onAnswer(value)
    onSubmit(value)
  }
  const stamp = Math.min(Math.abs(dx) / SWIPE_DISTANCE, 1)

  return (
    <div className="space-y-5">
      <p className="text-ink-muted">{text.tfQuestion}</p>
      <div
        role="group"
        aria-label={text.tfCard}
        className={`relative touch-pan-y rounded-card border-2 bg-surface p-5 select-none ${BORDER[status ?? 'open']}`}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 25}deg)`, transition: dx === 0 ? 'transform 150ms' : undefined }}
        onPointerDown={(e) => {
          if (locked) return
          start.current = { x: e.clientX, at: e.timeStamp }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (start.current) setDx(e.clientX - start.current.x)
        }}
        onPointerUp={(e) => {
          const from = start.current
          start.current = null
          setDx(0)
          if (!from) return
          const direction = swipeDirection(e.clientX - from.x, e.timeStamp - from.at)
          if (direction) answer(direction === 'right' ? 'true' : 'false')
        }}
        onPointerCancel={() => {
          start.current = null
          setDx(0)
        }}
      >
        <span
          aria-hidden
          className="absolute top-3 right-3 rounded-lg border-2 border-leaf px-2 py-0.5 text-sm font-bold tracking-widest text-leaf uppercase"
          style={{ opacity: dx > 0 ? stamp : 0 }}
        >
          {text.tfTrue}
        </span>
        <span
          aria-hidden
          className="absolute top-3 left-3 rounded-lg border-2 border-error px-2 py-0.5 text-sm font-bold tracking-widest text-error uppercase"
          style={{ opacity: dx < 0 ? stamp : 0 }}
        >
          {text.tfFalse}
        </span>
        <p lang="es" className="pt-6 font-serif text-2xl leading-snug">
          {task.corrupted?.es ?? task.sentence.es}
        </p>
        <p className="mt-3 text-ink-muted">{sentenceTranslation(task.sentence)}</p>
      </div>
      {!locked && <p className="text-center text-sm text-ink-muted">{text.tfHint}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" icon={X} onClick={() => answer('false')} disabled={locked}>
          {text.tfFalse}
        </Button>
        <Button variant="secondary" icon={Check} onClick={() => answer('true')} disabled={locked}>
          {text.tfTrue}
        </Button>
      </div>
    </div>
  )
}
```

`TaskView.tsx`: import `TrueFalseView` and add before `case 'vocab'`:

```tsx
    case 'truefalse':
      return <TrueFalseView task={task} onAnswer={onAnswer} onSubmit={onSubmit} status={status} />
```

- [ ] **Step 8: Card, exam guard, lesson page, feedback**

`src/features/exercises/exercises.ts`: add `ThumbsUp` to the lucide import and, after the `speaking` line, `exercise('truefalse', ThumbsUp),`.

`src/lib/tests.ts:44`: change `const isExerciseType` to `export const isExerciseType`. In `src/features/exercises/ExercisePage.tsx` add `isExerciseType` to the existing named import from `'../../lib/tests'` and change the exam condition to:

```ts
  const exerciseTest: TestId | undefined =
    group === 'all' && isExerciseType(filter.type) && TEST_LEVELS.includes(filter.level as TestLevel) && totalLessons > 0
```

`src/features/exercises/LessonPage.tsx`: add below `emptyAnswer`:

```ts
/** Tasks that submit by themselves (a swipe, a tap): no "Skontrolovať" under them. */
const AUTO_SUBMIT: Task['kind'][] = ['truefalse']
```

and change the last branch of the footer ternary (`) : ( // Rides on top of the open phone keyboard…`) to start with `) : AUTO_SUBMIT.includes(task.kind) ? null : (`.

`src/features/exercises/FeedbackSheet.tsx`: in `reference()` add `case 'truefalse':` to the `cloze`/`choice` group; after the `irregularNote` line add

```tsx
  if (task.kind === 'truefalse' && task.corrupted) notes.push(<>{text.changedWord(task.corrupted.wrong, task.corrupted.right)}</>)
```

- [ ] **Step 9: Typecheck and test**

Run: `npx tsc -b` — Expected: no errors (if a switch elsewhere is not exhaustive, add `truefalse` next to `choice`/`cloze` there).
Run: `npm test` — Expected: all PASS (includes `api/_report.test.ts`, `api/_usage.test.ts`).
Run: `npm run validate:data` — Expected: OK.

- [ ] **Step 10: Commit**

```bash
git add src/lib/lesson.ts src/lib/lesson.test.ts src/lib/tests.ts src/lib/contentReport.ts src/lib/tips.ts api/report.ts api/usage.ts src/i18n/sk.ts src/i18n/en.ts src/features/exercises/exercises.ts src/features/exercises/ExercisePage.tsx src/features/exercises/LessonPage.tsx src/features/exercises/FeedbackSheet.tsx src/features/exercises/tasks/TaskView.tsx src/features/exercises/tasks/TrueFalseView.tsx
git commit -m "feat(exercises): pravda/nepravda with a swipeable card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Nájdi chybu (`findmistake`)

**Files:**
- Modify: `src/lib/lesson.ts`, `src/lib/contentReport.ts`, `src/lib/tips.ts`, `api/report.ts`, `api/usage.ts`
- Modify: `src/features/exercises/exercises.ts`, `LessonPage.tsx`, `FeedbackSheet.tsx`, `tasks/TaskView.tsx`
- Create: `src/features/exercises/tasks/FindMistakeView.tsx`
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts`
- Test: `src/lib/lesson.test.ts`

**Interfaces:**
- Consumes: Task 1, Task 2 (`NO_RETRY`, `AUTO_SUBMIT`, `corruptItems`, `ChoiceOptions`).
- Produces:
  - `ExerciseType` gains `'findmistake'`
  - `interface FindMistakeTask { kind: 'findmistake'; itemId: string; sentence: Sentence; cloze: Cloze; corrupted: Corrupted; options: string[] }` (`options` = the right word plus up to 3 other distractors, shuffled)
  - `findMistakeTask(sentence: Sentence, clozeIndex: number, distractorIndex: number, random: Random): FindMistakeTask | undefined`; item id `s123#0:2` (blank 0, distractor 2)
  - the answer is `string[]` `[tokenIndex, fix]`; `fix === ''` means the learner gave up after two wrong taps

- [ ] **Step 1: Write the failing tests**

In `src/lib/lesson.test.ts` add `findMistakeTask` to the import from `./lesson`, add `'findmistake'` to the `it.each` list of `createLesson`, and append:

```ts
describe('findmistake', () => {
  const sentence = sentenceById.get('s372')! // Quiero un café sin azúcar. (sin: con, para, por)
  const task = () => findMistakeTask(sentence, 0, 0, () => 0.5)!

  it('swaps one word and offers the right one among the options', () => {
    const t = task()
    expect(t.itemId).toBe('s372#0:0')
    expect(t.corrupted.index).toBe(3)
    expect(t.corrupted.right).toBe('sin')
    expect(t.options).toContain('sin')
    expect(t.options).not.toContain('con') // the word that stands in the sentence now
    expect(new Set(t.options).size).toBe(t.options.length)
    expect(t.options.length).toBeLessThanOrEqual(4)
  })

  it('is right only with the right word and the right fix', () => {
    const t = task()
    expect(gradeTask(t, ['3', 'sin']).correct).toBe(true)
    expect(gradeTask(t, ['3', 'para']).correct).toBe(false)
    expect(gradeTask(t, ['1', 'sin']).correct).toBe(false)
    expect(gradeTask(t, ['1', '']).correct).toBe(false) // gave up after two wrong taps
    expect(gradeTask(t, '').correct).toBe(false)
    expect(gradeTask(t, ['3', 'sin']).expected).toBe(sentence.es)
  })

  it('has no second try and reshuffles its options', () => {
    const t = task()
    expect(canRetry(t)).toBe(false)
    const again = retryTasks([t], seeded(3))[0]
    expect(again.kind === 'findmistake' && [...again.options].sort()).toEqual([...t.options].sort())
  })

  it('is rebuilt from its item id, and a stale id gives nothing', () => {
    for (const t of createLesson({ type: 'findmistake' }, 30, seeded(9))) {
      const again = taskFromItem('findmistake', t.itemId)
      expect(again?.itemId).toBe(t.itemId)
      if (t.kind === 'findmistake' && again?.kind === 'findmistake') expect(again.corrupted.es).toBe(t.corrupted.es)
    }
    for (const stale of ['nope#0:0', 's372#9:0', 's372#0:9', 's372#0', 'garbage', '', 's372#0:t']) {
      expect(taskFromItem('findmistake', stale), stale).toBeUndefined()
    }
  })

  it('has a stable pool and is reported with a detail the server accepts', () => {
    const a = getStablePool({ type: 'findmistake', level: 'A1' })
    expect(itemIds(a)).toEqual(itemIds(getStablePool({ type: 'findmistake', level: 'A1' })))
    expect(a.length).toBeGreaterThan(10)
    for (const t of createLesson({ type: 'findmistake' }, 20, seeded(10))) {
      const subject = taskSubject(t)
      expect(subject.exercise).toBe('findmistake')
      expect(subject.detail).toMatch(/^[a-z0-9:-]{0,40}$/)
      if (t.kind === 'findmistake') expect(subject.shown.es).toBe(t.corrupted.es)
    }
  })
})
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/lesson.test.ts -t findmistake`
Expected: FAIL (`findMistakeTask` is not exported).

- [ ] **Step 3: `lesson.ts`**

`ExerciseType` gets `| 'findmistake'`. After `TrueFalseTask` add (and `| FindMistakeTask` in `Task`):

```ts
export interface FindMistakeTask {
  kind: 'findmistake'
  itemId: string // "s123#0:2": blank 0, distractor 2 swapped in
  sentence: Sentence
  cloze: Cloze
  corrupted: Corrupted
  options: string[] // the right word and up to 3 others, shuffled
}
```

Add next to `trueFalseTask`:

```ts
export function findMistakeTask(sentence: Sentence, clozeIndex: number, distractorIndex: number, random: Random): FindMistakeTask | undefined {
  const cloze = sentence.cloze?.[clozeIndex]
  const corrupted = cloze && corrupt(sentence, clozeIndex, distractorIndex)
  if (!cloze || !corrupted) return undefined
  const others = (cloze.distractors ?? []).filter((_, i) => i !== distractorIndex)
  return {
    kind: 'findmistake',
    itemId: `${sentence.id}#${clozeIndex}:${distractorIndex}`,
    sentence,
    cloze,
    corrupted,
    options: shuffle([corrupted.right, ...others].slice(0, 4), random),
  }
}
```

`availableCount`: `case 'findmistake':` joins `case 'truefalse':`. `seedFor`: `case 'findmistake': return 577215664`. `createLesson`, before `case 'vocab'`:

```ts
    case 'findmistake':
      return takeLimited(order(corruptItems(filter), (i) => i.itemId), size, (i) => i.sentence.id, 1).flatMap((i) => {
        const d = distractorFor(i.sentence, i.index, random())
        const task = d === undefined ? undefined : findMistakeTask(i.sentence, i.index, d, random)
        return task ? [task] : []
      })
```

`getStablePool`, before `case 'vocab'`:

```ts
    case 'findmistake': {
      const matching = sentences.filter((s) => matchesSentence(s, filter) && eligibleClozes(s).length > 0)
      return orderSentences(matching, 'findmistake').flatMap((sentence) => {
        const index = eligibleClozes(sentence)[0]
        const d = distractorFor(sentence, index, stableHash(`${sentence.id}d`) / 2 ** 32)
        const task = d === undefined ? undefined : findMistakeTask(sentence, index, d, () => 0.5)
        return task ? [task] : []
      })
    }
```

`taskFromItem`, before `case 'vocab'`:

```ts
    case 'findmistake': {
      const found = /^([^#]+)#(\d+):(\d+)$/.exec(itemId)
      const sentence = found && sentenceById.get(found[1])
      if (!found || !sentence) return undefined
      return findMistakeTask(sentence, Number(found[2]), Number(found[3]), random)
    }
```

`EXERCISE_TYPES` gets `'findmistake'`; `NO_RETRY` becomes `['speaking', 'truefalse', 'findmistake']`; in `retryTasks` add `if (task.kind === 'findmistake') return { ...task, options: shuffle(task.options, random) }`; `gradeTask`, before `case 'dictation'`:

```ts
    case 'findmistake': {
      const [tapped = '', fix = ''] = Array.isArray(answer) ? answer : []
      return exact(Number(tapped) === task.corrupted.index && tapped !== '' && fix === task.corrupted.right, task.sentence.es)
    }
```

- [ ] **Step 4: Run the lesson tests**

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: the `findmistake` cases fail only on `taskSubject`; the rest PASS.

- [ ] **Step 5: Report, tips, allowlists, i18n**

`contentReport.ts`, in `taskSubject` next to the `truefalse` case:

```ts
    case 'findmistake':
      return {
        target: `sentence:${task.sentence.id}`,
        detail: task.itemId.split('#')[1] ?? '',
        exercise: task.kind,
        shown: { es: task.corrupted.es, translation: sentenceTranslation(task.sentence) },
      }
```

and in `learnerAnswerText`, before the builder branch:

```ts
  if (task.kind === 'findmistake' && Array.isArray(answer)) return `${task.corrupted.tokens[Number(answer[0])] ?? ''} → ${answer[1] ?? ''}`.trim()
```

`tips.ts`: add `case 'findmistake':` to the `cloze`/`choice`/`truefalse` group. `api/report.ts` and `api/usage.ts`: add `'findmistake'` after `'truefalse'`.

`sk.ts` `exercise.types`:

```ts
      findmistake: { label: 'Nájdi chybu', description: 'Nájdi zlé slovo vo vete a oprav ho.', instruction: 'Nájdi chybu vo vete' },
```

`lesson.task`:

```ts
      fmTap: 'Klepni na slovo, ktoré je zle.',
      fmMissed: 'To nie je ono, skús ešte raz.',
      fmFix: 'Čo tam má byť?',
```

`en.ts`:

```ts
      findmistake: { label: 'Find the mistake', description: 'Find the wrong word in a sentence and fix it.', instruction: 'Find the mistake in the sentence' },
```

```ts
      fmTap: 'Tap the word that is wrong.',
      fmMissed: 'Not that one, try again.',
      fmFix: 'What should it be?',
```

- [ ] **Step 6: The view**

```tsx
// src/features/exercises/tasks/FindMistakeView.tsx
import { Fragment, useState } from 'react'
import { useT } from '../../../i18n'
import type { Answer, FindMistakeTask } from '../../../lib/lesson'
import { sentenceTranslation } from '../../../lib/localized'
import { playSound } from '../../../lib/sound'
import { spaceBefore } from '../../../lib/text'
import { ChoiceOptions } from './ChoiceOptions'
import type { Status } from './status'

interface FindMistakeViewProps {
  task: FindMistakeTask
  onSubmit: (value?: Answer) => void
  status?: Status
}

const PUNCTUATION = /^[¿?¡!.,;:]$/
const MAX_MISSES = 2

/** Tap the wrong word (two wrong taps end the task), then pick what should stand there. */
export function FindMistakeView({ task, onSubmit, status }: FindMistakeViewProps) {
  const text = useT().lesson.task
  const [found, setFound] = useState(false)
  const [missed, setMissed] = useState<number[]>([])
  const [choice, setChoice] = useState('')
  const graded = status !== undefined
  const { tokens, index } = task.corrupted

  const tap = (i: number) => {
    if (graded || found || missed.includes(i)) return
    if (i === index) {
      playSound('tap')
      setFound(true)
      return
    }
    playSound('almost')
    const next = [...missed, i]
    setMissed(next)
    if (next.length >= MAX_MISSES) onSubmit([String(i), '']) // gave up: no fix
  }

  return (
    <div className="space-y-5">
      <p className="text-xl leading-snug font-medium">{sentenceTranslation(task.sentence)}</p>
      <p lang="es" className="font-serif text-2xl leading-loose">
        {tokens.map((token, i) => (
          <Fragment key={i}>
            {spaceBefore(tokens, i) && ' '}
            {PUNCTUATION.test(token) ? (
              token
            ) : (
              <button
                type="button"
                onClick={() => tap(i)}
                disabled={graded && i !== index}
                className={`min-h-11 rounded-lg px-1.5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-brick ${
                  i === index && (found || graded) ? 'bg-error/15 font-semibold text-error underline' : missed.includes(i) ? 'text-ink-muted line-through' : 'hover:bg-surface-2'
                }`}
              >
                {token}
              </button>
            )}
          </Fragment>
        ))}
      </p>
      {!found && !graded && <p className="text-sm text-ink-muted">{missed.length > 0 ? text.fmMissed : text.fmTap}</p>}
      {found && (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">{text.fmFix}</p>
          <ChoiceOptions
            options={task.options}
            selected={choice}
            onSelect={(option) => {
              setChoice(option)
              onSubmit([String(index), option])
            }}
            correctAnswer={graded ? task.corrupted.right : undefined}
          />
        </div>
      )}
    </div>
  )
}
```

`TaskView.tsx`: import it and add `case 'findmistake': return <FindMistakeView task={task} onSubmit={onSubmit} status={status} />`.

- [ ] **Step 7: Card, lesson page, feedback**

`exercises.ts`: add `SearchCheck` to the lucide import and `exercise('findmistake', SearchCheck),` after `truefalse`.

`LessonPage.tsx`: `emptyAnswer` becomes

```ts
const emptyAnswer = (task?: Task): Answer => (task?.kind === 'builder' || task?.kind === 'findmistake' ? [] : '')
```

`AUTO_SUBMIT` becomes `['truefalse', 'findmistake']`, and `isAnswered` becomes

```ts
  const isAnswered = (value: Answer) =>
    task
      ? task.kind === 'builder'
        ? Array.isArray(value) && value.length === task.tiles.length && value.every(Boolean)
        : task.kind === 'findmistake'
          ? Array.isArray(value) && value.length === 2 && value[0] !== ''
          : typeof value === 'string' && value.trim() !== ''
      : false
```

`FeedbackSheet.tsx`: add `case 'findmistake':` to the `cloze`/`choice`/`truefalse` group of `reference()`, and change the note line from Task 2 to

```tsx
  if ((task.kind === 'truefalse' || task.kind === 'findmistake') && task.corrupted) {
    notes.push(<>{text.changedWord(task.corrupted.wrong, task.corrupted.right)}</>)
  }
```

- [ ] **Step 8: Typecheck, test, commit**

Run: `npx tsc -b` (no errors), `npm test` (all PASS), `npm run validate:data` (OK).

```bash
git add src/lib/lesson.ts src/lib/lesson.test.ts src/lib/contentReport.ts src/lib/tips.ts api/report.ts api/usage.ts src/i18n/sk.ts src/i18n/en.ts src/features/exercises/exercises.ts src/features/exercises/LessonPage.tsx src/features/exercises/FeedbackSheet.tsx src/features/exercises/tasks/TaskView.tsx src/features/exercises/tasks/FindMistakeView.tsx
git commit -m "feat(exercises): find the mistake in a sentence

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Priraďovanie (`matching`)

**Files:**
- Modify: `src/lib/lesson.ts`, `src/lib/contentReport.ts`, `src/lib/tips.ts`, `api/report.ts`, `api/usage.ts`
- Modify: `src/features/exercises/exercises.ts`, `ExercisePage.tsx`, `LessonPage.tsx`, `FeedbackSheet.tsx`, `taskSummary.ts`, `tasks/TaskView.tsx`
- Create: `src/features/exercises/tasks/MatchingView.tsx`
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts`
- Test: `src/lib/lesson.test.ts`

**Interfaces:**
- Consumes: Tasks 2–3 (`NO_RETRY`, `AUTO_SUBMIT`), existing `vocabWords`, `wordById`, `wordTranslations`, `withArticle`, `translationKey`, `LEVEL_ORDER`, `seededRandom`, `shuffle`.
- Produces:
  - `ExerciseType` gains `'matching'`; `MATCHING_SIZE = 5`, `MATCHING_MAX_WRONG = 2`
  - `lessonSizeOf(type: ExerciseType): number` (4 for matching, `LESSON_SIZE` otherwise)
  - `interface MatchingPair { word: Word; es: string; sk: string }`
  - `interface MatchingTask { kind: 'matching'; itemId: string; pairs: MatchingPair[]; rightOrder: number[] }` (`pairs` is the left column; `rightOrder` is the order of the right column as indices into `pairs`; both shuffled)
  - `matchingTask(words: Word[], random: Random): MatchingTask`; item id `m:id1,id2,id3,id4,id5` (ids sorted)
  - the answer is the string `'m:'` + the ids of the words paired wrongly, one per wrong pairing, comma-separated (`'m:'` alone = no mistake); the round is right with at most `MATCHING_MAX_WRONG` wrong pairings; `Grade.misplaced` lists the distinct word ids paired wrongly

- [ ] **Step 1: Write the failing tests**

In `src/lib/lesson.test.ts` add `lessonSizeOf`, `matchingTask`, `MATCHING_MAX_WRONG` and `MATCHING_SIZE` to the import from `./lesson`, extend the `it.each` list of `createLesson` with `'matching'` **but change the expected length** — replace the test body's `LESSON_SIZE` by `lessonSizeOf(type)`:

```ts
  it.each(['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'truefalse', 'findmistake', 'matching'] as const)('builds a %s lesson of lessonSizeOf unique items', (type) => {
    const size = lessonSizeOf(type)
    const tasks = createLesson({ type }, size, seeded(1))
    expect(tasks).toHaveLength(size)
    expect(new Set(itemIds(tasks)).size).toBe(size)
    expect(tasks.every((t) => t.kind === type)).toBe(true)
  })
```

and append:

```ts
describe('matching', () => {
  const round = () => ['casa', 'perro', 'agua', 'libro', 'mesa'].map((id) => wordById.get(id)!)

  it('has 5 pairs, a left and a right column in different orders, and a sorted item id', () => {
    const t = matchingTask(round(), seeded(2))
    expect(t.pairs).toHaveLength(MATCHING_SIZE)
    expect([...t.rightOrder].sort()).toEqual([0, 1, 2, 3, 4])
    expect(t.itemId).toBe(`m:${round().map((w) => w.id).sort().join(',')}`)
    expect(t.pairs.every((p) => p.sk.length > 0 && p.es.endsWith(p.word.es))).toBe(true)
  })

  it('is right with at most two wrong pairings and lists the words that were paired wrong', () => {
    const t = matchingTask(round(), seeded(3))
    expect(gradeTask(t, 'm:').correct).toBe(true)
    const two = gradeTask(t, 'm:casa,casa')
    expect(two.correct).toBe(true)
    expect(two.misplaced).toEqual(['casa'])
    const three = gradeTask(t, 'm:casa,perro,agua')
    expect(three.correct).toBe(false)
    expect(three.misplaced).toEqual(['casa', 'perro', 'agua'])
    expect(MATCHING_MAX_WRONG).toBe(2)
    expect(gradeTask(t, '').correct).toBe(false) // not an answer of this type
  })

  it('has no second try and reshuffles on retry', () => {
    const t = matchingTask(round(), seeded(4))
    expect(canRetry(t)).toBe(false)
    const again = retryTasks([t], seeded(5))[0]
    expect(again.itemId).toBe(t.itemId)
    expect(again.kind === 'matching' && again.pairs.map((p) => p.word.id).sort()).toEqual(t.pairs.map((p) => p.word.id).sort())
  })

  it('is rebuilt from its item id, and a stale id gives nothing', () => {
    const t = matchingTask(round(), seeded(6))
    expect(taskFromItem('matching', t.itemId)?.itemId).toBe(t.itemId)
    for (const stale of ['m:', 'm:casa', 'm:casa,nope', 'casa,perro', '', 'm:nope1,nope2']) {
      expect(taskFromItem('matching', stale), stale).toBeUndefined()
    }
  })

  it('makes rounds of 5 distinct words with different first translations, from one level and topic', () => {
    const pool = getStablePool({ type: 'matching', topic: 'all' })
    expect(pool.length).toBeGreaterThan(20)
    for (const t of pool) {
      if (t.kind !== 'matching') throw new Error('wrong kind')
      const words = t.pairs.map((p) => p.word)
      expect(new Set(words.map((w) => w.id)).size).toBe(MATCHING_SIZE)
      expect(new Set(words.map((w) => w.sk[0].toLowerCase())).size).toBe(MATCHING_SIZE)
      expect(new Set(words.map((w) => w.level)).size).toBe(1)
      expect(new Set(words.map((w) => w.topics[0])).size).toBe(1)
    }
  })

  it('gives lessons of 4 rounds and survives a topic with too few words', () => {
    const filter = { type: 'matching', topic: 'food', level: 'A1' } as const
    const pool = getStablePool(filter)
    expect(createNumberedLesson(filter, 1).length).toBe(Math.min(pool.length, lessonSizeOf('matching')))
    expect(getNumberedLessonCount(filter)).toBe(Math.ceil(pool.length / lessonSizeOf('matching')) || 0)
    expect(getStablePool({ type: 'matching', topic: 'nope' })).toEqual([])
    expect(getNumberedLessonCount({ type: 'matching', topic: 'nope' })).toBe(0)
  })

  it('is reported by its first word, with a detail the server accepts', () => {
    const subject = taskSubject(matchingTask(round(), seeded(7)))
    expect(subject.exercise).toBe('matching')
    expect(subject.target).toMatch(/^word:[a-z0-9ñ-]{1,60}$/)
    expect(subject.detail).toMatch(/^[a-z0-9:-]{0,40}$/)
  })
})
```

(`wordById` is already imported at the top of `lesson.test.ts`. The word ids `casa`, `perro`, `agua`, `libro`, `mesa` exist in the data; if `validate:data` or the first run says one is missing, swap it for any 5 ids from `src/data/words/` with different first translations.)

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/lib/lesson.test.ts -t matching`
Expected: FAIL (`matchingTask`, `lessonSizeOf` are not exported).

- [ ] **Step 3: `lesson.ts`**

`ExerciseType` gets `| 'matching'`. Under `export const LESSON_SIZE = 10` add:

```ts
export const MATCHING_SIZE = 5 // pairs in a round
export const MATCHING_MAX_WRONG = 2 // wrong pairings a round may have and still count as right

/** A matching lesson is 4 rounds of 5 pairs; every other lesson is LESSON_SIZE tasks. */
export const lessonSizeOf = (type: ExerciseType) => (type === 'matching' ? 4 : LESSON_SIZE)
```

After `FindMistakeTask` add (and `| MatchingTask` in `Task`):

```ts
export interface MatchingPair {
  word: Word
  es: string // with its article: "la casa"
  sk: string // the first translation
}

export interface MatchingTask {
  kind: 'matching'
  itemId: string // "m:" + the word ids, sorted
  pairs: MatchingPair[] // the left column, shuffled
  rightOrder: number[] // the right column: indices into pairs, shuffled
}
```

After `withArticle`/`translationKey` (they are defined in the vocab section) add:

```ts
function matchingWords(filter: LessonFilter): Word[] {
  const all = !filter.topic || filter.topic === 'all'
  return vocabWords.filter((w) => {
    const sk = wordTranslations(w)[0]
    // Long phrases do not fit a chip.
    return (all || w.topics.includes(filter.topic!)) && (!filter.level || w.level === filter.level) && w.es.length <= 24 && !!sk && sk.length <= 28
  })
}

/** Rounds of MATCHING_SIZE words of one level and topic, no two with the same first translation. */
function matchingRounds(words: Word[], topic?: string): Word[][] {
  const groups = new Map<string, Word[]>()
  for (const word of words) {
    const key = `${word.level}|${topic && topic !== 'all' ? topic : word.topics[0]}`
    groups.set(key, [...(groups.get(key) ?? []), word])
  }
  const rounds: Word[][] = []
  for (const key of [...groups.keys()].sort()) {
    let rest = groups.get(key)!
    while (rest.length >= MATCHING_SIZE) {
      const round: Word[] = []
      const taken = new Set<string>()
      const left: Word[] = []
      for (const word of rest) {
        const first = translationKey(word)
        if (round.length < MATCHING_SIZE && !taken.has(first)) {
          round.push(word)
          taken.add(first)
        } else left.push(word)
      }
      if (round.length < MATCHING_SIZE) break
      rounds.push(round)
      rest = left
    }
  }
  return rounds
}

export function matchingTask(words: Word[], random: Random): MatchingTask {
  const pairs = shuffle(
    words.map((word): MatchingPair => ({ word, es: withArticle(word), sk: wordTranslations(word)[0] })),
    random,
  )
  return {
    kind: 'matching',
    itemId: `m:${words.map((w) => w.id).sort().join(',')}`,
    pairs,
    rightOrder: shuffle(
      pairs.map((_, i) => i),
      random,
    ),
  }
}
```

`availableCount`: `case 'matching': return matchingRounds(matchingWords(filter), filter.topic).length`.

`createLesson`: change the signature default to `size = lessonSizeOf(filter.type)` and add before `case 'vocab'`:

```ts
    case 'matching': {
      const rounds = matchingRounds(shuffle(matchingWords(filter), random), filter.topic).map((words) => matchingTask(words, random))
      return order(rounds, (t) => t.itemId).slice(0, size)
    }
```

`seedFor`: `case 'matching': return 141421356`. `getStablePool`, before `case 'vocab'`:

```ts
    case 'matching': {
      const ordered = LEVEL_NAMES.flatMap((level) =>
        shuffle(
          matchingWords(filter).filter((w) => w.level === level).sort((a, b) => a.id.localeCompare(b.id)),
          seededRandom(seedFor('matching') + LEVEL_ORDER[level]),
        ),
      )
      return matchingRounds(ordered, filter.topic).map((words) => matchingTask(words, () => 0.5))
    }
```

and next to `LEVEL_ORDER` add `const LEVEL_NAMES: Level[] = ['A1', 'A2', 'B1', 'B2']`.

`getNumberedLessonCount` and `createNumberedLesson`: introduce `const size = lessonSizeOf(filter.type)` at the top of each and replace every `LESSON_SIZE` in their bodies by `size`.

`taskFromItem`, before `case 'vocab'`:

```ts
    case 'matching': {
      if (!itemId.startsWith('m:')) return undefined
      const words = itemId.slice(2).split(',').map((id) => wordById.get(id))
      if (words.length < 2 || words.some((w) => !w || w.drill === false)) return undefined
      return matchingTask(words as Word[], random)
    }
```

`EXERCISE_TYPES` gets `'matching'`; `NO_RETRY` becomes `['speaking', 'truefalse', 'findmistake', 'matching']`; `retryTasks` gets `if (task.kind === 'matching') return matchingTask(task.pairs.map((p) => p.word), random)`; `taskLevel` gets `case 'matching': return task.pairs[0].word.level`; `gradeTask`, before `case 'dictation'`:

```ts
    case 'matching': {
      const wrong = text.startsWith('m:') ? text.slice(2).split(',').filter(Boolean) : []
      const expected = task.pairs.map((p) => `${p.es} = ${p.sk}`).join('\n')
      const grade = exact(text.startsWith('m:') && wrong.length <= MATCHING_MAX_WRONG, expected)
      return wrong.length === 0 ? grade : { ...grade, misplaced: [...new Set(wrong)] }
    }
```

- [ ] **Step 4: Run the lesson tests**

Run: `npx vitest run src/lib/lesson.test.ts`
Expected: matching cases fail only on `taskSubject`; the rest PASS. (The old "unique items" test now also covers `truefalse` and `findmistake` with `lessonSizeOf`.)

- [ ] **Step 5: Use `lessonSizeOf` in the pages**

`src/features/exercises/ExercisePage.tsx`: replace `LESSON_SIZE` in the import by `lessonSizeOf` and change lines 56-57 to

```ts
  const size = lessonSizeOf(filter.type)
  const totalLessons = Math.ceil(poolSize / size)
  const lessonSize = Math.min(poolSize, size)
```

`src/features/exercises/LessonPage.tsx` line 98: `return createLesson(filter, lessonSizeOf(filter.type), Math.random, await loadSeenCounts(filter.type))`, and add `lessonSizeOf` to the import from `../../lib/lesson` (`LESSON_SIZE` stays imported for `mistakesLesson`).

- [ ] **Step 6: Report, summary, tips, allowlists**

`contentReport.ts`, in `taskSubject`:

```ts
    case 'matching':
      return {
        target: `word:${task.pairs[0].word.id}`,
        detail: '',
        exercise: task.kind,
        shown: { es: task.pairs.map((p) => p.es).join(', '), translation: task.pairs.map((p) => p.sk).join(', ') },
      }
```

`taskSummary.ts`, before `default:`:

```ts
    case 'matching':
      return { prompt: task.pairs.map((p) => p.sk).join(' · '), answer: task.pairs.map((p) => p.es).join(' · ') }
```

`tips.ts`: `case 'matching':` joins `case 'vocab': return undefined`. `api/report.ts` and `api/usage.ts`: add `'matching'` after `'findmistake'`.

- [ ] **Step 7: i18n**

`sk.ts` `exercise.types`:

```ts
      matching: { label: 'Priraďovanie', description: 'Spoj španielske slová s ich významom.', instruction: 'Spoj dvojice' },
```

`lesson.task`:

```ts
      matchEs: 'Španielsky',
      matchSk: 'Slovensky',
      matchHint: 'Klepni na slovo a potom na jeho preklad.',
```

`lesson`:

```ts
    matchWrongNote: (words: string) => `Pomýlil si sa pri: ${words}.`,
```

`en.ts`:

```ts
      matching: { label: 'Matching', description: 'Pair Spanish words with their meaning.', instruction: 'Match the pairs' },
```

```ts
      matchEs: 'Spanish',
      matchSk: 'English',
      matchHint: 'Tap a word, then its translation.',
```

```ts
    matchWrongNote: (words: string) => `You mixed up: ${words}.`,
```

- [ ] **Step 8: The view**

```tsx
// src/features/exercises/tasks/MatchingView.tsx
import { useState } from 'react'
import { useT } from '../../../i18n'
import { useLanguage } from '../../../lib/language'
import type { Answer, MatchingTask } from '../../../lib/lesson'
import { playSound } from '../../../lib/sound'
import type { Status } from './status'

interface MatchingViewProps {
  task: MatchingTask
  onAnswer: (answer: Answer) => void
  onSubmit: (value?: Answer) => void
  status?: Status
}

type Side = 'es' | 'sk'

const CHIP =
  'min-h-14 w-full rounded-2xl border-2 px-3 py-2 text-lg leading-tight transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick'

/** Tap a Spanish word and its translation; a right pair locks green, a wrong one flashes red. */
export function MatchingView({ task, onAnswer, onSubmit, status }: MatchingViewProps) {
  const text = useT().lesson.task
  const language = useLanguage()
  const [done, setDone] = useState<number[]>([]) // pairs paired right (indices into task.pairs)
  const [pick, setPick] = useState<{ side: Side; pair: number } | null>(null)
  const [flash, setFlash] = useState<{ es: number; sk: number } | null>(null)
  const [wrong, setWrong] = useState<string[]>([]) // the word of every wrong pairing
  const graded = status !== undefined

  const choose = (side: Side, pair: number) => {
    if (graded || flash || done.includes(pair)) return
    if (!pick || pick.side === side) {
      playSound('tap')
      setPick({ side, pair })
      return
    }
    const es = side === 'es' ? pair : pick.pair
    const sk = side === 'sk' ? pair : pick.pair
    setPick(null)
    if (es === sk) {
      playSound('tap')
      const next = [...done, es]
      setDone(next)
      if (next.length === task.pairs.length) {
        const value = `m:${wrong.join(',')}`
        onAnswer(value)
        onSubmit(value)
      }
      return
    }
    playSound('almost')
    setWrong([...wrong, task.pairs[es].word.id])
    setFlash({ es, sk })
    window.setTimeout(() => setFlash(null), 500)
  }

  const style = (side: Side, pair: number) => {
    if (done.includes(pair)) return 'border-leaf bg-leaf/15 opacity-70'
    if (flash && flash[side] === pair) return 'border-error bg-error/10'
    if (pick?.side === side && pick.pair === pair) return 'border-brick bg-brick/10 ring-1 ring-brick'
    return 'border-line bg-surface hover:border-ink-muted'
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">{text.matchHint}</p>
      <div className="grid grid-cols-2 gap-3">
        <div role="group" aria-label={text.matchEs} className="space-y-3">
          {task.pairs.map((p, i) => (
            <button key={p.word.id} type="button" lang="es" disabled={graded || done.includes(i)} onClick={() => choose('es', i)} className={`${CHIP} font-serif ${style('es', i)}`}>
              {p.es}
            </button>
          ))}
        </div>
        <div role="group" aria-label={text.matchSk} className="space-y-3">
          {task.rightOrder.map((i) => (
            <button key={task.pairs[i].word.id} type="button" lang={language} disabled={graded || done.includes(i)} onClick={() => choose('sk', i)} className={`${CHIP} ${style('sk', i)}`}>
              {task.pairs[i].sk}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

`TaskView.tsx`: import it and add `case 'matching': return <MatchingView task={task} onAnswer={onAnswer} onSubmit={onSubmit} status={status} />`.

- [ ] **Step 9: Card, lesson page, feedback**

`exercises.ts`: add `Link2` to the lucide import and `exercise('matching', Link2),` after `findmistake`. `LessonPage.tsx`: `AUTO_SUBMIT` becomes `['truefalse', 'findmistake', 'matching']`.

`FeedbackSheet.tsx`:
- `reference()` gets

```tsx
    case 'matching':
      return { correct: task.pairs.map((p) => `${p.es} = ${p.sk}`).join('\n'), correctLang: 'es' }
```

- the correct-answer paragraph gets `whitespace-pre-line` in its class list (`className="min-w-0 flex-1 whitespace-pre-line pt-1.5 font-serif text-xl leading-snug"`);
- after the `changedWord` note add

```tsx
  if (task.kind === 'matching' && grade.misplaced?.length) {
    notes.push(<>{text.matchWrongNote(task.pairs.filter((p) => grade.misplaced?.includes(p.word.id)).map((p) => p.es).join(', '))}</>)
  }
```

- the star: change the `const star =` expression so a matching round has none, and render the save button only when there is one:

```tsx
  const star =
    task.kind === 'matching'
      ? null
      : task.kind === 'conjugation'
        ? ({ type: 'word', id: wordIdByVerb.get(task.verb.id) ?? task.verb.id } as const)
        : task.kind === 'vocab'
          ? ({ type: 'word', id: task.word.id } as const)
          : ({ type: 'sentence', id: task.sentence.id } as const)
```

```tsx
            {star && <SaveButton type={star.type} id={star.id} size="pill" />}
```

- [ ] **Step 10: Typecheck, test, commit**

Run: `npx tsc -b` (no errors — fix any remaining non-exhaustive switch by adding `matching` where the compiler points), `npm test` (all PASS), `npm run validate:data` (OK).

```bash
git add src/lib/lesson.ts src/lib/lesson.test.ts src/lib/contentReport.ts src/lib/tips.ts api/report.ts api/usage.ts src/i18n/sk.ts src/i18n/en.ts src/features/exercises/exercises.ts src/features/exercises/ExercisePage.tsx src/features/exercises/LessonPage.tsx src/features/exercises/FeedbackSheet.tsx src/features/exercises/taskSummary.ts src/features/exercises/tasks/TaskView.tsx src/features/exercises/tasks/MatchingView.tsx
git commit -m "feat(exercises): matching rounds of five word pairs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end tests and the full check

**Files:**
- Create: `e2e/exercise-types.spec.ts`

**Interfaces:**
- Consumes: `button`, `status`, `swipe`, `sentences`, `words` from `e2e/helpers.ts`; the lesson URL `/practice/lesson?type=<type>&topic=all&level=A1&lesson=1`.
- Produces: nothing later tasks use.

- [ ] **Step 1: Write the e2e file**

```ts
// e2e/exercise-types.spec.ts
import { expect, test } from '@playwright/test'
import { button, sentences, status, swipe, words } from './helpers.ts'

const lesson = (type: string) => `/practice/lesson?type=${type}&topic=all&level=A1&lesson=1`
const PUNCTUATION = /^[¿?¡!.,;:]$/
const withArticle = (w: { es: string; gender?: 'm' | 'f' }) => (w.gender ? `${w.gender === 'm' ? 'el' : 'la'} ${w.es}` : w.es)

test.describe('pravda / nepravda', () => {
  test('is answered by swiping the card, and the verdict follows the sentence', async ({ page }) => {
    await page.goto(lesson('truefalse'))
    const card = page.getByRole('group', { name: 'Veta na posúdenie' })
    await expect(card).toBeVisible()
    const shown = await card.locator('p[lang="es"]').innerText()
    const truth = sentences.some((s) => s.es === shown)

    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2
    await swipe(page, { x, y }, { x: x + 140, y }) // right = pravda
    await expect(status(page)).toContainText(truth ? 'Správne!' : 'Nesprávne')
    await button(page, 'Pokračovať').tap()
    await expect(page.locator('header')).toContainText('2/10')
  })

  test('is answered by the buttons, and a short drag does nothing', async ({ page }) => {
    await page.goto(lesson('truefalse'))
    const card = page.getByRole('group', { name: 'Veta na posúdenie' })
    const shown = await card.locator('p[lang="es"]').innerText()
    const truth = sentences.some((s) => s.es === shown)

    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2
    await swipe(page, { x, y }, { x: x - 30, y })
    await expect(status(page)).toHaveCount(0)

    await button(page, 'Nepravda').tap()
    await expect(status(page)).toContainText(truth ? 'Nesprávne' : 'Správne!')
    await button(page, 'Pokračovať').tap()
  })
})

test.describe('nájdi chybu', () => {
  /** The sentence on screen and the position (among its words) and original of the swapped one. */
  async function wrongWord(page: import('@playwright/test').Page) {
    const sentence = page.locator('main p[lang="es"]')
    await expect(sentence).toBeVisible()
    const shown = await sentence.locator('button').allInnerTexts()
    const texts = await page.locator('main p').allInnerTexts()
    const original = sentences.find((s) => texts.includes(s.sk))!
    const originalWords = original.tokens.filter((t) => !PUNCTUATION.test(t))
    const at = shown.findIndex((word, i) => word !== originalWords[i])
    return { shown, at, right: originalWords[at] }
  }

  test('tap the wrong word, then pick the fix', async ({ page }) => {
    await page.goto(lesson('findmistake'))
    const { at, right } = await wrongWord(page)
    await page.locator('main p[lang="es"] button').nth(at).tap()
    await page.getByRole('radio', { name: right, exact: true }).tap()
    await expect(status(page)).toContainText('Správne!')
    await button(page, 'Pokračovať').tap()
    await expect(page.locator('header')).toContainText('2/10')
  })

  test('two wrong taps end the task as wrong', async ({ page }) => {
    await page.goto(lesson('findmistake'))
    const { at, shown } = await wrongWord(page)
    const others = shown.map((_, i) => i).filter((i) => i !== at)
    await page.locator('main p[lang="es"] button').nth(others[0]).tap()
    await expect(page.getByText('To nie je ono, skús ešte raz.')).toBeVisible()
    await page.locator('main p[lang="es"] button').nth(others[1]).tap()
    await expect(status(page)).toContainText('Nesprávne')
    await button(page, 'Pokračovať').tap()
  })

  test('a wrong fix is wrong', async ({ page }) => {
    await page.goto(lesson('findmistake'))
    const { at, right } = await wrongWord(page)
    await page.locator('main p[lang="es"] button').nth(at).tap()
    const options = page.getByRole('radio')
    const names = await options.allInnerTexts()
    await options.nth(names.findIndex((n) => n !== right)).tap()
    await expect(status(page)).toContainText('Nesprávne')
  })
})

test.describe('priraďovanie', () => {
  /** Pairs every Spanish chip with its Slovak one, `wrong` times first pairing a chip with a wrong partner. */
  async function play(page: import('@playwright/test').Page, wrong: number) {
    const es = page.getByRole('group', { name: 'Španielsky' }).getByRole('button')
    const sk = page.getByRole('group', { name: 'Slovensky' }).getByRole('button')
    await expect(es).toHaveCount(5)
    const left = await es.allInnerTexts()
    const right = await sk.allInnerTexts()
    const partner = (spanish: string) => words.find((w) => withArticle(w) === spanish)!.sk[0]

    for (let n = 0; n < wrong; n++) {
      const other = right.find((r) => r !== partner(left[0]))!
      await es.filter({ hasText: left[0] }).first().tap()
      await sk.getByText(other, { exact: true }).tap()
      await page.waitForTimeout(600) // the red flash
    }
    for (const spanish of left) {
      await es.getByText(spanish, { exact: true }).tap()
      await sk.getByText(partner(spanish), { exact: true }).tap()
    }
  }

  test('five pairs end the round as right', async ({ page }) => {
    await page.goto(lesson('matching'))
    await play(page, 0)
    await expect(status(page)).toContainText('Správne!')
    await button(page, 'Pokračovať').tap()
    await expect(page.locator('header')).toContainText('2/4')
  })

  test('three wrong pairings make the round wrong and name the words', async ({ page }) => {
    await page.goto(lesson('matching'))
    await play(page, 3)
    await expect(status(page)).toContainText('Nesprávne')
    await expect(status(page)).toContainText('Pomýlil si sa pri')
    await button(page, 'Pokračovať').tap()
  })
})
```

- [ ] **Step 2: Run the new file**

Run: `E2E_PORT=5299 npx playwright test e2e/exercise-types.spec.ts --workers=3`
Expected: all PASS. If a `swipe` test cannot move the card, check that the card has `touch-action: pan-y` (class `touch-pan-y`) and that `setPointerCapture` ran; the CDP touch events become pointer events.

- [ ] **Step 3: The full checks**

Run in order:
- `npm run validate:data` — OK
- `npm test` — all PASS
- `npm run build` — builds
- `E2E_PORT=5299 npm run test:e2e -- --workers=3` — all PASS (Adam's memory notes 3 path/lesson tests flaky on a clean HEAD too: rerun a failing test alone with the same command before blaming this change; report which ones stayed red).

- [ ] **Step 4: Look at it at 375 px**

Run: `npm run dev -- --port 5298`, open `http://localhost:5298/practice` at 375 px wide. Check by eye and report: the three new cards in Cvičiť; a true/false card (swipe tilt and stamp, buttons ≥ 44 px, no footer); find-the-mistake chips (tap height, strikethrough on a miss); a matching round (chip heights, red flash, green lock); the feedback sheet for each (changed word note, pairs list with line breaks, no ⭐ on matching). Stop the dev server afterwards (it survives `TaskStop` on Windows: kill only the process you started, never Adam's `--host` server on 5173).

- [ ] **Step 5: Commit**

```bash
git add e2e/exercise-types.spec.ts
git commit -m "test(exercises): e2e for pravda/nepravda, nájdi chybu and priraďovanie

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Report to Adam**

Say what changed, what to test on the phone (swipe feel and threshold; whether any swapped sentence reads as correct — use Nahlásiť chybu; whether 4 rounds of matching is the right length; chip sizes), the five deviations from the spec listed at the top of this plan, and that `CLAUDE.md` §1.4 (Exercises) still lists five types and is his to update. Nothing is pushed.

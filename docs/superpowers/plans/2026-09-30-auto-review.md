# Automatic Review of Practised Words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Words practised in Slovná zásoba and Časovanie join spaced repetition automatically, scheduled by the lesson answer, with an adjustable daily limit.

**Architecture:** Review cards get a `practised` flag. Pure functions in `src/lib/practice.ts` turn lesson answers into FSRS reviews (live and replayed from past attempts). A pure `selectDue` in `src/lib/srs.ts` applies the daily limit; every consumer of "due today" (review session, Domov, Archív, push reminder) goes through it. Settings live in `src/lib/autoReview.ts` (localStorage), UI in Nastavenia.

**Tech Stack:** React + TypeScript, Dexie, ts-fsrs 5, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-auto-review-design.md`

## Global Constraints

- UI strings Slovak; code, comments, commits English; no `any`.
- Practised words only from exercises `vocab` (`"perro:sk-es"`) and `conjugation` (`"tener:preterito:yo"` → `wordIdByVerb`).
- Lesson answer: right = `Rating.Good`, wrong = `Rating.Again`, scheduler `fsrs({ enable_fuzz: true, enable_short_term: false })`; wrong → due no earlier than the start of the next local day; a card already reviewed that local day is not changed.
- Settings: localStorage `somos-auto-review`, default `{ enabled: true, limit: 20 }`, limits `10 | 20 | 30 | 50`.
- "Practised-only" = `itemType === 'word' && practised && !saved(⭐)`; capped at `limit − practised-only words reviewed today`, most overdue first; ⭐/custom/sentences never capped.
- `ReviewCard.practised?: true`, no Dexie version bump.
- Always read cards via `cardOf()` (JSON backups store dates as strings).
- `npm test` after lib changes; `npm run lint` + `npm run build` before finishing. Stage explicit paths (Adam's `.gitignore` edit stays uncommitted).

## Review Focus

- **First start after the update with a large history**: the rebuild must run after `syncReviewCards()` (else the new cards get deleted as "not wanted"): `main.tsx` chains them (Task 4, phone check).
- **Un-starring a practised word** must keep the card (Task 3 `removeReviewCard`, phone check).
- **A lesson answer after a review the same day** changes nothing (Task 2 test "same local day").
- **Domov count, review session and push reminder must agree** — all use `selectDue` (Task 3 tests + wiring).
- **A backup from before this update** restores and then gets its practised cards rebuilt (Task 4 `backup.ts`, phone check).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/autoReview.ts` (new) | Settings: parse, store, hook |
| `src/lib/autoReview.test.ts` (new) | Parse tests |
| `src/lib/practice.ts` (new) | Pure: word id, lesson answer → card, replay, sync plan; DB: `recordPractice`, `syncPracticeCards` |
| `src/lib/practice.test.ts` (new) | Tests for the pure part |
| `src/lib/db.ts` | `ReviewCard.practised?: true` |
| `src/lib/srs.ts` | `isPractisedOnly`, `selectDue`, `dueCounts`, `reviewCardChanges`; sync/remove keep practised; `loadDueCards`, `loadDueCounts`; overview uses them |
| `src/lib/srs.test.ts` (new) | Selection + sync-change tests |
| `src/features/review/reviewQueue.ts` | Uses `loadDueCards` |
| `src/lib/reminderProgress.ts` (+ test) | `buildProgress` takes due counts |
| `src/features/exercises/LessonPage.tsx` | Calls `recordPractice` |
| `src/main.tsx`, `src/lib/backup.ts` | Run `syncPracticeCards` after `syncReviewCards` |
| `src/features/archive/AutoReviewSettings.tsx` (new), `SettingsPage.tsx` | Nastavenia section |
| `CLAUDE.md` | Documentation |

---

### Task 1: Settings module `autoReview.ts`

**Files:**
- Create: `src/lib/autoReview.ts`, `src/lib/autoReview.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const AUTO_REVIEW_LIMITS = [10, 20, 30, 50] as const
  export type AutoReviewLimit = (typeof AUTO_REVIEW_LIMITS)[number]
  export interface AutoReviewSettings { enabled: boolean; limit: AutoReviewLimit }
  export const DEFAULT_AUTO_REVIEW: AutoReviewSettings
  export function parseAutoReview(raw: string | null): AutoReviewSettings
  export const getAutoReview: () => AutoReviewSettings
  export function setAutoReview(next: AutoReviewSettings): void
  export function useAutoReviewSettings(): AutoReviewSettings
  ```

- [ ] **Step 1: Failing test** — `src/lib/autoReview.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_AUTO_REVIEW, parseAutoReview } from './autoReview'

describe('parseAutoReview', () => {
  it('defaults to on with 20 words a day', () => {
    expect(parseAutoReview(null)).toEqual({ enabled: true, limit: 20 })
    expect(DEFAULT_AUTO_REVIEW).toEqual({ enabled: true, limit: 20 })
  })

  it('reads stored settings', () => {
    expect(parseAutoReview('{"enabled":false,"limit":50}')).toEqual({ enabled: false, limit: 50 })
  })

  it.each(['not json', '{"enabled":true,"limit":25}', '{"enabled":"yes","limit":20}', '[]', '42'])('falls back to the default for %s', (raw) => {
    expect(parseAutoReview(raw)).toEqual(DEFAULT_AUTO_REVIEW)
  })
})
```
Run: `npx vitest run src/lib/autoReview.test.ts` — Expected: FAIL, cannot resolve `./autoReview`.

- [ ] **Step 2: Implement** — `src/lib/autoReview.ts`:
```ts
import { useSyncExternalStore } from 'react'

// Automatic review of practised words (Slovná zásoba, Časovanie): on/off and the daily limit.
// Stored per device in localStorage, like the daily goal.

const STORAGE_KEY = 'somos-auto-review'
export const AUTO_REVIEW_LIMITS = [10, 20, 30, 50] as const
export type AutoReviewLimit = (typeof AUTO_REVIEW_LIMITS)[number]

export interface AutoReviewSettings {
  enabled: boolean
  limit: AutoReviewLimit // practised-only words per day
}

export const DEFAULT_AUTO_REVIEW: AutoReviewSettings = { enabled: true, limit: 20 }

const isLimit = (v: unknown): v is AutoReviewLimit => (AUTO_REVIEW_LIMITS as readonly unknown[]).includes(v)

export function parseAutoReview(raw: string | null): AutoReviewSettings {
  try {
    const value: unknown = JSON.parse(raw ?? '')
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const { enabled, limit } = value as Record<string, unknown>
      if (typeof enabled === 'boolean' && isLimit(limit)) return { enabled, limit }
    }
  } catch {
    // Missing or corrupted: the defaults.
  }
  return DEFAULT_AUTO_REVIEW
}

function readSettings(): AutoReviewSettings {
  try {
    return parseAutoReview(localStorage.getItem(STORAGE_KEY))
  } catch {
    return DEFAULT_AUTO_REVIEW
  }
}

let settings = readSettings()
const listeners = new Set<() => void>()

/** Current settings outside React (due counts for the review queue and the reminder). */
export const getAutoReview = () => settings

export function setAutoReview(next: AutoReviewSettings) {
  settings = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Choice just won't survive a reload.
  }
  listeners.forEach((notify) => notify())
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useAutoReviewSettings(): AutoReviewSettings {
  return useSyncExternalStore(subscribe, () => settings)
}
```
Run: `npx vitest run src/lib/autoReview.test.ts` — Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add src/lib/autoReview.ts src/lib/autoReview.test.ts
git commit -m "feat(review): automatic review settings"
```

---

### Task 2: Pure practice logic `practice.ts`

**Files:**
- Modify: `src/lib/db.ts` (the `ReviewCard` interface)
- Create: `src/lib/practice.ts`, `src/lib/practice.test.ts`

**Interfaces:**
- Consumes: `cardOf` from `./srs`; `wordById`, `wordIdByVerb` from `../data`; `startOfDay`, `addDays`, `dayKey` from `./dates`.
- Produces:
  ```ts
  // db.ts
  interface ReviewCard { itemId: string; itemType: ReviewItemType; fsrs: Card; practised?: true }
  // practice.ts
  export interface PracticeAnswer { exercise: string; itemId: string; correct: boolean; at: number }
  export function practisedWordId(exercise: string, itemId: string): string | undefined
  export function applyPractice(card: Card | undefined, correct: boolean, at: Date): Card | undefined
  export function replayPractice(answers: PracticeAnswer[]): Map<string, Card>
  export function practiceUpdate(existing: ReviewCard | undefined, wordId: string, correct: boolean, at: Date): ReviewCard | undefined
  export function planPracticeSync(answers: PracticeAnswer[], existing: ReviewCard[]): ReviewCard[]
  ```

- [ ] **Step 1: Add the flag to `src/lib/db.ts`** — in `interface ReviewCard`, after `fsrs: Card`:
```ts
  /** Joined review because it was practised in a lesson (kept when its ⭐ is removed). */
  practised?: true
```

- [ ] **Step 2: Failing tests** — `src/lib/practice.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import { addDays, startOfDay } from './dates'
import type { ReviewCard } from './db'
import { applyPractice, planPracticeSync, practisedWordId, practiceUpdate, replayPractice } from './practice'
import { isDueToday } from './srs'

const at = (d: number, h = 10) => new Date(2026, 8, d, h) // September 2026

describe('practisedWordId', () => {
  it.each([
    ['vocab', 'perro:sk-es', 'perro'],
    ['vocab', 'perro:es-sk', 'perro'],
    ['conjugation', 'tener:preterito:yo', 'tener'],
    ['conjugation', 'extrañar:presente:yo', 'extranar'], // the verb's Word has the slug id
    ['vocab', 'no-such-word:sk-es', undefined],
    ['cloze', 's001#0', undefined],
    ['review', 'word:perro', undefined],
  ])('%s %s → %s', (exercise, itemId, wordId) => {
    expect(practisedWordId(exercise, itemId)).toBe(wordId)
  })
})

describe('applyPractice', () => {
  it('brings a word answered right back in a few days', () => {
    const card = applyPractice(undefined, true, at(10))!
    expect(isDueToday(card, at(10))).toBe(false)
    expect(card.due.getTime()).toBeGreaterThanOrEqual(startOfDay(addDays(at(10), 2)).getTime())
  })

  it('brings a word answered wrong back tomorrow', () => {
    const card = applyPractice(undefined, false, at(10))!
    expect(isDueToday(card, at(10))).toBe(false)
    expect(isDueToday(card, at(11))).toBe(true)
  })

  it('counts only the first answer of a local day', () => {
    const first = applyPractice(undefined, true, at(10, 9))!
    expect(applyPractice(first, false, at(10, 21))).toBeUndefined()
  })

  it('counts an answer on a later day', () => {
    const first = applyPractice(undefined, false, at(10))!
    const next = applyPractice(first, true, at(11))!
    expect(next.reps).toBe(2)
    expect(next.due.getTime()).toBeGreaterThan(first.due.getTime())
  })
})

describe('replayPractice', () => {
  const answers = [
    { exercise: 'vocab', itemId: 'perro:sk-es', correct: true, at: at(10, 9).getTime() },
    { exercise: 'vocab', itemId: 'perro:es-sk', correct: false, at: at(10, 9).getTime() + 60_000 },
    { exercise: 'conjugation', itemId: 'tener:presente:yo', correct: false, at: at(12).getTime() },
    { exercise: 'vocab', itemId: 'perro:sk-es', correct: true, at: at(14).getTime() },
    { exercise: 'cloze', itemId: 's001#0', correct: true, at: at(14).getTime() },
  ]

  it('replays one answer per word per day, oldest first, whatever the input order', () => {
    const cards = replayPractice([...answers].reverse())
    expect([...cards.keys()].sort()).toEqual(['perro', 'tener'])
    expect(cards.get('perro')!.reps).toBe(2) // 10th (first answer only) + 14th
    expect(cards.get('tener')!.reps).toBe(1)
    expect(replayPractice(answers).get('perro')!.due.getTime()).toBe(cards.get('perro')!.due.getTime())
  })
})

describe('practiceUpdate', () => {
  it('creates a practised card for a new word', () => {
    const card = practiceUpdate(undefined, 'perro', true, at(10))!
    expect(card).toMatchObject({ itemType: 'word', itemId: 'perro', practised: true })
  })

  it('only flags a ⭐ card already reviewed today', () => {
    const reviewed = applyPractice(undefined, true, at(10, 8))!
    const starred: ReviewCard = { itemType: 'word', itemId: 'perro', fsrs: reviewed }
    const updated = practiceUpdate(starred, 'perro', false, at(10, 20))!
    expect(updated.practised).toBe(true)
    expect(updated.fsrs).toBe(reviewed)
    expect(practiceUpdate(updated, 'perro', false, at(10, 21))).toBeUndefined()
  })
})

describe('planPracticeSync', () => {
  const answers = [
    { exercise: 'vocab', itemId: 'perro:sk-es', correct: true, at: at(10).getTime() },
    { exercise: 'vocab', itemId: 'gato:sk-es', correct: true, at: at(10).getTime() },
    { exercise: 'vocab', itemId: 'casa:sk-es', correct: true, at: at(10).getTime() },
  ]

  it('creates missing cards, flags ⭐ cards, leaves practised cards alone', () => {
    const starred: ReviewCard = { itemType: 'word', itemId: 'gato', fsrs: createEmptyCard(at(1)) }
    const practised: ReviewCard = { itemType: 'word', itemId: 'casa', fsrs: createEmptyCard(at(1)), practised: true }
    const puts = planPracticeSync(answers, [starred, practised])
    expect(puts.map((c) => c.itemId).sort()).toEqual(['gato', 'perro'])
    expect(puts.find((c) => c.itemId === 'gato')).toEqual({ ...starred, practised: true })
    expect(puts.find((c) => c.itemId === 'perro')).toMatchObject({ itemType: 'word', practised: true })
  })

  it('changes nothing when run again', () => {
    const first = planPracticeSync(answers, [])
    expect(planPracticeSync(answers, first)).toEqual([])
  })
})
```
(Before running, check that `gato` and `casa` are Word ids: `node -e "…"` or grep `src/data/words`; replace with any two existing noun ids if not.)

Run: `npx vitest run src/lib/practice.test.ts` — Expected: FAIL, cannot resolve `./practice`.

- [ ] **Step 3: Implement the pure part** — `src/lib/practice.ts`:
```ts
import { createEmptyCard, fsrs, Rating, type Card } from 'ts-fsrs'
import { wordById, wordIdByVerb } from '../data'
import { addDays, dayKey, startOfDay } from './dates'
import type { ReviewCard } from './db'
import { cardOf } from './srs'

// Automatic review: a word answered in Slovná zásoba or Časovanie joins spaced repetition, and
// the lesson answer counts as a review of it (right = Good, wrong = Again).

/** No 10-minute learning steps: a lesson already was the first encounter. */
const practiceScheduler = fsrs({ enable_fuzz: true, enable_short_term: false })

export interface PracticeAnswer {
  exercise: string
  itemId: string
  correct: boolean
  at: number
}

/** The dictionary word a lesson answer practised: "perro:sk-es" → perro, "tener:preterito:yo" → tener. */
export function practisedWordId(exercise: string, itemId: string): string | undefined {
  const head = itemId.split(':')[0]
  if (exercise === 'vocab') return wordById.has(head) ? head : undefined
  if (exercise === 'conjugation') return wordIdByVerb.get(head)
  return undefined
}

/** The card after a lesson answer, or undefined when the card was already reviewed that day. */
export function applyPractice(card: Card | undefined, correct: boolean, at: Date): Card | undefined {
  if (card?.last_review && dayKey(card.last_review) === dayKey(at)) return undefined
  const next = practiceScheduler.next(card ?? createEmptyCard(at), at, correct ? Rating.Good : Rating.Again).card
  const tomorrow = startOfDay(addDays(at, 1))
  return !correct && next.due < tomorrow ? { ...next, due: tomorrow } : next
}

/** Schedules rebuilt from past lesson answers (oldest first, one per word per day). */
export function replayPractice(answers: PracticeAnswer[]): Map<string, Card> {
  const cards = new Map<string, Card>()
  for (const answer of [...answers].sort((a, b) => a.at - b.at)) {
    const wordId = practisedWordId(answer.exercise, answer.itemId)
    if (!wordId) continue
    const next = applyPractice(cards.get(wordId), answer.correct, new Date(answer.at))
    if (next) cards.set(wordId, next)
  }
  return cards
}

/** What to store after a lesson answer for `wordId`, or undefined when nothing changes. */
export function practiceUpdate(existing: ReviewCard | undefined, wordId: string, correct: boolean, at: Date): ReviewCard | undefined {
  const fsrs = applyPractice(existing && cardOf(existing), correct, at)
  if (fsrs) return { ...existing, itemType: 'word', itemId: wordId, fsrs, practised: true }
  return existing && !existing.practised ? { ...existing, practised: true } : undefined
}

/** Cards to put so every practised word has one (past lessons included). Idempotent. */
export function planPracticeSync(answers: PracticeAnswer[], existing: ReviewCard[]): ReviewCard[] {
  const have = new Map(existing.filter((c) => c.itemType === 'word').map((c) => [c.itemId, c]))
  const puts: ReviewCard[] = []
  for (const [wordId, fsrs] of replayPractice(answers)) {
    const card = have.get(wordId)
    if (!card) puts.push({ itemType: 'word', itemId: wordId, fsrs, practised: true })
    else if (!card.practised) puts.push({ ...card, practised: true })
  }
  return puts
}
```
Run: `npx vitest run src/lib/practice.test.ts` — Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add src/lib/db.ts src/lib/practice.ts src/lib/practice.test.ts
git commit -m "feat(review): lesson answers as reviews of practised words"
```

---

### Task 3: Due selection with the daily limit (`srs.ts`) and its consumers

**Files:**
- Modify: `src/lib/srs.ts`, `src/features/review/reviewQueue.ts`, `src/lib/reminderProgress.ts`, `src/lib/reminderProgress.test.ts`
- Create: `src/lib/srs.test.ts`

**Interfaces:**
- Consumes: `AutoReviewSettings`, `getAutoReview`, `useAutoReviewSettings` (Task 1); `ReviewCard.practised` (Task 2).
- Produces:
  ```ts
  export function isPractisedOnly(card: ReviewCard, savedWordIds: ReadonlySet<string>): boolean
  export function selectDue(cards: ReviewCard[], savedWordIds: ReadonlySet<string>, settings: AutoReviewSettings, reviewedToday: ReadonlySet<string>, now: Date): ReviewCard[] // sorted by due
  export function dueCounts(cards: ReviewCard[], savedWordIds: ReadonlySet<string>, settings: AutoReviewSettings, reviewedToday: ReadonlySet<string>, now: Date): { today: number; tomorrow: number }
  export function reviewCardChanges(wanted: Map<string, [ReviewItemType, string]>, existing: ReviewCard[], now: Date): { stale: [ReviewItemType, string][]; missing: ReviewCard[] }
  export async function loadDueCards(now?: Date, settings?: AutoReviewSettings): Promise<ReviewCard[]>
  export async function loadDueCounts(now?: Date): Promise<{ today: number; tomorrow: number }>
  // reminderProgress.ts
  export function buildProgress(attemptTimestamps: number[], due: { today: number; tomorrow: number }, goal: number, now: Date): ReminderProgress
  ```

- [ ] **Step 1: Failing tests** — `src/lib/srs.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { createEmptyCard } from 'ts-fsrs'
import type { ReviewCard, ReviewItemType } from './db'
import { dueCounts, reviewCardChanges, selectDue } from './srs'

const now = new Date(2026, 8, 30, 10)
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)
const card = (itemType: ReviewItemType, itemId: string, dueDaysAgo: number, practised = false): ReviewCard => ({
  itemType,
  itemId,
  fsrs: createEmptyCard(daysAgo(dueDaysAgo)), // an empty card is due when created
  ...(practised ? { practised: true as const } : {}),
})
const on = { enabled: true, limit: 10 as const }
const none = new Set<string>()
const ids = (cards: ReviewCard[]) => cards.map((c) => `${c.itemType}:${c.itemId}`)

describe('selectDue', () => {
  const practised = Array.from({ length: 15 }, (_, i) => card('word', `w${i}`, i + 1, true)) // w14 most overdue
  const starredPractised = card('word', 'star', 0, true)
  const cards = [card('sentence', 's001', 0), card('custom', 'c1', 0), card('word', 'saved', 0), starredPractised, ...practised, card('word', 'later', -3, true)]
  const saved = new Set(['saved', 'star'])

  it('keeps ⭐, sentences and own words and caps practised-only words, most overdue first', () => {
    const due = selectDue(cards, saved, on, none, now)
    expect(due).toHaveLength(4 + 10)
    const auto = ids(due).filter((id) => id.startsWith('word:w'))
    expect(auto).toHaveLength(10)
    expect(auto).toContain('word:w14')
    expect(auto).not.toContain('word:w0')
    expect(ids(due)).toEqual(expect.arrayContaining(['sentence:s001', 'custom:c1', 'word:saved', 'word:star']))
  })

  it('returns the cards sorted by due date', () => {
    const due = selectDue(cards, saved, on, none, now)
    const times = due.map((c) => new Date(c.fsrs.due).getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('lowers the cap by practised-only words already reviewed today', () => {
    const due = selectDue(cards, saved, on, new Set(['w1', 'w2', 'w3', 'star']), now)
    expect(ids(due).filter((id) => id.startsWith('word:w'))).toHaveLength(7) // 'star' is ⭐: not counted
  })

  it('leaves practised-only words out when switched off', () => {
    expect(ids(selectDue(cards, saved, { enabled: false, limit: 10 }, none, now))).toEqual(
      expect.not.arrayContaining(['word:w14']),
    )
    expect(selectDue(cards, saved, { enabled: false, limit: 10 }, none, now)).toHaveLength(4)
  })

  it('counts today and tomorrow with the same rules', () => {
    expect(dueCounts(cards, saved, on, none, now)).toEqual({ today: 14, tomorrow: 14 })
    expect(dueCounts(cards, saved, { enabled: true, limit: 50 }, none, now)).toEqual({ today: 19, tomorrow: 19 })
  })
})

describe('reviewCardChanges', () => {
  it('keeps practised cards that are no longer saved', () => {
    const existing = [card('word', 'unsaved', 1), card('word', 'practised', 1, true)]
    const { stale, missing } = reviewCardChanges(new Map([['word:new', ['word', 'new']]]), existing, now)
    expect(stale).toEqual([['word', 'unsaved']])
    expect(missing.map((c) => c.itemId)).toEqual(['new'])
  })
})
```
Note on `dueCounts` tomorrow: `later` is due in 3 days, so tomorrow equals today here.

Run: `npx vitest run src/lib/srs.test.ts` — Expected: FAIL (`selectDue` is not exported).

- [ ] **Step 2: Implement in `src/lib/srs.ts`**

Imports: add `addDays, startOfDay` to the `./dates` import, and
```ts
import { getAutoReview, useAutoReviewSettings, type AutoReviewSettings } from './autoReview'
```
Update the header comment to: `// Spaced repetition (FSRS) for saved words and sentences, custom words and practised words.`

Replace `removeReviewCard` with:
```ts
/** A practised word stays in review when its ⭐ is removed. */
export async function removeReviewCard(itemType: ReviewItemType, itemId: string): Promise<void> {
  const card = await db.reviewCards.get(key(itemType, itemId))
  if (card?.practised) return
  await db.reviewCards.delete(key(itemType, itemId))
}
```

Replace the body of `syncReviewCards` from `const existing = …` on with a call to a pure helper, and add the helper above it:
```ts
/** Cards to delete (not wanted, not practised) and to create (wanted, missing). */
export function reviewCardChanges(
  wanted: Map<string, [ReviewItemType, string]>,
  existing: ReviewCard[],
  now: Date,
): { stale: [ReviewItemType, string][]; missing: ReviewCard[] } {
  const have = new Set(existing.map((c) => `${c.itemType}:${c.itemId}`))
  const stale = existing.filter((c) => !c.practised && !wanted.has(`${c.itemType}:${c.itemId}`)).map((c) => key(c.itemType, c.itemId))
  const missing = [...wanted].filter(([k]) => !have.has(k)).map(([, [itemType, itemId]]) => ({ itemType, itemId, fsrs: createEmptyCard(now) }))
  return { stale, missing }
}
```
and inside `syncReviewCards` after building `wanted`:
```ts
    const { stale, missing } = reviewCardChanges(wanted, await db.reviewCards.toArray(), new Date())
    await db.reviewCards.bulkDelete(stale)
    await db.reviewCards.bulkPut(missing)
```
Update its doc comment: `… every custom word has one; practised words keep theirs; nothing else does. …`

Add the selection (after `syncReviewCards`):
```ts
// ---------- due today (with the daily limit for practised words) ----------

/** A practised word nobody starred: these are capped by the daily limit. */
export const isPractisedOnly = (card: ReviewCard, savedWordIds: ReadonlySet<string>) =>
  card.itemType === 'word' && card.practised === true && !savedWordIds.has(card.itemId)

/**
 * Cards to review today, soonest first: every due ⭐ word, ⭐ sentence and custom word, plus
 * practised-only words (most overdue first) up to the daily limit minus the ones reviewed today.
 */
export function selectDue(
  cards: ReviewCard[],
  savedWordIds: ReadonlySet<string>,
  settings: AutoReviewSettings,
  reviewedToday: ReadonlySet<string>,
  now: Date,
): ReviewCard[] {
  const due = cards.map((rc) => ({ rc, card: cardOf(rc) })).filter(({ card }) => isDueToday(card, now))
  const always = due.filter(({ rc }) => !isPractisedOnly(rc, savedWordIds))
  const practisedOnly = due.filter(({ rc }) => isPractisedOnly(rc, savedWordIds)).sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
  const used = cards.filter((rc) => isPractisedOnly(rc, savedWordIds) && reviewedToday.has(rc.itemId)).length
  const slots = settings.enabled ? Math.max(0, settings.limit - used) : 0
  return [...always, ...practisedOnly.slice(0, slots)]
    .sort((a, b) => a.card.due.getTime() - b.card.due.getTime())
    .map(({ rc }) => rc)
}

/** Due today, and by the end of tomorrow (a fresh limit, nothing reviewed yet). */
export function dueCounts(
  cards: ReviewCard[],
  savedWordIds: ReadonlySet<string>,
  settings: AutoReviewSettings,
  reviewedToday: ReadonlySet<string>,
  now: Date,
): { today: number; tomorrow: number } {
  return {
    today: selectDue(cards, savedWordIds, settings, reviewedToday, now).length,
    tomorrow: selectDue(cards, savedWordIds, settings, new Set(), addDays(now, 1)).length,
  }
}

/** Everything the selection reads from the database. */
async function loadSelectionInput(now: Date) {
  const [cards, saved, todayAttempts] = await Promise.all([
    db.reviewCards.toArray(),
    db.savedItems.toArray(),
    db.attempts.where('at').aboveOrEqual(startOfDay(now).getTime()).toArray(),
  ])
  const savedWordIds = new Set(saved.filter((s) => s.itemType === 'word').map((s) => s.itemId))
  const reviewedToday = new Set(
    todayAttempts.filter((a) => a.exercise === 'review' && a.itemId.startsWith('word:')).map((a) => a.itemId.slice('word:'.length)),
  )
  return { cards, savedWordIds, reviewedToday }
}

export async function loadDueCards(now = new Date(), settings = getAutoReview()): Promise<ReviewCard[]> {
  const { cards, savedWordIds, reviewedToday } = await loadSelectionInput(now)
  return selectDue(cards, savedWordIds, settings, reviewedToday, now)
}

export async function loadDueCounts(now = new Date()): Promise<{ today: number; tomorrow: number }> {
  const { cards, savedWordIds, reviewedToday } = await loadSelectionInput(now)
  return dueCounts(cards, savedWordIds, getAutoReview(), reviewedToday, now)
}
```
Replace `useReviewOverview`:
```ts
export function useReviewOverview(): ReviewOverview | undefined {
  const settings = useAutoReviewSettings()
  return useLiveQuery(async () => {
    const now = new Date()
    const { cards, savedWordIds, reviewedToday } = await loadSelectionInput(now)
    const due = selectDue(cards, savedWordIds, settings, reviewedToday, now)
    const dueSentences = due.filter((c) => c.itemType === 'sentence').length
    const total = cards.filter((c) => settings.enabled || !isPractisedOnly(c, savedWordIds)).length
    return { total, dueToday: due.length, dueWords: due.length - dueSentences, dueSentences }
  }, [settings])
}
```
Update the `ReviewOverview.total` comment to `// cards that can come up in review`.

Run: `npx vitest run src/lib/srs.test.ts` — Expected: PASS.

- [ ] **Step 3: Review queue uses the selection** — in `src/features/review/reviewQueue.ts` replace the first statement of `loadDueEntries` with:
```ts
  const due = (await loadDueCards(now)).map((rc) => ({ rc, card: cardOf(rc) }))
```
and change the srs import to `import { cardOf, loadDueCards } from '../../lib/srs'` (drop `isDueToday`). Update the doc comment: `/** Cards due today (daily limit applied), soonest first, joined with their word, sentence or custom word. */`

- [ ] **Step 4: Reminder progress takes counts** — `src/lib/reminderProgress.ts`:
  - signature `export function buildProgress(attemptTimestamps: number[], due: { today: number; tomorrow: number }, goal: number, now: Date): ReminderProgress`
  - remove `endToday` / `endTomorrow` and use `dueToday: due.today, dueTomorrow: due.tomorrow`
  - drop the now-unused imports (`addDays`, `endOfDay`, `cardOf`)
  - `loadProgress`:
```ts
export async function loadProgress(now = new Date()): Promise<ReminderProgress> {
  const [timestamps, due] = await Promise.all([db.attempts.orderBy('at').keys() as Promise<number[]>, loadDueCounts(now)])
  return buildProgress(timestamps, due, getDailyGoal(), now)
}
```
  with `import { loadDueCounts } from './srs'`.

In `src/lib/reminderProgress.test.ts` replace every `buildProgress(x, [], …)` with `buildProgress(x, { today: 0, tomorrow: 0 }, …)`, and the due-dates test (`expect(buildProgress([], due, 20, now)).toMatchObject({ dueToday: 2, dueTomorrow: 3 })`) with:
```ts
    expect(buildProgress([], { today: 2, tomorrow: 3 }, 20, now)).toMatchObject({ dueToday: 2, dueTomorrow: 3 })
```
removing the now-unused `due` array above it.

- [ ] **Step 5: Test, typecheck, lint**

Run: `npm test && npx tsc -b && npm run lint` — Expected: all pass.

- [ ] **Step 6: Commit**
```bash
git add src/lib/srs.ts src/lib/srs.test.ts src/features/review/reviewQueue.ts src/lib/reminderProgress.ts src/lib/reminderProgress.test.ts
git commit -m "feat(review): daily limit for practised words"
```

---

### Task 4: Record practice and rebuild past lessons (DB wiring)

**Files:**
- Modify: `src/lib/practice.ts`, `src/features/exercises/LessonPage.tsx`, `src/main.tsx`, `src/lib/backup.ts`

**Interfaces:**
- Consumes: `practisedWordId`, `practiceUpdate`, `planPracticeSync` (Task 2).
- Produces: `recordPractice(exercise: string, itemId: string, correct: boolean, now?: Date): Promise<void>`, `syncPracticeCards(): Promise<void>`.

- [ ] **Step 1: DB functions** — append to `src/lib/practice.ts` (add `import { db } from './db'` next to the type import, i.e. `import { db, type ReviewCard } from './db'`):
```ts
// ---------- database ----------

/** After a lesson answer: the practised word's card moves (or is created). */
export async function recordPractice(exercise: string, itemId: string, correct: boolean, now = new Date()): Promise<void> {
  const wordId = practisedWordId(exercise, itemId)
  if (!wordId) return
  await db.transaction('rw', db.reviewCards, async () => {
    const next = practiceUpdate(await db.reviewCards.get(['word', wordId]), wordId, correct, now)
    if (next) await db.reviewCards.put(next)
  })
}

/**
 * Every practised word has a card (built from past lesson answers when missing).
 * Run after syncReviewCards(), at startup and after a backup restore. Idempotent.
 */
export async function syncPracticeCards(): Promise<void> {
  await db.transaction('rw', db.attempts, db.reviewCards, async () => {
    const answers = await db.attempts.where('exercise').anyOf('vocab', 'conjugation').toArray()
    const puts = planPracticeSync(answers, await db.reviewCards.where('itemType').equals('word').toArray())
    if (puts.length) await db.reviewCards.bulkPut(puts)
  })
}
```

- [ ] **Step 2: Lesson player** — `src/features/exercises/LessonPage.tsx`: `import { recordPractice } from '../../lib/practice'` and in `next()` directly after `void recordAttempt(task.kind, task.itemId, correct)`:
```ts
    void recordPractice(task.kind, task.itemId, correct)
```

- [ ] **Step 3: Startup** — `src/main.tsx`: import `syncPracticeCards` from `./lib/practice` and replace `void syncReviewCards()` with:
```ts
// Practised cards after the archive sync, which would otherwise not know them yet.
void syncReviewCards().then(syncPracticeCards)
```

- [ ] **Step 4: Backup restore** — `src/lib/backup.ts`: import `syncPracticeCards` from `./practice` and after `await syncReviewCards()` add `await syncPracticeCards()`.

- [ ] **Step 5: Test, typecheck, lint, build**

Run: `npm test && npx tsc -b && npm run lint && npm run build` — Expected: all pass.

- [ ] **Step 6: Commit**
```bash
git add src/lib/practice.ts src/features/exercises/LessonPage.tsx src/main.tsx src/lib/backup.ts
git commit -m "feat(review): practised words join review, past lessons included"
```

---

### Task 5: Nastavenia section

**Files:**
- Create: `src/features/archive/AutoReviewSettings.tsx`
- Modify: `src/features/archive/SettingsPage.tsx`

- [ ] **Step 1: Component** — `src/features/archive/AutoReviewSettings.tsx`:
```tsx
import { SectionTitle } from '../../components/SectionTitle'
import { Segmented } from '../../components/Segmented'
import { AUTO_REVIEW_LIMITS, setAutoReview, useAutoReviewSettings, type AutoReviewLimit, type AutoReviewSettings as Settings } from '../../lib/autoReview'
import { reportProgress } from '../../lib/reminder'

/** Nastavenia: practised words in review, and how many a day. */
export function AutoReviewSettings() {
  const settings = useAutoReviewSettings()
  const update = (next: Settings) => {
    setAutoReview(next)
    reportProgress() // the reminder text counts due cards
  }

  return (
    <section aria-labelledby="auto-review-heading">
      <SectionTitle id="auto-review-heading">Automatické opakovanie</SectionTitle>
      <div className="rounded-card border border-line bg-surface">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block leading-snug">Opakovať precvičené slová</span>
            <span className="block text-sm text-ink-muted">Slová zo Slovnej zásoby a Časovania sa vrátia na zopakovanie.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={settings.enabled}
            onChange={(e) => update({ ...settings, enabled: e.target.checked })}
            className="size-6 shrink-0 accent-brick"
          />
        </label>
      </div>

      {settings.enabled && (
        <div className="mt-3">
          <p className="mb-2 text-sm font-medium">Najviac za deň</p>
          <Segmented
            mode="radio"
            label="Najviac precvičených slov za deň"
            idPrefix="auto-review"
            value={String(settings.limit)}
            onChange={(v) => update({ ...settings, limit: Number(v) as AutoReviewLimit })}
            options={AUTO_REVIEW_LIMITS.map((n) => ({ id: String(n), label: String(n) }))}
          />
          <p className="mt-2 text-sm text-ink-muted">Tvoje ⭐ a vlastné slová prídu na rad vždy, limit platí len pre precvičené slová.</p>
        </div>
      )}
    </section>
  )
}
```
(Check `Segmented`'s props in `src/components/Segmented.tsx` first; they match the Denný cieľ usage.)

- [ ] **Step 2: Add to the page** — `src/features/archive/SettingsPage.tsx`: `import { AutoReviewSettings } from './AutoReviewSettings'` and render `<AutoReviewSettings />` directly after the Denný cieľ `</section>` (before `<ReminderSettings />`).

- [ ] **Step 3: Typecheck, lint, build**

Run: `npx tsc -b && npm run lint && npm run build` — Expected: pass.

- [ ] **Step 4: Commit**
```bash
git add src/features/archive/AutoReviewSettings.tsx src/features/archive/SettingsPage.tsx
git commit -m "feat(review): Nastavenia for automatic review"
```

---

### Task 6: Docs, verification, push

- [ ] **Step 1: `CLAUDE.md`**
  - §1 item 5 (Archive): after "…are reviewed via spaced repetition;" add: `words practised in Slovná zásoba / Časovanie join too (auto review, daily limit in Nastavenia);`
  - §3 "Spaced repetition" list, add:
```
- Words practised in Slovná zásoba / Časovanie get a card with `practised: true` (`src/lib/practice.ts`): the lesson
  answer is a review (Good / Again, no short-term steps, first answer per local day); `syncPracticeCards()` builds
  missing ones from past attempts after `syncReviewCards()`. Un-starring keeps a practised card.
- "Due today" always goes through `selectDue()`: practised-only words (not ⭐) are capped per day
  (`autoReview.ts`, default 20, switch in Nastavenia); review, Domov, Archív and the reminder share it.
```
  - §3 `ReviewCard` line: `interface ReviewCard { itemId: string; itemType: 'word' | 'custom' | 'sentence'; fsrs: Card; practised?: true }`
  - §5 Archív settings list: add "automatic review (on/off, daily limit)".

- [ ] **Step 2: Full verification** — `npm run validate:data && npm test && npm run lint && npm run build` — Expected: all green.

- [ ] **Step 3: Commit and push**
```bash
git add CLAUDE.md docs/superpowers/plans/2026-09-30-auto-review.md
git commit -m "docs: automatic review of practised words"
git push origin main
```

- [ ] **Step 4: Phone checks for Adam**
  1. Reopen SOMOS (new commit in Nastavenia). Domov "Na zopakovanie" grows by at most 20.
  2. Zopakovať: practised words appear as normal flashcards.
  3. A Slovná zásoba lesson: those words are not due today; wrong ones come back tomorrow.
  4. ⭐ a practised word, then remove the ⭐: it stays in review.
  5. Nastavenia → Automatické opakovanie: switch off → the count drops; limit 10 → at most 10 practised words.

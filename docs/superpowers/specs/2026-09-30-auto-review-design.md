# Automatic review of practised words — design

Date: 2026-09-30 · Status: approved in chat, awaiting spec review

## Goal

Today only ⭐ items and custom words come back in "Na zopakovanie". Words practised in lessons
fade unless Adam stars them. From now on, every word practised in **Slovná zásoba** or
**Časovanie** joins spaced repetition automatically, scheduled by how the lesson answer went,
with a daily limit so review never gets overwhelming.

Non-goals: sentences from sentence exercises (they still need ⭐), a separate review session,
changing the review screen, syncing settings across devices.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| What joins review | Words only: vocab task words + the verb's Word from conjugation tasks |
| First review | The lesson answer counts as a review: right → back in a few days, wrong → back tomorrow; later lesson answers keep updating the schedule |
| Daily load | At most N practised-only words per day (default 20; 10/20/30/50 in Nastavenia) + an on/off switch; ⭐ and own words never limited |
| Past lessons | Included: schedules are rebuilt once from the stored answers |
| Storage | One card per word with a `practised` flag (not a separate queue) |

## Behaviour

- **Which answer counts.** Per word, per local day, only the first lesson answer counts
  (sk→es and es→sk of one word, the correction round, a verb drilled twice, the same word in a
  Chyby lesson). If the card was already reviewed that day (review session or an earlier lesson),
  the lesson answer changes nothing. "Moja odpoveď bola tiež správna" counts as right.
- **Right** = FSRS `Good`, **wrong** = FSRS `Again`, computed with a scheduler **without
  short-term learning steps** (`enable_short_term: false`), so a new word answered right is due
  in a few days, not in 10 minutes. After `Again` the card is due no earlier than the start of the
  next local day.
- **One card per word.** A practised word that is also ⭐ has one card: lessons and reviews
  both move it. Removing the ⭐ from a practised word keeps its card (still `practised`).
  Starring a practised word just makes it ⭐ (no longer counted in the limit).
- **Past lessons.** At startup, every word with practice answers but no card gets one, built by
  replaying its answers oldest first with the same rules. Existing cards (⭐ words) keep their
  schedule but get the `practised` flag, so removing the ⭐ later keeps them. Running it again
  changes nothing.
- **Daily limit.** "Practised-only" = `practised` and the word is not ⭐. Due today are:
  all due ⭐ words, ⭐ sentences and custom words; plus the practised-only words due today, most
  overdue first, at most `limit − (practised-only words already reviewed today)`. Switched off:
  no practised-only words at all (their schedules stay stored and keep being updated by
  lessons, so switching back on continues where it left off).
- **Same numbers everywhere.** Review session, Domov "Na zopakovanie", Archív "Zopakovať" and the
  push reminder progress (`dueToday`, `dueTomorrow`) all use the same selection.
  `dueTomorrow` applies the full limit (nothing reviewed yet that day).

## Nastavenia

New section **"Automatické opakovanie"** (after "Denný cieľ"):
- Switch "Opakovať precvičené slová", note "Slová zo Slovnej zásoby a Časovania sa vrátia na zopakovanie."
- "Najviac za deň" with chips 10 / 20 / 30 / 50 (shown only when the switch is on).
Stored per device in localStorage `somos-auto-review` = `{ enabled: boolean, limit: 10 | 20 | 30 | 50 }`,
default `{ enabled: true, limit: 20 }`; corrupt values fall back to the default.
Not part of the backup (like the daily goal).

## Code

### Data (`src/lib/db.ts`)

`ReviewCard` gains `practised?: true`. Not indexed → no Dexie version bump. The backup validator
already keeps unknown fields, so backups carry the flag.

### New `src/lib/practice.ts`

Pure (unit-tested):
- `practisedWordId(exercise: string, itemId: string): string | undefined`:
  `vocab` `"perro:sk-es"` → `"perro"` (if the word exists); `conjugation` `"tener:preterito:yo"` →
  `wordIdByVerb.get("tener")`; anything else → `undefined`.
- `applyPractice(card: Card | undefined, correct: boolean, at: Date): Card | undefined`:
  `undefined` card → start from `createEmptyCard(at)`. If `card.last_review` is on the same local
  day as `at` → `undefined` (no change). Otherwise `practiceScheduler.next(card, at, correct ? Good : Again).card`,
  with `due` raised to the start of the next local day when wrong.
- `replayPractice(attempts: { exercise: string; itemId: string; correct: boolean; at: number }[]): Map<string, Card>`:
  sorts by `at`, folds `applyPractice` per word id.

Database glue (thin, verified on the phone):
- `recordPractice(exercise, itemId, correct, now = new Date())`: word id → read card `['word', id]` →
  `applyPractice` → put `{ ...existing, itemType: 'word', itemId: id, fsrs, practised: true }`.
  Called in `LessonPage.next()` next to `recordAttempt`.
- `syncPracticeCards()`: reads `attempts` with exercise `vocab` or `conjugation`; words without a
  card get the replayed card, existing word cards without the flag get `practised: true` (schedule
  untouched); one bulk put. Called in `main.tsx` after
  `syncReviewCards()` and in `backup.ts` after the restore's `syncReviewCards()`.

### `src/lib/srs.ts`

- `syncReviewCards()` keeps cards with `practised` (in addition to the wanted set).
- `removeReviewCard(itemType, itemId)` leaves a `practised` card in place.
- New pure `selectDue(cards: ReviewCard[], savedWordIds: ReadonlySet<string>, settings: AutoReviewSettings, reviewedToday: ReadonlySet<string>, now: Date): ReviewCard[]`
  implementing the daily limit (`reviewedToday` = word ids of practised-only cards reviewed today,
  from `review` attempts `"word:<id>"` since the start of the day).
- New `loadDueCards(now)` (DB: cards, saved word ids, today's review attempts, settings → `selectDue`),
  used by `useReviewOverview`, `reviewQueue.loadDueEntries` and `reminderProgress`.

### New `src/lib/autoReview.ts`

`AutoReviewSettings`, `parseAutoReview(raw)`, `useAutoReviewSettings()`, `setAutoReview(next)`,
mirroring `dailyGoal.ts` / `reminder.ts` settings.

### New `src/features/archive/AutoReviewSettings.tsx`

The Nastavenia section above; added to `SettingsPage.tsx` after the daily goal.

## Testing

- `practice.test.ts`: word mapping (vocab both directions, conjugation → verb Word, unknown ids,
  other exercises); first answer right → due ≥ 2 days later; wrong → not due today, due tomorrow;
  second answer the same day → no change; answer the next day → updates; replay order-independent
  of input order; one count per word per day in replay.
- `srs` / selection tests: ⭐ and custom always included; practised-only capped at the limit,
  most overdue first; `reviewedToday` lowers the cap; switch off → none; a practised ⭐ word
  is not limited; nothing due → empty.
- `autoReview` parse tests: defaults, corrupt, out-of-range limit.
- `npm test`, `npm run lint`, `npm run build`.
- Phone: first start after the update → Domov count grows by at most 20; a Slovná zásoba lesson →
  those words aren't due today; un-starring a practised word keeps it in review; switch off →
  count drops; limit 10 → count drops; backup export + import keeps everything.

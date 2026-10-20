# Tests and checkpoints — design

Date: 2026-10-18. Approved by Adam in chat ("zatiaľ takto môže byť … môžeš implementovať"); his phone test and
feedback come after the push.

## Why

Lessons and reviews let the learner drill without ever having to show what he knows. Tests give a goal to aim
at and prepare for: a checkpoint per topic and an exam per level, each mixing every kind of exercise.
Modelled on Busuu (chapter checkpoints + level), Duolingo (unit reviews, checkpoints) and Babbel (a badge per level).

## Decisions (Adam's)

- Two kinds of test: **topic test** (topic × level) and **level exam** (A1, A2, B1).
- Nothing is locked: a test is a goal and a badge, lessons stay free.
- A test runs like an exam: no right/wrong while answering, no second try, no "Prečo?"; result at the end.
- Passed at ≥ 80 %. A failed test can be retaken at once; every attempt draws new tasks.

## Tests

| | Topic test | Level exam |
|---|---|---|
| Tasks | 15 | 30 |
| Drawn from | the topic at that level, topped up from lower levels when short | everything of that level |
| Exists when | the topic has ≥ 10 words + sentences at that level | always |
| Mix | vocab 4, choice 2, cloze 3, conjugation 2, builder 2, dictation 1, translation 1 | vocab 8, choice 3, cloze 5, conjugation 5, builder 3, dictation 3, translation 3 |

- No speaking (needs a microphone and speech recognition).
- A type without enough items leaves its places to the other types.
- No sentence appears twice in one test (a builder would give away a cloze).
- Conjugation asks the tenses of the level: A1 presente, progresivo, pretérito; from A2 also imperfecto, futuro.
  Topic tests conjugate the topic's verbs (its verb Words), falling back to the level's verbs.
- Tasks are grouped by type in that order (easier types first), so the instruction changes rarely.

## Flow

- **Cvičiť** gets a "Testy" card (like "Gramatika") → `/practice/tests`.
- **Testy**: level switch A1 / A2 / B1; the level exam card on top (topics passed n/N, exam result, badge);
  below it the topic tests with ✓ / best score / not tried.
- **Test intro** `/practice/test?level=A1[&topic=food]`: what is inside, the rules, best result,
  buttons "Pripraviť sa" and "Začať test".
- **Test** (full screen, no tab bar): task, "Ďalej". Leaving asks first and nothing counts.
- **Result**: score, passed / not yet, every answer with the wrong ones marked. A wrong translation or vocab
  answer offers "Moja odpoveď bola tiež správna", which raises the score.
  Answers are stored as attempts (streak, daily goal), wrong ones go to Chyby (an override takes it out again).
- **Pripraviť sa** = a normal 10-task practice lesson (`/practice/lesson?prepare=A1[:food]`) drawn from the
  same material, items on the mistakes list first, then the least practised.
- **Domov**: a "Ďalší cieľ" tile: the current level (lowest one without a passed exam), topics passed n/N and the
  next topic test not passed; once all topics are passed, the level exam.

## Code

- `src/lib/tests.ts` — test ids, which tests exist, `createTest()` (pure, random injected), `prepareLesson()`.
- `src/lib/testProgress.ts` — results in localStorage (`somos-tests-v1`): best score, total, passed, passedAt,
  attempts; parse / merge for the JSON backup (the better result stays).
- `src/features/tests/` — TestsPage, TestIntroPage, TestPage (runner + result).
- `LessonPage` only gets the `prepare` entry; the exam mode is its own small player built on `TaskView` and `gradeTask`.
- Texts in `src/i18n` (sk + en).

## Not now

Time limit, "jump here" (a passed exam marking its topics), downloadable certificate, locking.

## Testing

Unit tests for `createTest` (sizes, mix, fallback, no repeated sentence, tenses by level) and the result store;
a Playwright spec: open a topic test, answer, see the result and the record on the tests page.

## Addendum 2026-10-20: exercise tests

Adam's wish: the numbered lessons of an exercise at **Všetko × level** (e.g. Slovná zásoba · Všetko · A1, 53 lessons)
end with a test of that exercise alone — 30 tasks drawn like the lessons draw them, passed at 80 %, exam style.
Every exercise type has one per level (conjugation: "Všetky časy"); topics and "Všetky úrovne" have none.
It is the last item of the lesson list, **locked until every lesson before it is passed** (also by URL), and
the bottom button offers "Spraviť test" once they are. Key `exercise:<type>:<level>`, URL `?level=A1&type=vocab`;
"Pripraviť sa" is a lesson of the same exercise and level, mistakes first. Not on the Testy page or Domov.

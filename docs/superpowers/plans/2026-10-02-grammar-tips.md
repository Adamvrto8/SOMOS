# Grammar tips ("Prečo?") Implementation Plan

> **For agentic workers:** Adam's standing choice is native execution: implement every task inline in
> the session (superpowers:executing-plans), no subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a wrong answer the feedback sheet links to a short Slovak grammar tip (for ser/estar
with the reason that applies in that sentence); the same tips are a browsable handbook under Cvičiť.

**Architecture:** Tips are static JSON bundled like the rest of the content and checked by the data
validator. A pure function maps a graded task to its tip. One `TipContent` component renders a tip,
used by a full-screen overlay in the lesson (opened through a history entry, so the phone's back
button closes it) and by a handbook page.

**Tech Stack:** Vite + React + TypeScript, react-router, Tailwind tokens, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-02-grammar-tips-design.md`

## Global Constraints

- UI strings Slovak; code, comments, commits English. Spanish examples Mexican: no vosotros, no
  Spain-only vocabulary (`checkSpanish` in the validator rejects both).
- Tip ids equal the `Grammar` tags where a tag exists: `presente`, `progresivo`, `preterito`,
  `imperfecto`, `futuro`, `ser-estar`, `gender`, `articles`; new: `preterito-imperfecto`,
  `adjectives`, `reflexive`, `accents`.
- The link shows only when `grade.verdict === 'wrong'` and a tip exists for the task.
- Never touch Adam's dev server on 5173; e2e and manual checks use port 5199.
- Stage explicit paths (Adam's `.gitignore` edit stays out of every commit).
- Tap targets ≥ 44px; layout checked at 375px.

## Review Focus

1. The tip is open and the learner presses the phone's back button → the tip closes, the lesson
   stays on the same task with its feedback sheet (not rebuilt, not left). Pinned in Task 3's e2e.
2. A lesson reloaded (F5) while `history.state` still says a tip is open → no crash; the lesson
   starts normally and no overlay hangs over a task without feedback. Pinned in Task 3's e2e.
3. A ser/estar cloze whose `why` is missing or names a rule of the other verb → the build must not
   ship it: validator error. Pinned in Task 1.
4. `/practice/grammar/<unknown id>` → the "not found" screen, not a blank page. Pinned in Task 4's e2e.
5. A task with no tip (vocabulary, vocabulary-hint cloze) answered wrong → no link at all, the sheet
   looks as today. Pinned in Task 2's unit tests and Task 3's e2e.

---

### Task 1: Tip data, the ser/estar reasons, validator

**Files:**
- Modify: `src/data/types.ts` (add `TipRule`, `Tip`, `Cloze.why`)
- Create: `src/data/tips.json` (12 tips)
- Modify: `src/data/index.ts` (export `tips`, `tipById`)
- Modify: `scripts/validate-data.ts` (tip checks, `why` checks)
- Modify: `src/data/sentences/*.json` (`why` on the 60 ser/estar clozes)

**Interfaces — Produces:**

```ts
export interface TipRule {
  id: string // unique within its tip; a ser/estar cloze points at one with `why`
  title: string
  text?: string
  examples: Example[] // 1–3
  verb?: 'ser' | 'estar' // ser-estar only
  because?: string // ser-estar only: "Ide o pôvod, preto ser."
}
export interface Tip { id: string; title: string; intro: string; rules: TipRule[]; related?: string[] }
// Cloze gains: why?: string
// src/data/index.ts: export const tips: Tip[]; export const tipById: Map<string, Tip>
```

ser-estar rule ids — ser: `identity`, `origin`, `profession`, `trait`, `time`, `possession`, `event`;
estar: `place`, `state`, `result`, `expression`, `progressive`. (`expression` — estar de acuerdo,
estar en oferta — is added to the spec's list because two sentences need it.)

Rule for each cloze (sentence id → rule):

| rule | sentences |
|---|---|
| identity | s520, s407, s444 |
| origin | s001, s008, s062, s063 |
| profession | s192, s206, s598 |
| trait | s244, s234, s399, s079, s268, s027, s300, s440 |
| time | s048, s172, s174, s175, s420 |
| event | s424, s173 |
| place | s033, s132, s136, s005, s263, s026, s031, s294, s224, s572, s188, s056 |
| state | s324, s325, s335, s431, s534, s018, s003, s064, s065, s396, s436, s118, s125, s496, s273, s287, s596 |
| result | s076, s485, s559, s455 |
| expression | s467, s226 |

- [ ] **Step 1: Validator first.** Add to `validate-data.ts`: load `tips.json` (`[]` if the file is
  missing), the tip checks from the spec, "every `GRAMMAR` tag has a tip", and in the cloze loop:
  hint starts with `ser/estar ·` → `why` must name a `ser-estar` rule whose `verb === c.lemma`;
  otherwise `why` must be absent.
- [ ] **Step 2: Run `npm run validate:data`.** Expected: FAIL — 8 "no tip for grammar tag" + 60
  "ser/estar cloze needs `why`".
- [ ] **Step 3: Types + `index.ts` exports.**
- [ ] **Step 4: Write `tips.json`** — the twelve tips of the spec's table, each with an intro and
  3–7 rules with 1–3 examples.
- [ ] **Step 5: Annotate the 60 clozes** with a scratchpad script that inserts `"why"` after the
  `"hint": "ser/estar …"` line of each sentence in the table above (text edit, formatting kept).
- [ ] **Step 6: `npm run validate:data`** → PASS. Then break one `why` by hand (`origin` on an estar
  cloze) → FAIL with that sentence named; restore.
- [ ] **Step 7: Commit** `feat(data): grammar tips and the ser/estar reason of each cloze`.

### Task 2: `tipFor()`

**Files:**
- Create: `src/lib/tips.ts`, `src/lib/tips.test.ts`

**Interfaces:**
- Consumes: `tipById` (Task 1), `Task`, `Grade` from `lesson.ts`.
- Produces:

```ts
export interface TaskTip { tip: Tip; rule?: TipRule; targeted: boolean }
export function tipFor(task: Task, grade: Grade): TaskTip | undefined
/** "Prečo?" for a targeted tip, "Gramatika: <title>" otherwise. */
export function tipLabel(found: TaskTip): string
```

- [ ] **Step 1: Failing tests** (`tips.test.ts`), with tasks built by `taskFromItem`:
  - `cloze s063#0` ("Somos de Eslovaquia") → tip `ser-estar`, rule `origin`, targeted
  - a cloze with hint `tener · yo · pretérito` → `preterito`; `… · gerundio` → `progresivo`;
    hint `člen` → `articles`; hint `prídavné meno: …` → `adjectives`; hint `oči` → undefined
  - `choice` of the same sentence → same as cloze
  - `conjugation hablar:imperfecto:yo` → `imperfecto`, targeted; `…:progresivo:…` → `progresivo`
  - `translation` of a sentence tagged `['presente','ser-estar']` → `ser-estar`, not targeted, no
    rule; a sentence without tags → undefined
  - `vocab` → undefined
  - a grade with `check.meanings` on any typed task → `accents`, targeted
  - dataset sweep: every sentence's cloze[0] and every `TABLE_TENSES` tense resolve without
    throwing; every ser/estar cloze has a rule
  - `tipLabel`: `Prečo?` / `Gramatika: Pretérito (minulý čas dokonavý)`
- [ ] **Step 2: `npx vitest run src/lib/tips.test.ts`** → FAIL (module missing).
- [ ] **Step 3: Implement** in the order of the spec (accent meaning → cloze/choice by hint →
  conjugation → sentence tags by priority → none).
- [ ] **Step 4: Tests pass; `npm test`.**
- [ ] **Step 5: Commit** `feat(tips): map a graded task to its grammar tip`.

### Task 3: The tip in the lesson

**Files:**
- Create: `src/features/grammar/TipContent.tsx`, `src/features/grammar/TipSheet.tsx`
- Modify: `src/features/exercises/FeedbackSheet.tsx` (prop `why`), `src/features/exercises/LessonPage.tsx`
- Create: `e2e/grammar.spec.ts`

**Interfaces:**
- Consumes: `tipFor`, `tipLabel`, `TaskTip` (Task 2), `tipById`.
- Produces:

```tsx
// TipContent: one tip, top to bottom as in the spec.
interface TipContentProps {
  tip: Tip
  rule?: TipRule // highlighted; with `sentence` it also fills the "V tejto vete" box
  sentence?: { es: string; answer: string }
  onOpenTip: (id: string) => void // "Pozri aj"
}
// TipSheet: full-screen dialog around TipContent.
interface TipSheetProps { children: ReactNode; title: string; onClose: () => void }
// FeedbackSheet: why?: { label: string; onOpen: () => void }
```

LessonPage: `const openTip = (id) => navigate({ search: location.search }, { state: { tip: id } })`;
the overlay renders when `grade && tipById.get(location.state?.tip)`; ✕ and Esc call
`navigate(-1)`; "Pozri aj" navigates with `replace: true`. The task's own rule and sentence are
shown only while the open tip is the task's tip.

- [ ] **Step 1: Failing e2e** (`grammar.spec.ts`):
  1. *the reason of a ser/estar sentence*: cloze lesson 1 (A1), give up tasks until one with a
     `ser/estar` pill; give it up → `Prečo?` → dialog "ser a estar" with "V tejto vete" and the
     rule's `because`; `page.goBack()` → dialog gone, the feedback sheet and the same `n/10` still
     there; open again, `page.reload()` → the lesson shows a task and no dialog.
  2. *no link without a tip or after a right answer*: vocab lesson, give up → no `Prečo?` and no
     `Gramatika:` link; cloze answered right → no link.
- [ ] **Step 2: `npx playwright test e2e/grammar.spec.ts`** → FAIL (no link).
- [ ] **Step 3: Implement** TipContent, TipSheet, the FeedbackSheet link (lightbulb, ≥44px, above
  "Pokračovať"), the LessonPage wiring.
- [ ] **Step 4: e2e pass**; screenshots at 393×881, dark + light, of the sheet with the link and of
  the open tip.
- [ ] **Step 5: Commit** `feat(lessons): "Prečo?" opens the grammar tip of a wrong answer`.

### Task 4: The handbook

**Files:**
- Create: `src/features/grammar/GrammarPage.tsx`, `src/features/grammar/TipPage.tsx`
- Modify: `src/App.tsx` (routes `practice/grammar`, `practice/grammar/:id`),
  `src/features/exercises/PracticePage.tsx` (the "Gramatika" card)
- Modify: `e2e/grammar.spec.ts`

- [ ] **Step 1: Failing e2e**: Cvičiť → card "Gramatika" → 12 links; open "ser a estar" → heading
  and both groups; "Pozri aj" → another tip's heading; `/practice/grammar/nope` → the not-found text.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (list: title + intro as cards; page: `BackButton` + `TipContent`,
  `onOpenTip` = `navigate('/practice/grammar/' + id)`; unknown id → `NotFound`).
- [ ] **Step 4: e2e pass; screenshot of the list and a page at 375px.**
- [ ] **Step 5: Commit** `feat(grammar): the tips as a handbook under Cvičiť`.

### Task 5: Docs and release

**Files:** `CLAUDE.md`

- [ ] **Step 1:** CLAUDE.md — §1 exercises/features (grammar tips), §3 data model (`Tip`,
  `TipRule`, `Cloze.why`, validator rules), §5 screens (Lekcia link, Cvičiť card), §7 structure
  (`features/grammar`, `tips.json`), §8 a line under phase 7.
- [ ] **Step 2:** `npm run validate:data`, `npm test`, `npm run lint`, `npm run build`,
  `npm run test:e2e` — all pass.
- [ ] **Step 3:** Commit `docs: grammar tips`, push to `main`, tell Adam what to test on the phone.

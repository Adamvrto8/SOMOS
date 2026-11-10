# Grammar screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Adam left the method to Claude: Native). Steps use checkbox (`- [ ]`) syntax.

**Goal:** `/practice/grammar` gets seven areas, a search field and level chips (spec `docs/superpowers/specs/2026-11-10-grammar-screen-design.md`).

**Architecture:** `Tip.area` in the data (validated), a pure `searchTips` in `src/lib/tipSearch.ts` built on `fold()`, `GrammarPage` rewritten around `useSearchParams`.

**Tech Stack:** React, react-router, Tailwind tokens, Vitest, Playwright.

## Global Constraints

- UI strings Slovak and English (`src/i18n/sk.ts`, `en.ts`); code and commits English. No new dependency.
- Tap targets ≥ 44 px, 375 px width without horizontal scroll. No commit before Adam's phone check unless he says so.
- E2E only with `E2E_PORT=5299 npm run test:e2e -- --workers=3`; never kill the dev server on 5173.

## Review Focus

1. A query with accents or capitals ("Quizá", "SUBJ") must match — unit test.
2. Back from a tip must return to the same query and level — e2e.
3. A level filter that leaves an area empty must hide the area, and no tip may be listed twice — unit/e2e count.
4. English UI searches English texts — unit test.

### Task 1: `area` in the data

**Files:** `src/data/types.ts`, `src/data/tips.json`, `scripts/validate-data.ts`.

- [ ] Add `export type TipArea = 'tenses' | 'moods' | 'verbs' | 'nouns' | 'pronouns' | 'sentences' | 'spelling'` and `area: TipArea` to `Tip`; `TIP_AREAS` list exported from `types.ts`.
- [ ] Insert `"area"` after the `"level"` line of every tip per spec §2 (script).
- [ ] Validator: unknown or missing area fails; all 7 areas used.
- [ ] Run `npm run validate:data`. Expected: clean.

### Task 2: `tipSearch.ts` (TDD)

**Files:** `src/lib/tipSearch.ts`, `src/lib/tipSearch.test.ts`.

- [ ] Tests first (spec §4), run, see them fail.
- [ ] `searchTips(tips: Tip[], query: string): Tip[]`: folded words of the query must all match (word prefix) in the haystack of the localized title, intro, rule titles and texts, the Spanish examples and `ideas`; ranking title (3) > rule title (2) > rest (1), stable.
- [ ] Expected: tests pass.

### Task 3: Page and strings

**Files:** `src/features/grammar/GrammarPage.tsx`, `src/i18n/sk.ts`, `src/i18n/en.ts`.

- [ ] Strings `grammar.areas`, `searchPlaceholder`, `noResults`, `clear`, `results(n)`, `all`.
- [ ] Page: search input + level chips (state in `?q=&level=`, `replace`), areas with counts, results list when `q` set, empty state.
- [ ] `npm run build` and `npx vitest run` green.

### Task 4: e2e and docs

**Files:** `e2e/grammar.spec.ts`, `docs/grammar-gap-analysis.md` (§10), roadmap line, memory.

- [ ] Update the handbook test (rows under "Všetko" = 49, chip narrows, search narrows, Back keeps the query).
- [ ] Full checks: `validate:data`, `validate:es`, `npm test`, `npm run build`, `E2E_PORT=5299 npm run test:e2e -- --workers=3`.
- [ ] One Sonnet reviewer over the diff; fix Critical/Important; report with the phone-test list.

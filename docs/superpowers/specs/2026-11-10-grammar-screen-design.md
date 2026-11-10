# Grammar screen (roadmap §4a.5, part B): design

Date: 2026-11-10. Status: draft for Adam's review. Adam chose: **areas + search + level filter** (2026-11-10).
Background: `src/features/grammar/GrammarPage.tsx` lists the 49 tips under A1 / A2 / B1 / B2 headings; a tip page
(`TipPage`, `TipContent`) already has "Pozri aj" (`related`) and opens from "Prečo?" and the Cesta. Roadmap §4a.5 asks for a clearer
structure, easy finding (search, grouping by level and grammar area) and links between related points. Links exist; search and areas do not.

## 1. Goal

A learner who wants "the subjunctive", "ser vs estar" or "quizá" gets there in one or two taps: type into a search field, or open an area
and pick a level. Nothing about the tips themselves, "Prečo?", Cesta or the tip page changes.

Out of scope: new tip content, a search over words (Hľadať keeps that), progress marks on tips, reordering of the Cesta.

## 2. Screen (`/practice/grammar`, unchanged route)

```
‹ back
Gramatika
[ 🔍 Hľadať v gramatike…            ]      search field (not autofocused)
( Všetko ) ( A1 ) ( A2 ) ( B1 ) ( B2 )     level chips, one active
─ Slovesá a časy · 15 ─────────────
  presente                       A1   ›
  …
─ Spôsoby a podmienky · 8 ─────────
```

* **Areas** (7), in this order, each a section with a count; tips inside sorted A1 → B2, then in the order of `tips.json`:
  1. `tenses` Slovesá a časy: presente, preterito, imperfecto, preterito-imperfecto, ir-a, futuro, progresivo, perfecto,
     pluscuamperfecto, condicional, conditional-perfect, imperativo, periphrases, obligation
  2. `moods` Spôsoby a podmienky: subjuntivo, subjuntivo-wishes, subjuntivo-clauses, subjuntivo-aunque, subj-imperfecto, doubt,
     si-clauses, cond-connectors
  3. `verbs` Ser, estar a iné slovesá: ser-estar, ser-estar-meaning, cambio, hay-estar, gustar, verb-prep, passive-se, ser-passive
  4. `nouns` Podstatné a prídavné mená: gender, articles, adjectives, demonstratives, possessives, comparisons
  5. `pronouns` Zámená: object-pronouns, reflexive, personal-a, relatives, relatives-prep, relatives-mood, interrogatives
  6. `sentences` Vety a spojky: negation, temporal, cause, reported, por-para
  7. `spelling` Pravopis: accents
* A tip row: title, one-line intro (2 lines clamp as today), a small level badge (A1…B2), chevron. The level headings of today are gone;
  the badge replaces them.
* **Level chips** filter every area; areas left empty by the filter disappear. "Všetko" is the default.
* **Search** (case- and accent-insensitive, every word of the query must match, also as a prefix: "subj" finds subjuntivo):
  title, intro, rule titles and texts, the tip's English `ideas`, and the Spanish example sentences. While the query is not empty the
  areas collapse into one list "Výsledky · n" ordered by relevance (title match first, then rule title, then the rest); the level chips
  still apply. No match: a short message and a "Vymazať hľadanie" button.
* State in the URL (`?q=quiz%C3%A1&level=B1`, `replace` navigation) so Back from a tip returns to the same list; a reload keeps it.
* English UI: the same screen with `localizedTip` titles; area names in `i18n/en.ts` and `sk.ts`; search runs over the localized
  texts (title, intro, rules) of the current language plus the Spanish examples.

## 3. Data and code

* `Tip.area: TipArea` (`src/data/types.ts`) with the 7 ids above; `area` added to every tip in `tips.json`;
  `scripts/validate-data.ts` fails a tip without a known area (and keeps the table in §2 as the only place).
* `src/lib/tipSearch.ts`: `searchTips(tips, query, language): Tip[]` pure, built on `fold()` (the app's accent-folding). Unit-tested.
* `src/features/grammar/GrammarPage.tsx` rewritten around `useSearchParams`; small components `TipRow`, `AreaSection` in the same folder.
* i18n: `grammar.areas`, `grammar.searchPlaceholder`, `grammar.noResults`, `grammar.clear`, `grammar.results(n)`, `grammar.all`.
* No new dependency, nothing stored, works offline.

## 4. Tests

* `tipSearch.test.ts`: "subj" finds the subjunctive tips; "quiza" (no accent) finds `doubt`; "ser estar" finds `ser-estar` and
  `ser-estar-meaning`; two words must both match; empty query returns all; English texts are searched in English.
* `localized.test.ts` / validator: every tip has an area; the 7 areas are all used.
* `e2e/grammar.spec.ts`: the page shows 49 rows under "Všetko"; a level chip narrows; a search narrows and shows the count; Back from a
  tip keeps the query; the 375 px layout has no horizontal scroll and 44 px tap targets.

## 5. Order of work

1. Area field + validator + types. 2. `tipSearch.ts` with tests. 3. Page, i18n. 4. e2e and phone check at 375 px.
5. Docs (gap-analysis §10, roadmap line), memory.

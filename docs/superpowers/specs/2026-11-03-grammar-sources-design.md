# Grammar sources database (part C, step 5) — design

Follows the part B content review §4.5 ("one record per grammar point: CEFR level by the Plan curricular, the rule in
our own words, examples, a Mexican note, source links, exercise ideas") and the roadmap
`docs/superpowers/plans/2026-11-03-after-part-c-roadmap.md` §2. Approved by Adam on 2026-11-03 (approach A, with the
change below for other Spanish variants and native languages).

## 1. Where we are

The 28 tips in `src/data/tips.json` already hold most of a record: `level` (by the Plan curricular), the rule in our
own words (`intro`, `rules[].text`), examples (`rules[].examples`), and an English overlay in `src/data/en/tips.json`.
What is missing:

- **Sources** are free strings ("Plan curricular del Instituto Cervantes (2006), Gramática B1", "UIMP 2026, Lengua
  Española B1, semana 3"): no link, the same work spelled out again in every tip, nothing checks them beyond "not empty".
- **A note on regional use** (the review asked for a Mexican note).
- **Exercise ideas** for later content work.

## 2. Looking ahead (Adam, 2026-11-03)

For the public release Adam wants Spain Spanish beside Mexican, and possibly Czech (his first language) beside Slovak
and English as the learner's language. This step builds neither, but its data must not block them:

- Regional notes are keyed by **Spanish variant**, not a field named after Mexico: `mx` now, `es` (Spain) later.
- Learner-facing text stays Slovak in `tips.json` with translations in the overlay files, so a Czech overlay is one more
  file of the same shape.
- Citation locators (`where`) are written in the **source's own language** (Spanish), so they never need translating.

## 3. Data

### 3.1 `src/data/sources.json` (new)

```ts
interface Source {
  id: string        // "pcic", "uimp-a1", "uimp-b1", "uimp-b2", "rae-ortografia"
  short: string     // how a citation starts: "Plan curricular del Instituto Cervantes (2006)", "UIMP 2026, Lengua Española B1"
  title: string     // full title: "Plan curricular del Instituto Cervantes. Niveles de referencia para el español"
  author: string    // "Instituto Cervantes", "Universidad Internacional Menéndez Pelayo", "RAE y ASALE"
  year: number
  url?: string      // https only; written only when checked to load while writing the step
}
```

The first five are exactly the sources the tips cite today. The UIMP program PDFs linked in the review are the URLs to
check; the Plan curricular's online version answered 404 during the review, so it may stay without `url`.

### 3.2 Changes to `Tip` (`src/data/types.ts`)

```ts
type SpanishVariant = 'mx' | 'es'          // 'es' = Spain, for later

interface SourceRef {
  source: string                            // a Source id
  where: string                             // in the source's language: "Gramática B1", "semana 3", "tilde diacrítica"
}

interface Tip {
  // … unchanged fields …
  sources: SourceRef[]                      // was string[]
  variants: Partial<Record<SpanishVariant, string>>  // learner language (Slovak); `mx` required now
  ideas: string[]                           // English, internal, 1–3, never shown
}
```

- `variants.mx`: one or two Slovak sentences on how Mexico uses the point; when it does not differ from the general
  rule, it says so plainly ("V Mexiku rovnako ako inde."). Mentioning Spain-only forms (vosotros, coche) is allowed
  here, as in other Slovak notes.
- English overlay `src/data/en/tips.json`: each tip gains `variants` with the same keys.
- `ideas`: short exercise ideas for future steps ("rewrite the object as lo/la", "choose ser or estar for an adjective
  that changes meaning"). English because they are working notes, like code comments.
- Three citations carry Slovak words in parentheses today ("Gramática A2 (kladný), B1 (záporný)"). Their `where`
  becomes Spanish ("Gramática A2 (imperativo afirmativo), B1 (negativo)").

### 3.3 Display

`TipContent` keeps its "Podľa: …" line; it is built as `` `${source.short}, ${ref.where}` `` joined by " · " — the same
text as today for every citation except the RAE one, whose ": " becomes ", ". `LocalTip.sources` becomes the built
strings, so the component does not change. `variants` and `ideas` are not shown (no new UI in this step).

## 4. Checks (`npm run validate:data`)

- Every `SourceRef.source` exists in `sources.json`; every source is cited by at least one tip; ids unique.
- `where` and `short`/`title`/`author` non-empty; `year` a plausible integer; `url`, when present, starts with `https://`.
- Every tip has at least one source, `variants.mx` non-empty, and 1–3 non-empty `ideas`.
- Only known variant keys (`mx`, `es`).
- The English overlay has `variants.mx` for every tip that has an English entry.

A unit test covers building the "Podľa" strings (`localizedTip`), including a tip with two sources.

## 5. Content

Claude writes the 28 `variants.mx` notes and the `ideas` in its own words — no textbook text is copied (copyright); a
note may point to a source but not quote it. Adam spot-checks the Mexican notes against what he knows. The English
overlay gets the same notes translated.

## 6. Out of scope

A screen for sources or variant notes; grammar points without a tip; changes to `intro`/`rules`; Spain Spanish or
Czech themselves (only the data shape allows them).

## 7. Testing

`validate:data`, `npm test` (new `localizedTip` test), `npx tsc -b`, `npm run build`, and the e2e suite (the tip
sheet's "Podľa" line is rendered in grammar e2e tests, if any assert it).

# Grammar sources database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 28 grammar tips' free-text sources into references to a checked source list, and give every tip a regional note keyed by Spanish variant (`mx` now) and 1–3 exercise ideas.

**Architecture:** A new `src/data/sources.json` lists the works cited; each tip's `sources` becomes `{ source, where }[]`. `localizedTip` builds the same "Podľa: …" strings the tip sheet shows today, so no component changes. Two new tip fields, `variants` (learner-language text, with the English overlay) and `ideas` (English working notes), are data only. `scripts/validate-data.ts` guards all of it.

**Tech Stack:** TypeScript, JSON data, Vitest, the Node validator script, Playwright (unchanged tests).

**Spec:** `docs/superpowers/specs/2026-11-03-grammar-sources-design.md`

## Global Constraints

- Work in the worktree `C:\CODE\SOMOS-sources`, branch `grammar-sources` (from `main` 883a5f8). Run e2e there with `E2E_PORT=5296 npm run test:e2e -- --workers=3`.
- Learner-facing text Slovak in `src/data/tips.json`, English in `src/data/en/tips.json`; `ideas` English (working notes, never shown).
- Regional notes are keyed by Spanish variant: `SpanishVariant = 'mx' | 'es'`; `mx` required now, `es` allowed but not written in this step.
- `where` is written in the source's own language (Spanish).
- No textbook text is copied; notes and ideas are our own words.
- `url` only when it was checked to load during this work; `https://` only.
- No new UI. The "Podľa: …" line keeps its text (only the RAE citation's ": " becomes ", ").
- No `any`; code, comments, commits English; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Stage explicit paths only; never `CLAUDE.md`, `poznaky.txt`, `.gitignore`, `Design/`, `.superpowers/`. No push or merge without Adam.
- After data changes `npm run validate:data`; after `src/lib` changes `npm test`; before finishing `npx tsc -b`, `npm run build`, full e2e.

**Deviation from the spec (decided while planning):** the spec says three citations carry Slovak words; only `imperativo` does ("(kladný)", "(záporný)"). `condicional` ("cortesía", "hipótesis") and `si-clauses` ("reales", "irreales") are Spanish already and stay as they are.

## Review Focus

1. **A typo in a source id or an unused source** → `validate:data` fails naming the tip and the id, not a crash later in the app. Pinned in Task 1 (validator checks run on the real data, plus a deliberate bad id tried by hand in Step 7).
2. **The "Podľa" line in English** → the same citation strings as in Slovak (`short` and `where` are not translated). Pinned in Task 1's unit test.
3. **A tip with three sources** (`si-clauses`) and **the RAE citation** → built in order, joined by " · ". Pinned in Task 1's unit test.
4. **The English overlay without `variants.mx`** (a new tip added later) → `validate:data` fails for that tip. Pinned in Task 2.
5. **A Slovak note that mentions Spain-only words** (vosotros, coche) → allowed: Slovak notes are not checked as Spanish. Pinned in Task 2 by not calling `checkSpanish` on `variants`.

---

### Task 1: Source list and structured citations

**Files:**
- Create: `src/data/sources.json`
- Modify: `src/data/types.ts` (Tip, new Source/SourceRef/SpanishVariant)
- Modify: `src/data/index.ts` (export `sources`, `sourceById`)
- Modify: `src/data/tips.json` (every `sources` line)
- Modify: `src/lib/localized.ts` (`citation`, `LocalTip.sources`)
- Modify: `scripts/validate-data.ts` (source checks)
- Test: `src/lib/localized.test.ts`

**Interfaces:**
- Produces: `interface Source { id; short; title; author; year: number; url?: string }`, `interface SourceRef { source: string; where: string }`, `type SpanishVariant = 'mx' | 'es'`, `Tip.sources: SourceRef[]`; `sources: Source[]` and `sourceById: Map<string, Source>` from `src/data`; `citation(ref: SourceRef): string` from `src/lib/localized`.
- `LocalTip.sources` stays `string[]` (built citations), so `TipContent` is untouched.

- [ ] **Step 1: Write the failing test** — append to the `describe('in English', …)` block of `src/lib/localized.test.ts` (and add `citation` to the import from `./localized`):

```ts
  it('builds the same citations in both languages, in order', () => {
    const siClauses = tipById.get('si-clauses')!
    const expected = [
      'Plan curricular del Instituto Cervantes (2006), Gramática B1 (reales), B2 (irreales)',
      'UIMP 2026, Lengua Española B1, semana 3',
      'UIMP 2026, Lengua Española B2, módulo 3',
    ]
    expect(localizedTip(siClauses).sources).toEqual(expected)
    setLanguage('en')
    expect(localizedTip(siClauses).sources).toEqual(expected)
    expect(localizedTip(tipById.get('accents')!).sources).toEqual([
      'Plan curricular del Instituto Cervantes (2006), Ortografía A1–A2',
      'RAE y ASALE (2010), Ortografía de la lengua española, tilde diacrítica',
    ])
    expect(citation({ source: 'pcic', where: 'Gramática A1' })).toBe('Plan curricular del Instituto Cervantes (2006), Gramática A1')
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/localized.test.ts`
Expected: FAIL — `citation` is not exported.

- [ ] **Step 3: Types** — in `src/data/types.ts`, above `export interface Tip`, add:

```ts
// The works the tips cite, src/data/sources.json.
export interface Source {
  id: string // "pcic", "uimp-b1"
  short: string // how a citation starts: "Plan curricular del Instituto Cervantes (2006)"
  title: string
  author: string
  year: number
  url?: string // https, written only when checked to load
}

/** A tip's citation: a Source and where in it, in the source's own language ("Gramática B1", "semana 3"). */
export interface SourceRef {
  source: string
  where: string
}

/** The Spanish a regional note is about: Mexico now, Spain later. */
export type SpanishVariant = 'mx' | 'es'
```

and in `Tip` replace `sources: string[] // citations: …` with:

```ts
  sources: SourceRef[] // what the tip is based on, shown as "Podľa: …"
```

- [ ] **Step 4: The source list** — create `src/data/sources.json` (URLs are filled in Step 6 only after checking them):

```json
[
  {
    "id": "pcic",
    "short": "Plan curricular del Instituto Cervantes (2006)",
    "title": "Plan curricular del Instituto Cervantes. Niveles de referencia para el español",
    "author": "Instituto Cervantes",
    "year": 2006
  },
  {
    "id": "uimp-a1",
    "short": "UIMP 2026, Lengua Española A1",
    "title": "Lengua Española A1. Programa de la asignatura",
    "author": "Universidad Internacional Menéndez Pelayo",
    "year": 2026
  },
  {
    "id": "uimp-b1",
    "short": "UIMP 2026, Lengua Española B1",
    "title": "Lengua Española B1. Programa de la asignatura",
    "author": "Universidad Internacional Menéndez Pelayo",
    "year": 2026
  },
  {
    "id": "uimp-b2",
    "short": "UIMP 2026, Lengua Española B2",
    "title": "Lengua Española B2. Programa de la asignatura",
    "author": "Universidad Internacional Menéndez Pelayo",
    "year": 2026
  },
  {
    "id": "rae-ortografia",
    "short": "RAE y ASALE (2010), Ortografía de la lengua española",
    "title": "Ortografía de la lengua española",
    "author": "Real Academia Española y Asociación de Academias de la Lengua Española",
    "year": 2010
  }
]
```

In `src/data/index.ts` add `import sourcesJson from './sources.json'`, `Source` to the type import, and next to `tips`:

```ts
export const sources = sourcesJson as Source[]
```

and next to `tipById`:

```ts
export const sourceById = new Map(sources.map((s) => [s.id, s]))
```

- [ ] **Step 5: Migrate the tips** — run this one-off script from the worktree root (keep it out of the repo, e.g. in the session scratchpad). It rewrites only the `"sources"` lines, so the file keeps its formatting:

```js
// migrate-sources.mjs — run: node <path>/migrate-sources.mjs
import { readFileSync, writeFileSync } from 'node:fs'
const SHORTS = {
  'Plan curricular del Instituto Cervantes (2006)': 'pcic',
  'UIMP 2026, Lengua Española A1': 'uimp-a1',
  'UIMP 2026, Lengua Española B1': 'uimp-b1',
  'UIMP 2026, Lengua Española B2': 'uimp-b2',
  'RAE y ASALE (2010), Ortografía de la lengua española': 'rae-ortografia',
}
// The one citation with Slovak words; `where` is in the source's language.
const FIX = { 'Gramática A2 (kladný), B1 (záporný)': 'Gramática A2 (imperativo afirmativo), B1 (imperativo negativo)' }
const file = 'src/data/tips.json'
const lines = readFileSync(file, 'utf8').split('\n').map((line) => {
  const m = line.match(/^(\s*)"sources": (\[.*\]),$/)
  if (!m) return line
  const refs = JSON.parse(m[2]).map((text) => {
    const short = Object.keys(SHORTS).find((s) => text.startsWith(s))
    if (!short) throw new Error(`unknown source: ${text}`)
    const where = text.slice(short.length).replace(/^(, |: )/, '')
    return `{ "source": "${SHORTS[short]}", "where": ${JSON.stringify(FIX[where] ?? where)} }`
  })
  return `${m[1]}"sources": [${refs.join(', ')}],`
})
writeFileSync(file, lines.join('\n'))
```

Check: `git diff --stat src/data/tips.json` shows 28 changed lines; `grep -c '"source": "' src/data/tips.json` ≥ 28.

- [ ] **Step 6: Check the URLs** — open each candidate (WebFetch or a browser; never a loop against any site):
  - `https://uimp.es/images/extranjeros/2026_Lengua_Esp_A1_Programa_de_la_asignatura.pdf`
  - `https://www.uimp.es/images/extranjeros/2026_Lengua_Esp_B1_Programa_de_la_asignatura.pdf`
  - `https://www.uimp.es/images/extranjeros/2026_Lengua_Esp_B2_Programa_de_la_asignatura.pdf`
  - `https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/`
  - `https://www.rae.es/ortograf%C3%ADa`

  Add `"url"` (after `"year"`) only to the entries whose page loaded and is the cited work; note the rest in the commit message.

- [ ] **Step 7: Citations in `localized.ts`** — import `sourceById` from `'../data'` and `SourceRef` from `'../data/types'`, add:

```ts
/** "Plan curricular del Instituto Cervantes (2006), Gramática B1": the same in every language. */
export function citation(ref: SourceRef): string {
  return `${sourceById.get(ref.source)?.short ?? ref.source}, ${ref.where}`
}
```

and in `localizedTip` replace `sources: tip.sources` with `sources: tip.sources.map(citation)`.

- [ ] **Step 8: Validator** — in `scripts/validate-data.ts`: add `Source` to the type import; after `const tips = …` add

```ts
const sourcesUrl = new URL('sources.json', DATA)
const sources = (existsSync(sourcesUrl) ? readJson(sourcesUrl) : []) as Source[]
```

and before `// ---------- grammar tips ----------` add a section:

```ts
// ---------- sources ----------

checkUniqueIds(sources, 'sources')
const sourceIds = new Set(sources.map((s) => s.id))
const citedSources = new Set(tips.flatMap((t) => (Array.isArray(t.sources) ? t.sources.map((r) => r.source) : [])))
for (const s of sources) {
  const where = `sources[${s.id}]`
  if (!isNonEmpty(s.short) || !isNonEmpty(s.title) || !isNonEmpty(s.author)) fail(where, 'missing short/title/author')
  if (!Number.isInteger(s.year) || s.year < 1900 || s.year > 2100) fail(where, `implausible year ${s.year}`)
  if (s.url !== undefined && !/^https:\/\/\S+$/.test(s.url)) fail(where, 'url must be https')
  if (!citedSources.has(s.id)) fail(where, 'no tip cites it')
}
```

In the tips loop replace the `sources` line with:

```ts
  if (!Array.isArray(tip.sources) || tip.sources.length === 0) fail(where, 'needs at least one source')
  for (const ref of Array.isArray(tip.sources) ? tip.sources : []) {
    if (!sourceIds.has(ref.source)) fail(where, `unknown source "${ref.source}"`)
    if (!isNonEmpty(ref.where)) fail(where, `source "${ref.source}" needs where`)
  }
```

- [ ] **Step 9: Run everything for this task**

Run: `npx vitest run src/lib/localized.test.ts` → PASS. `npm run validate:data` → "Data OK". Then break it on purpose: change one `"source": "pcic"` to `"pcicc"` in `tips.json`, run `npm run validate:data` → it fails with `tips[…]: unknown source "pcicc"` and `sources[pcic]` is still cited elsewhere; undo the change. `npx tsc -b` clean. `npm test` all pass.

- [ ] **Step 10: Commit**

```bash
git add src/data/sources.json src/data/types.ts src/data/index.ts src/data/tips.json src/lib/localized.ts src/lib/localized.test.ts scripts/validate-data.ts
git commit -m "feat(data): tips cite a checked list of sources

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regional notes and exercise ideas

**Files:**
- Modify: `src/data/types.ts` (`Tip.variants`, `Tip.ideas`, `TipEn.variants`)
- Modify: `src/data/tips.json` (28 tips: `variants`, `ideas`)
- Modify: `src/data/en/tips.json` (28 tips: `variants`)
- Modify: `scripts/validate-data.ts`

**Interfaces:**
- Consumes: `SpanishVariant` from Task 1.
- Produces: `Tip.variants: Partial<Record<SpanishVariant, string>>`, `Tip.ideas: string[]`, `TipEn.variants: Partial<Record<SpanishVariant, string>>`. Nothing reads them in the app yet.

- [ ] **Step 1: Types** — in `Tip` after `sources` add:

```ts
  variants: Partial<Record<SpanishVariant, string>> // how a variant of Spanish uses the point, in the learner's language; `mx` required
  ideas: string[] // 1–3 exercise ideas for later content work, English working notes, never shown
```

and in `TipEn` after `intro`:

```ts
  variants: Partial<Record<SpanishVariant, string>>
```

- [ ] **Step 2: Validator first (it fails on today's data)** — in `scripts/validate-data.ts`, inside the tips loop after the sources checks:

```ts
  const variantKeys = Object.keys(tip.variants ?? {})
  if (!isNonEmpty(tip.variants?.mx)) fail(where, 'needs variants.mx (how Mexico uses it)')
  for (const key of variantKeys) {
    if (key !== 'mx' && key !== 'es') fail(where, `unknown Spanish variant "${key}"`)
    else if (!isNonEmpty(tip.variants[key as SpanishVariant])) fail(where, `empty variants.${key}`)
  }
  if (!Array.isArray(tip.ideas) || tip.ideas.length < 1 || tip.ideas.length > 3 || !tip.ideas.every(isNonEmpty)) fail(where, 'needs 1–3 ideas')
```

Slovak `variants` text is not passed to `checkSpanish`: a Slovak note may name Spain-only forms. In the `en/tips` loop after the title/intro check:

```ts
  for (const key of Object.keys(tip.variants ?? {}) as SpanishVariant[]) {
    if (!isNonEmpty(entry.variants?.[key])) fail(where, `needs variants.${key}, like the Slovak tip`)
  }
  for (const key of Object.keys(entry.variants ?? {})) {
    if (!(key in (tip.variants ?? {}))) fail(where, `variants.${key} has no Slovak note`)
  }
```

(add `SpanishVariant` to the type import). Run `npm run validate:data` → FAIL with 28 × "needs variants.mx" and "needs 1–3 ideas".

- [ ] **Step 3: Write the content** — for each of the 28 tips add, right after its `"sources"` line in `tips.json`:

```json
    "variants": { "mx": "<Slovak, 1–2 sentences>" },
    "ideas": ["<English idea>", "<English idea>"],
```

and in `en/tips.json` after the `"intro"` line: `"variants": { "mx": "<the same note in English>" },`.

Rules for the notes:
- Say what a Mexican speaker actually does with the point; when nothing differs from the general rule, say so in one sentence ("V Mexiku rovnako ako inde.").
- Facts only that are standard knowledge of Mexican Spanish (no vosotros → ustedes; pretérito where Spain uses the perfecto compuesto; `ahorita`, `¿mande?`; leísmo absent; diminutives in -ito; `se me hace que…`). When unsure, write the neutral sentence instead of guessing.
- Our own words, no textbook sentence copied; Slovak natural, not word-for-word; English the same meaning.

Worked examples (use these as written):

| tip | `variants.mx` (sk) | `variants.mx` (en) | `ideas` |
|---|---|---|---|
| `imperativo` | „V Mexiku sa vosotros nepoužíva: viacerým ľuďom sa rozkazuje tvarom ustedes (vengan, siéntense), aj medzi kamarátmi.“ | “Mexico does not use vosotros: an order to several people takes the ustedes form (vengan, siéntense), among friends too.” | `["turn a statement into an order (tú, usted, ustedes)", "negate an order and move the pronoun (dámelo → no me lo des)"]` |
| `preterito-imperfecto` | „V Mexiku sa o dnešku aj o nedávnej minulosti hovorí v pretérite (hoy comí tarde), kde Španielsko často dá he comido.“ | “Mexico uses the pretérito for today and the recent past too (hoy comí tarde), where Spain often says he comido.” | `["pick pretérito or imperfecto in a short story", "mark the time words that decide the tense"]` |
| `object-pronouns` | „V Mexiku sa pre osobu v akuzatíve drží lo/la (lo vi ayer), le ako v Madride (le vi) by znelo cudzo.“ | “Mexico keeps lo/la for a person as the direct object (lo vi ayer); le as in Madrid (le vi) sounds foreign.” | `["rewrite the object as lo/la/los/las", "join two pronouns (se lo doy)"]` |
| `articles` | „V Mexiku rovnako ako inde.“ | “The same in Mexico as elsewhere.” | `["el or la before a noun", "a noun with and without an article (me gusta el café / quiero café)"]` |

- [ ] **Step 4: Run the checks**

Run: `npm run validate:data` → "Data OK". `npx tsc -b` clean. `npm test` all pass. Remove `variants.mx` from one English entry by hand, run `npm run validate:data` → `en/tips[…]: needs variants.mx, like the Slovak tip`; undo.

- [ ] **Step 5: Adam's spot check** — list the 28 Slovak `variants.mx` notes for Adam (a table in the final report), so he can confirm them against what he knows of Mexico.

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/data/tips.json src/data/en/tips.json scripts/validate-data.ts
git commit -m "feat(data): every tip says how Mexico uses it and how to practise it later

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Whole-branch check

**Files:** none new (fixes only if a check fails).

- [ ] **Step 1:** `npm run validate:data`, `npm test`, `npx tsc -b`, `npm run build` — all green.
- [ ] **Step 2:** `E2E_PORT=5296 npm run test:e2e -- --workers=3`. `e2e/grammar.spec.ts:170` asserts `Podľa: Plan curricular del Instituto Cervantes…` and must pass unchanged. A red test in a file this branch did not touch is rerun alone first (known flaky: path, look, onboarding, account specs).
- [ ] **Step 3:** One whole-branch review of `git diff main...HEAD` before Adam decides on the merge.

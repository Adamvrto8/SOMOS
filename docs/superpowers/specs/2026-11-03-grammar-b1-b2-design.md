# Grammar B1–B2, step 1: new verb forms and tips — design

Date: 2026-11-03 · Status: approved by Adam in the brainstorm, spec waiting for his review

## Goal

The content review (part B, https://claude.ai/artifact/LEkCV9Fw9nGUE7wGsrLpUn) found that B1 and B2 have
no grammar of their own: the guided path on B1/B2 repeats ser/estar and the A2 past tenses, the present
subjunctive is in 1 of 1625 sentences, the imperfect subjunctive in none. Part C follows the review's §4
order:

1. **Grammar B1–B2 and the small A1–A2 gaps** ← this spec
2. 20–30 sentences per new grammar point, with blanks on the new structure
3. More varied blanks (prepositions, pronouns, conjunctions)
4. New exercise types (matching, find the mistake, listening comprehension…)
5. The database of sources (one record per grammar point: level, sources, rule, Mexican note, ideas)

Step 1 adds the verb forms B1–B2 need (subjuntivo presente, subjuntivo imperfecto, condicional,
imperativo, participle → pluscuamperfecto) to all 270 verbs, to the conjugation table and the drill,
16 new grammar tips, a level for every tense and tip, and connects the B1/B2 path units to the new
tense tips. Every tip names its source already now, so step 5 collects rather than searches again.

Non-goals (later steps or never): new sentences and blanks (step 2), path units for the usage tips
(step 2), more varied blanks (3), new exercise types (4), the full sources database (5), pretérito
perfecto compuesto as a table tense or drill (only explained in a tip), the `-se` imperfect subjunctive
(hardly used in Mexico), vosotros (never), connectors (sin embargo…) as grammar.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Order of part C | The review's §4 order (above); sources are written down per tip from step 1 on |
| New verb forms in step 1? | Yes: tips and forms together, in the table and the drill |
| Which forms | subjuntivo presente, subjuntivo imperfecto (`-ra` only), condicional, imperativo (affirmative stored, negative derived), participle + derived pluscuamperfecto |
| Levels of tenses | Every tense gets the level it is tested from; today's five stay A1 (nothing that works changes) |
| Path in step 1 | Only the B1/B2 units, only to the new **form** tips; usage tips get units in step 2 with their sentences |
| How forms are stored | A: stored in the verb JSON, generated once by a script, cross-checked by the validator |
| Tip list | The 16 tips below, as proposed |

## 1. Verb data

New fields of `Verb` (`src/data/types.ts`):

```ts
type ImperativePerson = 'tu' | 'el' | 'nosotros' | 'ellos' // tú, usted, nosotros, ustedes

interface Verb {
  // … today's fields
  subjuntivo: Record<Person, string>       // tenga
  subjImperfecto: Record<Person, string>   // tuviera, tuviéramos (-ra only)
  condicional: Record<Person, string>      // tendría
  imperativo: Record<ImperativePerson, string> // affirmative: ten, tenga, tengamos, tengan
  participle: string                       // tenido, hecho
  participleIrregular?: boolean            // like gerundIrregular
}
```

- Reflexive verbs: forms include the pronoun like today (`me levante`, `me levantaría`). The affirmative
  imperative attaches it with the written accent: `levántate`, `levántese`, `levantémonos` (the -s of
  -mos drops), `levántense`. `participle` does not include it (`levantado`), like `gerund`.
- Negative imperative is not stored: `no` + subjuntivo of the same person (`no tengas`, `no te levantes`).
- Pluscuamperfecto is not stored: `haber.imperfecto[person]` + participle (`había salido`,
  `me había levantado`), derived in `conjugate.ts` the way progresivo is derived from estar.
- `irregularForms` gains the entries `subjuntivo.*`, `subjImperfecto.*`, `condicional.*`,
  `imperativo.<person>` and `participle`, with today's meaning: exactly the forms that differ from the
  regular -ar/-er/-ir pattern, spelling changes included (`llegue`, `busque`), stem changes included
  (`pueda`, `quiera`). `regular` stays true only when there are none, so verbs that are regular today
  but have an irregular participle (escribir → escrito, abrir → abierto) become `regular: false`.

### Generation (one-off script)

`scripts/generate-forms.ts` fills the five fields for every verb from the forms already in the data,
then is deleted (the validator keeps the rules):

- subjuntivo: stem of `presente.yo` minus -o + -e/-a endings (`tengo → tenga`); nosotros from the
  nosotros stem, except -ir stem-changers (`dormir → durmamos`, `sentir → sintamos`, `pedir → pidamos`);
  exceptions listed by hand: ser, ir, estar, saber, haber, dar (and their compounds in the data).
- subjImperfecto: `preterito.ellos` minus -ron + -ra, -ras, -ra, -´ramos, -ran (`tuvieron → tuviera,
  tuviéramos`).
- condicional: the futuro stem + -ía, -ías, -ía, -íamos, -ían.
- imperativo: tú = `presente.el` except ven, di, sal, haz, ten, ve, pon, sé (and compounds: mantén,
  obtén, propón, supón…); usted / nosotros / ustedes = subjuntivo of el / nosotros / ellos.
- participle: -ado / -ido, with the irregular list (hecho, dicho, visto, escrito, puesto, vuelto, abierto,
  roto, muerto, cubierto, descubierto, resuelto, devuelto, satisfecho… and compounds) and the accented
  -ído after a vowel (leído, creído, oído, traído).

After running it, Claude reads a sample (every irregular verb and 20 regular ones) before committing.

## 2. Validation (`npm run validate:data`)

New checks, so a wrong generated form cannot slip through:

- All five fields present for every verb; all persons present; no vosotros forms.
- **Derivation consistency**: each subjuntivo, subjImperfecto, condicional and imperativo form equals what
  the rules of §1 derive from the verb's own presente / preterito / futuro forms, unless the verb is on
  the validator's short exception list for that tense. imperativo usted / nosotros / ustedes must equal
  the subjuntivo (with the attached pronoun for reflexives).
- `irregularForms`, `regular`, `participleIrregular` match the regular-pattern comparison, as today.
- Cloze hints accept the new tense names and are conjugated and checked like today:
  `tener · yo · subjuntivo`, `tener · yo · subjuntivo imperfecto`, `tener · yo · condicional`,
  `decir · tú · imperativo` (affirmative), `salir · él · pluscuamperfecto`, `hacer · participio`.
- Every tip, today's 12 included, has `level` and at least one source.

## 3. Tenses in the app

`src/lib/conjugate.ts`:

- `TABLE_TENSES` (still the single list for table tabs, drill chips and task ids) becomes:
  presente · progresivo · preterito · imperfecto · futuro · condicional · pluscuamperfecto ·
  subjuntivo · subjImperfecto · imperativo.
- `TENSE_LABELS` adds: condicional, pluscuamperfecto, subjuntivo, subj. imperfecto, imperativo.
- New `TENSE_LEVEL: Record<TableTense, Level>`: today's five A1, imperativo A2, condicional /
  pluscuamperfecto / subjuntivo B1, subjImperfecto B2.
- `conjugate()` handles the new tenses; imperativo takes an `ImperativePerson` (no yo) and the irregular
  highlight works per form as today.

**Conjugation table** (word detail): the new tabs in that order. The imperativo tab has rows tú /
usted / nosotros / ustedes and two columns, *kladný* and *záporný* (`ten · no tengas`).
The table always shows every tab, whatever the level: it is a reference.

**Conjugation drill and tests** (`lesson.ts`, `ExercisePage.tsx`, `tests.ts`):

- Tense chips list every tense; a chip above the chosen level carries a small level badge ("B1") and
  still works (a chosen tense is drilled at any level, with that level's verbs).
- "Všetky časy", level tests and path steps take only tenses with `TENSE_LEVEL` ≤ the chosen level.
  A1 and A2 drills are therefore unchanged except that A2 gains imperativo.
- Imperativo is drilled affirmative only, persons tú / usted / nosotros / ustedes; prompt
  "decir · tú · imperativo" → "di". Task id `decir:imperativo:tu`, rebuilt by `taskFromItem` as today.
- Earlier test results are kept as they are.

**Search and answer checking**: every new stored form and every participle goes into the search index
and `knownForms` (compound forms need nothing more: había and salido are each known), so `tenga` finds
tener and an accent-only difference between known forms is ❌ with both meanings (hable / hablé,
este / esté) rather than a typo.

**"Prečo?"**: a wrong drill answer in a new tense opens that tense's tip (`tipFor` in `tips.ts`).

## 4. Tips

`Tip` gains `level: Level` and `sources: string[]` (short citations, e.g.
"Plan Curricular del Instituto Cervantes, B1 · Gramática, 9.2"; step 5 may turn them into ids of a
sources database). New tip ids join the `Grammar` tag list where a sentence can carry them.

The 16 new tips, written by Claude in Slovak with Mexican examples (no vosotros), each with an English
overlay entry in `src/data/en/tips.json`. Text is our own explanation; textbook text is never copied.

| # | id | Tip | Level | Kind |
|---|---|---|---|---|
| 1 | gustar | gustar, encantar, doler (me gustan) | A1 | usage |
| 2 | hay-estar | hay alebo estar | A1 | usage |
| 3 | object-pronouns | Zámená predmetu (lo, la, le; se lo) | A2 | usage |
| 4 | comparisons | Porovnávanie (más … que, tan … como, el mejor) | A2 | usage |
| 5 | obligation | tener que, deber, poder + infinitív | A2 | usage |
| 6 | imperativo | Imperativ (ven, dime, siéntate; no vengas; dámelo) | A2 | forms |
| 7 | subjuntivo | Subjuntivo presente: tvary | B1 | forms |
| 8 | subjuntivo-wishes | Subjuntivo pri želaní a pocitoch (quiero que, me alegra que, ojalá) | B1 | usage |
| 9 | condicional | Kondicionál (me gustaría, podrías) | B1 | forms |
| 10 | pluscuamperfecto | Pluscuamperfecto (había salido), krátko o he comido v Mexiku | B1 | forms |
| 11 | si-clauses | Podmienky so si: reálna (rule `real`) a nereálna (rule `unreal`) | B1 | usage |
| 12 | por-para | por alebo para | B1 | usage |
| 13 | subj-imperfecto | Imperfecto de subjuntivo: tvary | B2 | forms |
| 14 | subjuntivo-clauses | Subjuntivo pri názore a po spojkách (no creo que, cuando llegues, para que, aunque) | B2 | usage |
| 15 | relatives | Vzťažné vety (que, donde, lo que, el que) | B2 | usage |
| 16 | passive-se | Trpný rod a neosobné se (se vende, fue construido) | B2 | usage |

Levels of today's tips: A1 ser-estar, presente, gender, articles, adjectives, reflexive, accents;
A2 progresivo, preterito, imperfecto, preterito-imperfecto, futuro.

Sources per tip: the level and chapter in the Plan Curricular del Instituto Cervantes (PCIC) and/or
the UIMP 2026 programs that follow it (A1, B1, B2 PDFs linked in the review), plus a reference grammar
chapter where useful (e.g. RAE/ASALE, *Nueva gramática básica*). The link to the PCIC online pages is
checked again; if they still return 404, the citation names the printed edition (2006).

**Grammar page** (`GrammarPage.tsx`): tips grouped under headings A1 · A2 · B1 · B2, in the table's
order within a level. **Tip page / sheet** (`TipContent.tsx`): one line at the end,
"Podľa: Plan Curricular del Instituto Cervantes, B1" (English: "Based on: …").

## 5. Guided path

Today B1 has 27 units, B2 23, all with A1–A2 tips. In step 1:

- `TENSE_TIPS` in `path.ts` maps the new form tips to their tenses (imperativo → imperativo,
  subjuntivo → subjuntivo, condicional, pluscuamperfecto, subj-imperfecto → subjImperfecto), so their
  grammar step is 4 conjugations of the new tense (enough for `MIN_GRAMMAR_TASKS`) plus any blanks that
  fit (none yet, more in step 2).
- `path.json`: about 16 B1 units move to imperativo → subjuntivo → condicional → pluscuamperfecto (in
  that order through the level), about 12 B2 units to subj-imperfecto and reviews of the B1 form tips.
  The other units keep their tip until step 2 gives them usage tips. The exact unit-by-unit mapping is
  a table in the implementation plan, for Adam to check.
- Units are matched by id, so progress already made in a unit is kept.

## 6. Testing

- `npm run validate:data` with the checks of §2.
- Unit tests: form derivation rules (the validator's helpers), `conjugate` for each new tense incl.
  reflexive imperative and pluscuamperfecto, `TENSE_LEVEL` filtering of "Všetky časy" and tests,
  imperativo task ids through `taskFromItem`, `knownForms` accent pairs (hable/hablé, este/esté),
  `tipFor` for the new tenses, B1 path units' grammar step.
- E2E (Playwright, 375 px): word detail shows the subjuntivo and imperativo tabs; the drill on B1 offers
  the subjuntivo chip and "Všetky časy" includes it, on A1 it does not; the Gramatika page shows level
  headings and a tip's source line.
- `npm run build` and `npm run test:e2e` before the push.

## What Adam tests on the phone

- Detail of tener, ir, levantarse: the new tabs, amber irregular forms, imperativo kladný / záporný.
- Cvičiť → Časovanie on B1: chip subjuntivo, "Všetky časy" with the new tenses; on A1 without them.
- Gramatika: headings A1–B2, a new tip (subjuntivo) and its "Podľa:" line.
- Cesta on B1: a unit with the subjuntivo tip, its grammar step.

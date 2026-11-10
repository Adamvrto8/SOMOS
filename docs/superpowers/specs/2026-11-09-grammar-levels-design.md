# Grammar levels after the PCIC (roadmap §4a.5, part A1): design

Date: 2026-11-09. Status: approved in chat by Adam, waiting for his review of this spec.
Background: `docs/grammar-gap-analysis.md` (tips vs. the Plan curricular del Instituto Cervantes, PCIC) and
`docs/reports/Akademické zdroje pre španielčinu.md` (the literature list).

## 1. Goal

Every grammar tip sits at the level the PCIC gives its point, unless a deviation is written down. Nothing that depends
on tips may break: "Prečo?", the guided path (Cesta), topic tests and level exams, the conjugation drill and table,
the Spain overlay and the English layer.

Out of scope here (later parts with their own specs): A2 new A1–A2 tips (demostrativos, posesivos, interrogativos,
negación, personal *a*), A3 new B1–B2 tips, A4 `variants.mx` notes from the PCIC, B the grammar screen (grouping,
search, links).

## 2. Adam's decisions (2026-11-09)

1. Split the future: **ir a + infinitivo at A2**, **futuro -ré at B1**.
2. The 37 A2 sentences with a `-ré` future are **rewritten to ir a** and stay A2.
3. The conjugation drill follows the PCIC: pretérito, imperfecto and perfecto from A2, futuro from B1.
4. Progresivo stays at A1 as a **recorded deviation**.
5. The three B2 tips that hold B1 content are **split** into a B1 and a B2 tip.

Approach: separate tips with their own grammar tags. One tip has one level, as today, so Cesta, tests and the tip
screen keep working the way they do. Per-rule levels inside one tip were rejected as more complex than they are worth.

## 3. Tips after the change

The original id stays with the lower level, so every `why` that points at one of its kept rules stays valid. Only
blanks whose rule moves are retagged.

| Tip (id) | Level | Rules | Change |
|---|---|---|---|
| `ir-a` (new) | A2 | `forms` (voy a, vas a…), `use` (plans and the near future; in Mexico the usual future), `pronouns` (lo voy a hacer / voy a hacerlo) | the `ir-a` rule of `futuro` moves here and is extended. PCIC 12.1 (A2), 9.1.1 (A1, Hispanoamérica note); NGLE § 28.8 |
| `futuro` | A2 → **B1** | `use`, `endings`, `stems`, `guess` | loses `ir-a`, its intro and `use` point to the `ir-a` tip (`related`). PCIC 9.1.4 (B1) |
| `subjuntivo-clauses` | B2 → **B1** | `opinion`, `cuando`, `para-que` | loses `aunque`. PCIC 9.2.1, 15.1.2, 15.3.1, 15.3.5 (B1) |
| `subjuntivo-aunque` (new) | B2 | `aunque` (factual: indicative / not: subjunctive), `a-pesar-de`, `hasta-que` (hasta que, en cuanto, una vez que + subjunctive) | PCIC 9.2.1 (B2), 15.3.9 (B2), 15.3.1 (B2); NGLE § 25.13, 47.12 |
| `relatives` | B2 → **B1** | `que`, `donde`, `lo-que` | loses `el-que`, `quien`, `cuyo`. PCIC 7.2, 15.2, 8.8 |
| `relatives-prep` (new) | B2 | `el-que`, `quien`, `cuyo` | PCIC 7.2 (B2), 15.2 (B2); `cuyo` is not in the PCIC: cited from the NGLE (cap. 22, 44), recorded deviation |
| `passive-se` | B2 → **B1** | `se`, `impersonal`, `estar-result` | loses `ser-passive`. PCIC 7.1.4, 13.3 (B1) |
| `ser-passive` (new) | B2 | `ser-passive` (ser + participio; who did it with *por*), `register` (news and official texts; speech uses *se*) | PCIC 12.1 (B2), 13.3 (B2); NGLE § 41.2–41.3 |

Each new tip has everything a tip needs today: Slovak title, intro, rules with 1–3 examples, `sources` (PCIC with
sections + NGLE), `variants.mx` and `variants.es`, `ideas`, `related`; plus its English text in `src/data/en/tips.json`.
A Spain example overlay entry in `src/data/es/tips.json` is added only where an example uses Mexican-only words.
Texts follow the existing tips' style and the CLAUDE.md content rules (Mexican Spanish, natural Slovak).

## 4. Sentences

- **The 37 A2 `futuro` sentences** are rewritten to *ir a*: `Mañana iré al dentista` → `Mañana voy a ir al dentista`.
  The blank is the form of *ir* (`voy`) with the hint `ir · yo · presente`, `tip: "ir-a"` and `why` one of its rules;
  the tag `futuro` becomes `ir-a`. Slovak, English and, where the sentence has one, the Spain overlay are rewritten
  with it. Other blanks in these sentences stay. Each topic × level keeps its sentence count.
- **Blanks whose rule moved** are retagged by script (`tip` + `why`, and the sentence's `grammar` tags):
  `aunque` 12 → `subjuntivo-aunque`; `el-que` 10, `quien` 2, `cuyo` 2 → `relatives-prep`; `ser-passive` 4 → `ser-passive`.
- **B2 sentences whose blank is a B1 rule** (cuando, para que, no creo que, que, donde, se) stay B2 and lead to the B1 tip:
  a higher level repeats a lower one.
- **New B1 sentences**, because B1 has almost none: about 20 each for `subjuntivo-clauses` (now 2), `relatives`
  (now 1) and `passive-se` (now 0), spread over the topics, each with a blank on the point, Slovak and English, Spain
  overlay where needed. Written in batches by at most two Sonnet agents with the validator after every batch.
- **New B2 sentences** only where a new B2 tip has fewer than 10 blanks (`ser-passive` has 4, `relatives-prep` 14,
  `subjuntivo-aunque` 12): about 8 for `ser-passive`.
- The one A1 sentence tagged `passive-se` is checked by hand (likely a wrong tag).

## 5. Code

- `Grammar` type (`src/data/types.ts`), `GRAMMAR` in `scripts/validate-data.ts`: add `ir-a`, `subjuntivo-aunque`,
  `relatives-prep`, `ser-passive`. The validator already requires a tip for every tag.
- `USAGE_TIPS` (`src/lib/clozeChecks.ts`): add the four new usage tips, so a blank's `tip` decides "Prečo?" and the path.
- `TAG_PRIORITY` (`src/lib/tips.ts`): each new tag next to the tip it was split from (`ir-a` before `futuro`).
- `TENSE_LEVEL` (`src/lib/conjugate.ts`): `preterito` A2, `imperfecto` A2, `perfecto` A2 (already), `futuro` B1;
  `progresivo` stays A1. The word detail's conjugation table keeps all tenses; the drill chip says "od A2/B1".
- Anything else that names `futuro` as a tense (`path.ts` map, `verbForms`, `ConjugationTable`) stays: the tense is the
  same, only its level changes. The conjugation drill's link "tense → tip" still opens `futuro`.

## 6. Cesta (`src/data/path.json`)

- The five A2 units with `grammar: "futuro"` become `ir-a` units (rules `forms` / `use` instead of `endings` / `stems`).
- B2 units of the split tips move to the new B2 tip when that topic × B2 has enough blanks for a unit after the
  retagging; otherwise they stay on the B1 tip (a B2 repeat). The implementation plan lists each unit.
- New B1 units for `subjuntivo-clauses`, `relatives` and `passive-se` once their sentences exist, at the place in the
  B1 order where the point fits (after `subjuntivo` for the first, the existing B1 order otherwise).
- The path checks (`npm test`: every unit has enough tasks for its steps) must stay green.

## 7. Recorded deviations from the PCIC

Written into `docs/grammar-gap-analysis.md` §6 and shown nowhere in the app:
- `progresivo` at A1 (PCIC: estar + gerundio at A2, 9.4.2 / 12.1): *estoy comiendo* is useful from the first week.
  The ser-estar rule `progressive` stays at A1 with it.
- `si-clauses` at B1 holds the A2 real condition (PCIC 15.3.6 A2) together with the B2 unreal one: one tip that
  contrasts both is clearer than two.
- `cuyo` in `relatives-prep` although the PCIC grammar inventory does not list it.
- `relatives` at B1 although `que` alone is A1 in the PCIC: A1–A2 sentences use `que` freely without a tip.

## 8. Testing

- `npm run validate:data` after every data batch (new tags, hints, tokens, no vosotros, Spain-only words).
- `npm test`: tips (`tips.test.ts`, which tip and rule a blank gets), path, tests, localized citations; new cases for
  an `ir-a` blank ("Prečo?" opens `ir-a` with rule `forms`) and for a retagged `aunque` blank.
- `npm run build`, then `E2E_PORT=5299 npm run test:e2e -- --workers=3` before any push; Adam decides the push.
- On the phone: an A2 lesson with *ir a*, the drill at A1 (presente + progresivo only), a B1 tip page.

## 9. Order of work

1. Code: tags, `USAGE_TIPS`, `TAG_PRIORITY`, `TENSE_LEVEL`, with tests.
2. Tips: split the four tips, write the four new ones (Slovak, English, Spain overlay), citations.
3. Retag the moved blanks (script).
4. Rewrite the 37 A2 futuro sentences to *ir a*.
5. New B1 sentences (3 × ~20) and B2 `ser-passive` sentences (~8), in batches.
6. Cesta units.
7. Deviations into the gap analysis; full checks.

# Sentences for the new grammar points (part C, step 2)

Date: 2026-11-03. Branch `grammar-sentences`, worktree `C:\CODE\SOMOS-sentences`.
Follows `2026-11-03-grammar-b1-b2-design.md` (step 1) and the part B report §4 (step 2 of 5).

## 1. Goal

Step 1 added 16 grammar points: 5 tense tips (imperativo, subjuntivo, condicional, pluscuamperfecto, subj-imperfecto)
and 11 usage tips (gustar, hay-estar, object-pronouns, comparisons, obligation, subjuntivo-wishes, si-clauses,
por-para, subjuntivo-clauses, relatives, passive-se). No sentence carries their tags and no blank practises them, and
the 11 usage tips have no unit in the path, because a blank finds its tip only through a verb hint.

After this step:
- every one of the 16 points has about 20 new sentences whose blank is on the point;
- old sentences that already contain a usage structure get a second blank on it (~100);
- a blank can name its usage tip and rule, so "Prečo?" explains it and the path finds it;
- each usage tip has 2 path units with a full grammar step (10 tasks).

Adam's choices (2026-11-03): new sentences plus blanks in old ones; usage tips take over existing units (121 stays);
the link is a `tip` field on the blank (option A).

## 2. Data

### 2.1 `Cloze`

```ts
export interface Cloze {
  tokenIndex: number
  answer: string
  lemma: string
  hint?: string
  tip?: Grammar  // NEW: a usage tip this blank practises ("por-para")
  why?: string   // ser/estar blanks: a rule of ser-estar; blanks with `tip`: a rule of that tip
  distractors?: string[]
}
```

Validator rules (`scripts/validate-data.ts`):
- `tip` is one of the 11 usage tips (not a tense tip, not ser-estar: those come from the hint).
- A blank with `tip` needs `why`, and `why` is a rule id of that tip.
- The sentence's `grammar` includes the `tip`.
- `why` without `tip` stays allowed only on ser/estar blanks (as today).

### 2.2 Hints

| Blank | Hint | Example |
|---|---|---|
| tense point | full verb hint, as today | `tener · tú · subjuntivo`, `hacer · participio` |
| usage point where the tense is the choice (si-clauses, subjuntivo-wishes, subjuntivo-clauses) | NEW `lemma · person`, no tense | *Si tuviera tiempo, ___ más.* `leer · yo` → leería |
| gustar | the lemma alone | *Me ___ los tacos.* `gustar` → gustan |
| other usage blanks | short Slovak, English in `hints` | `por/para`, `zámeno: ho`, `porovnanie`, `hay/estar`, `vzťažné slovo`, `se`, `musieť` |

Validator:
- A `lemma · person` hint (2 parts, the second a person label) is allowed only on a blank with `tip`; the lemma is a
  verb and the answer is that verb's form for that person in some tense of the dataset (the 10 table tenses).
- A blank with `tip` whose lemma is a verb and whose hint is the lemma alone: the answer is a form of that verb.
- A Slovak hint needs its English in `hints`, as today.

### 2.3 What a usage blank asks

| Tip | Blank on | Rules (`why`) |
|---|---|---|
| gustar | gusta / gustan / encanta / duele… | how, plural, people, similar |
| hay-estar | hay / está / están | hay, estar, question |
| object-pronouns | lo / la / le / los / se… | direct, indirect, position, se-lo |
| comparisons | más / menos / tan / que / como / mejor… | more-less, equal, irregular, superlative |
| obligation | que (tener que, hay que) / debo / puedo… | tener-que, hay-que, deber, poder |
| subjuntivo-wishes | the subjunctive verb | wish, feelings, advice, ojala |
| si-clauses | the verb of either clause | real, unreal, never |
| por-para | por / para | para, por, fixed |
| subjuntivo-clauses | the verb after the conjunction or opinion | opinion, cuando, para-que, aunque |
| relatives | que / donde / lo que / quien / el que | que, donde, lo-que, el-que |
| passive-se | se, or the verb that agrees (se venden) | se, impersonal, ser-passive, estar-result |

Every new blank has at least 2 distractors (3 where natural), so it can be a choice task.

### 2.4 Content

- **New sentences:** about 20 per point, 16 points (~320), ids from `s1626`. Level = the tip's level, a few one
  above. Topics: about 6 for each of the point's units (its topic and level, so the unit has sentences of its own),
  the rest across the other topics of the level. Tags: the point, plus the tense tags of the verbs as today.
- **English:** every new sentence gets its entry in `src/data/en/sentences/<topic>.json` (`en`, `hints` aligned with
  the blanks).
- **Old sentences:** a script lists old sentences that contain a usage structure (por/para, si, que + a subjunctive
  form, gustar forms, hay, comparisons, relatives, se + verb, tener que / hay que / deber); a second blank with `tip`
  and `why` is added by hand where it is the clear point of the sentence (~100). The first blank stays first (choice
  uses it). The sentence gets the tag; the English `hints` gets the new entry.
- Mexican Spanish, natural everyday sentences, Slovak that sounds natural (CLAUDE.md §1, §9). No native check yet.

## 3. Path

### 3.1 Usage tips take over 22 units

| # | Unit | Was | Becomes |
|---|---|---|---|
| 4 | A1 food-1 | presente er-ir | gustar |
| 31 | A1 basics-3 | presente | gustar |
| 7 | A1 city-1 | presente stem | hay-estar |
| 27 | A1 city-2 | presente irregular | hay-estar |
| 46 | A2 shopping-1 | preterito | object-pronouns |
| 57 | A2 food-2 | preterito ser-ir | object-pronouns |
| 53 | A2 nature-1 | preterito er-ir | comparisons |
| 58 | A2 tech-1 | preterito ar | comparisons |
| 62 | A2 work-2 | futuro endings | obligation |
| 66 | A2 health-2 | preterito stems | obligation |
| 80 | B1 emotions-1 | subjuntivo | subjuntivo-wishes |
| 96 | B1 emotions-2 | preterito-imperfecto | subjuntivo-wishes |
| 79 | B1 travel-1 | imperativo | si-clauses |
| 94 | B1 work-2 | condicional | si-clauses |
| 82 | B1 shopping-1 | subjuntivo | por-para |
| 91 | B1 food-2 | subjuntivo | por-para |
| 103 | B2 work-1 | subj-imperfecto | subjuntivo-clauses |
| 108 | B2 health-1 | subjuntivo | subjuntivo-clauses |
| 105 | B2 travel-1 | subj-imperfecto | relatives |
| 114 | B2 nature-1 | preterito-imperfecto | relatives |
| 109 | B2 shopping-1 | preterito-imperfecto | passive-se |
| 120 | B2 tech-1 | futuro stems | passive-se |

Rules are dropped on these units. Every rule of presente (ar, er-ir, yo, stem, irregular) keeps a unit, so do
preterito's; each tense point keeps at least 2 units at its level except B2 preterito-imperfecto (1; A2 and B1 have
more). No two neighbouring units share a point (validator).

### 3.2 Which blanks a unit takes (`src/lib/path.ts`)

- `clozeFits` for a usage unit: the blank's `tip` is the unit's grammar (and the rule fits, if the unit has rules).
- For a tense unit: the hint's tip, as today, so a `subjuntivo-wishes` blank with a full subjunctive hint also serves a
  subjuntivo unit. A `lemma · person` blank has no tense tip and serves only its usage unit.
- The grammar step of a usage unit has no conjugations (`TENSE_TIPS` has no entry); all 10 tasks are blanks.
- Test: every usage unit's grammar step has 10 tasks; every tense unit still has at least as many as before.

## 4. "Prečo?" (`src/lib/tips.ts`)

`tipForCloze` checks `cloze.tip` first: the tip, targeted, with the rule `why` and its localized `because` (as ser/estar
does today). Without `tip`, as today. `TAG_PRIORITY` (builder, translation…) puts the usage tags where they explain the
sentence best (after the tense tags of step 1 for the tense points, before them for por-para, gustar, hay-estar,
relatives, passive-se, comparisons, obligation, object-pronouns).

## 5. Answer checking

No change. A `lemma · person` blank still has one answer; any other known form of the verb is ❌ with its meaning
(e.g. *viajo* for *viajaría*), which is the point.

## 6. How it is made

- Code first (types, validator, tips, path), with tests, so the content is checked as it lands.
- Content by 2 sonnet agents, each in its own staging file in the scratchpad (one: A1–A2 points plus imperativo and
  pluscuamperfecto; the other: B1–B2 points), never in the topic files. A merge script gives ids, sorts sentences into
  topic files, writes the English entries and runs the validator.
- Old-sentence blanks: a candidate script, the blanks picked in the main session.
- I read every sentence after the merge; Adam gets a sample of ~30 across the points to spot-check.

## 7. Tests

- The usage-blank checks of §2.1–2.2 live in a pure function in `src/lib/clozeChecks.ts`, which the validator calls;
  its unit test feeds it good and broken blanks (wrong tip, rule of another tip, `lemma · person` without `tip`, an
  answer that is not the verb's form for the person, missing tag).
- Unit: `tipForCloze` with `tip` and with a `lemma · person` hint; the path (each usage unit has a full grammar step;
  a subjuntivo unit takes a `subjuntivo-wishes` blank with a full hint).
- e2e: the por/para unit's grammar step; a wrong answer opens "Prečo?" with the rule.
- `npm run validate:data`, `npm test`, `npm run build`, `npm run test:e2e` before the push.

## 8. Out of scope

Step 3 (more varied blanks on old sentences generally), step 4 (new exercise types), step 5 (sources database);
CLAUDE.md §3 hint docs (Adam's file, he updates it).

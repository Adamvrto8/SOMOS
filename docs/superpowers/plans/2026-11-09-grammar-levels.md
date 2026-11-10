# Grammar levels after the PCIC: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the future, the subjunctive after conjunctions, relatives and the passive to their PCIC levels by splitting four tips into eight, rewriting 37 A2 sentences to *ir a*, adding B1/B2 sentences, and re-pointing the drill levels and the Cesta units, with nothing that depends on tips breaking.

**Architecture:** One tip = one level, as today. New grammar tags (`ir-a`, `subjuntivo-aunque`, `relatives-prep`, `ser-passive`) are usage tips: a blank names them with `tip` + `why`. The original tip ids keep the lower level and their kept rules, so most `why` references stay valid; only blanks of moved rules are retagged by a script. Content (sentences) is written in batches and checked by `validate:data`.

**Tech Stack:** TypeScript, Vite/React, Vitest, Playwright; data in `src/data/*.json`; validator `scripts/validate-data.ts`.

**Spec:** `docs/superpowers/specs/2026-11-09-grammar-levels-design.md`

Two refinements of the spec, found while planning: (1) the Cesta has a fixed list of units per topic × level, so the
"new B1 units" of spec §6 are existing B1 units re-pointed to the new tips (table in Task 7); (2) `path.test.ts` requires
every usage tip to have exactly two units with ≥4 own sentences each and a full grammar step, so every new B2 tip needs
more sentences than spec §4 estimated (≥16 each, Task 6), and `ir-a` gets two of the six A2 futuro units, the other four
are re-pointed to A2 points.

## Global Constraints

- No commits and no push: Adam said so (2026-11-09). Every "commit" point below is a checkpoint: run the checks, leave the work uncommitted.
- UI language Slovak; code, comments, docs English. All Spanish content Mexican: no vosotros, no Spain-only words (coche, ordenador, móvil, zumo, patata, conducir, coger, billete…), pretérito as default past.
- Keep each JSON file's own formatting: edit lines in place (string replacement), never re-serialise a whole data file with `JSON.stringify`/prettier (tips.json uses compact one-line arrays).
- `npm run validate:data` after every data change; `npm test` after code changes; `npm run build` and `E2E_PORT=5299 npm run test:e2e -- --workers=3` at the end.
- Subagents: at most 2 at a time, `model: "sonnet"`, only for the content batches (Tasks 5–6), each with its own files or id range.
- New sentence ids continue after the highest existing `sNNNN`; two parallel batches get disjoint id ranges.
- Every topic × level keeps at least as many sentences as today (rewrites, not moves).

## Review Focus

1. An *ir a* blank in a lesson: "Prečo?" must open `ir-a` (not `presente`, which the hint `ir · yo · presente` would pick) → test in Task 1.
2. A retagged `aunque` blank on a B2 sentence: "Prečo?" opens `subjuntivo-aunque` at rule `aunque` → test in Task 1 (with a hand-made sentence) and the dataset scan in Task 3.
3. The A1 conjugation drill and the A1 level exam must ask only presente and progresivo; an A1 learner picking "pretérito" in the drill is moved up to A2 like today's chip logic → tests in Task 1.
4. Every Cesta usage unit still has a full grammar step (10 blanks of its tip) and ≥4 own sentences on its tip after the re-pointing → existing `path.test.ts` cases, run in Task 7.
5. A B2 sentence whose blank is a kept B1 rule (cuando, que, se) still opens the B1 tip → dataset scan in Task 3.

---

### Task 1: Code — new tags, usage tips, drill levels

**Files:**
- Modify: `src/data/types.ts:16-` (the `Grammar` union)
- Modify: `scripts/validate-data.ts:67` (`GRAMMAR`)
- Modify: `src/lib/clozeChecks.ts:7-19` (`USAGE_TIPS`)
- Modify: `src/lib/tips.ts` (`TAG_PRIORITY`)
- Modify: `src/lib/conjugate.ts:51-63` (`TENSE_LEVEL`)
- Modify: `src/lib/tests.ts:116-118` (`testTenses`)
- Test: `src/lib/conjugate.test.ts:48-49`, `src/lib/tips.test.ts` (describe `usage blanks`), `src/lib/tests.test.ts`

**Interfaces:**
- Produces: `Grammar` gains `'ir-a' | 'subjuntivo-aunque' | 'relatives-prep' | 'ser-passive'`; all four are in `USAGE_TIPS` (so also `BLANK_TIPS`); `TENSE_LEVEL.preterito = 'A2'`, `imperfecto = 'A2'`, `futuro = 'B1'`; `testTenses('A1')` = `['presente', 'progresivo']`.

Note: the validator will fail until Task 2 adds the four tips ("no tip for the grammar tag"). Run only `npm test` here; `validate:data` goes green in Task 2.

- [ ] **Step 1: Write the failing tests**

In `src/lib/conjugate.test.ts` replace lines 48–49:

```ts
    expect(tensesUpTo('A1')).toEqual(['presente', 'progresivo'])
    expect(tensesUpTo('A2')).toEqual(['presente', 'progresivo', 'preterito', 'perfecto', 'imperfecto', 'imperativo'])
    expect(tensesUpTo('B1')).toContain('futuro')
```

In `src/lib/tips.test.ts`, inside `describe('usage blanks', …)`, add:

```ts
  it('an ir a blank opens the ir-a tip, not the presente its hint names', () => {
    const voy: Cloze = { tokenIndex: 1, answer: 'voy', lemma: 'ir', hint: 'ir · yo · presente', tip: 'ir-a', why: 'forms', distractors: ['va', 'vamos'] }
    const s: Sentence = { ...sentence, es: 'Mañana voy a estudiar.', level: 'A2', grammar: ['ir-a'], tokens: ['Mañana', 'voy', 'a', 'estudiar', '.'], cloze: [voy] }
    expect(tipForCloze(s, voy)?.tip.id).toBe('ir-a')
    expect(tipForCloze(s, voy)?.rule?.id).toBe('forms')
  })

  it('an aunque blank opens the B2 tip it moved to', () => {
    const aunque: Cloze = { tokenIndex: 1, answer: 'llueva', lemma: 'llover', hint: 'llover · él · subjuntivo', tip: 'subjuntivo-aunque', why: 'aunque' }
    const s: Sentence = { ...sentence, es: 'Aunque llueva, salgo.', level: 'B2', grammar: ['subjuntivo-aunque', 'subjuntivo'], tokens: ['Aunque', 'llueva', ',', 'salgo', '.'], cloze: [aunque] }
    expect(tipForCloze(s, aunque)?.tip.id).toBe('subjuntivo-aunque')
    expect(tipForCloze(s, aunque)?.tip.level).toBe('B2')
  })
```

In `src/lib/tests.test.ts` add (import `testTenses` from `./tests` if not imported):

```ts
it('asks only presente and progresivo in the A1 conjugation', () => {
  expect(testTenses('A1')).toEqual(['presente', 'progresivo'])
  expect(testTenses('A2')).not.toContain('futuro')
  expect(testTenses('B1')).toContain('futuro')
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/conjugate.test.ts src/lib/tips.test.ts src/lib/tests.test.ts`
Expected: FAIL (tense lists differ; `tipForCloze` returns undefined/another tip for the new tags; TypeScript may flag the new `tip` values).

- [ ] **Step 3: Implement**

`src/data/types.ts`, in the `Grammar` union, add after `'passive-se'`:

```ts
  | 'ir-a'
  | 'subjuntivo-aunque'
  | 'relatives-prep'
  | 'ser-passive'
```

`scripts/validate-data.ts:67`: append `'ir-a', 'subjuntivo-aunque', 'relatives-prep', 'ser-passive'` to the `GRAMMAR` array.

`src/lib/clozeChecks.ts`: `USAGE_TIPS` gets, after `'passive-se'`: `'ir-a', 'subjuntivo-aunque', 'relatives-prep', 'ser-passive'`.

`src/lib/tips.ts` `TAG_PRIORITY`: insert `'relatives-prep'` after `'relatives'`, `'ser-passive'` after `'passive-se'`, `'subjuntivo-aunque'` before `'subjuntivo-clauses'`, `'ir-a'` before `'futuro'`.

`src/lib/conjugate.ts` `TENSE_LEVEL`: `preterito: 'A2'`, `imperfecto: 'A2'`, `futuro: 'B1'` (others unchanged; `progresivo` stays `'A1'`, a recorded deviation).

`src/lib/tests.ts` `testTenses`: `return level === 'A1' ? ['presente', 'progresivo'] : tensesUpTo(level)` and update its doc comment ("A1 the present and the progressive").

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/conjugate.test.ts src/lib/tips.test.ts src/lib/tests.test.ts`
Expected: the conjugate and tests cases PASS; the two tip cases still FAIL until Task 2 adds the tips (they need `tipById`). Then run `npm test` and note every other failure: expected are only cases that count tips/levels; fix assertions that encode the old A1 tenses (search `'preterito'` near `A1` in `lesson.test.ts`, `practice.test.ts`, `path.test.ts`). Do not change product behaviour to make an old assertion pass.

- [ ] **Step 5: Checkpoint** — `npm test` green except the two tip cases. No commit.

---

### Task 2: Tips — split four, write four

**Files:**
- Modify: `src/data/tips.json` (tips `futuro`, `subjuntivo-clauses`, `relatives`, `passive-se`; add four tips)
- Modify: `src/data/en/tips.json` (same ids; English entries for the four new tips)
- Modify: `src/data/es/tips.json` (rule lists of entries whose rules moved: `futuro` has `ir-a`, `relatives` has `el-que`)

**Interfaces:**
- Consumes: the tags from Task 1.
- Produces: tips with exactly these rule ids (later tasks set `why` to them):
  - `ir-a` (A2): `forms`, `use`, `pronouns`
  - `futuro` (B1): `use`, `endings`, `stems`, `guess`
  - `subjuntivo-clauses` (B1): `opinion`, `cuando`, `para-que`
  - `subjuntivo-aunque` (B2): `aunque`, `a-pesar-de`, `hasta-que`
  - `relatives` (B1): `que`, `donde`, `lo-que`
  - `relatives-prep` (B2): `el-que`, `quien`, `cuyo`
  - `passive-se` (B1): `se`, `impersonal`, `estar-result`
  - `ser-passive` (B2): `ser-passive`, `register`

- [ ] **Step 1: Move rules.** In `tips.json`, cut the rule objects `futuro.ir-a`, `subjuntivo-clauses.aunque`, `relatives.el-que`, `relatives.quien`, `relatives.cuyo`, `passive-se.ser-passive` out of their tips (they become the first rules of the new tips; text adjusted in Step 2). Set levels: `futuro` B1, `subjuntivo-clauses` B1, `relatives` B1, `passive-se` B1. Adjust each old tip's `intro` so it no longer mentions what left (e.g. `futuro` intro: the -ré future; "v bežnej reči sa častejšie hovorí ir a + neurčitok, pozri tip ir a"), and add the new tip to `related`.

- [ ] **Step 2: Write the four new tips** after their parent tip, in the existing compact style. Each has: `id`, `title` (Slovak), `level`, `sources` (exact strings below), `variants.mx`, `variants.es`, `ideas` (1–3, English), `intro`, `related`, `rules` (each: `id`, `title`, `text`, `because` — required, these are usage tips —, 1–3 `examples` {es, sk}). Sources:
  - `ir-a`: `[{ "source": "pcic", "where": "Gramática 12.1 (A2); 9.1.1 (A1–A2)" }, { "source": "ngle", "where": "§ 23.14; 28.8" }]`; `variants.mx` says ir a is Mexico's everyday future and also covers the present in Hispanoamérica (PCIC 9.1.1 A1 note); rule `pronouns`: *lo voy a hacer / voy a hacerlo* (PCIC 12.1 A2).
  - `subjuntivo-aunque`: `[{ "source": "pcic", "where": "Gramática 9.2.1 (B2); 15.3.9 (B2); 15.3.1 (B2)" }, { "source": "ngle", "where": "§ 25.13; 47.12" }]`; rules `aunque` (fact → indicative, not a fact / no matter → subjunctive), `a-pesar-de` (a pesar de que + same choice), `hasta-que` (hasta que, en cuanto, una vez que + subjunctive about the future).
  - `relatives-prep`: `[{ "source": "pcic", "where": "Gramática 7.2 (B2); 15.2 (B2)" }, { "source": "ngle", "where": "cap. 22; cap. 44" }]`; `cuyo` rule text says it is written and formal.
  - `ser-passive`: `[{ "source": "pcic", "where": "Gramática 12.1 (B2); 13.3 (B2)" }, { "source": "ngle", "where": "§ 41.2–41.3" }]`; rules `ser-passive` (ser + participio agreeing with the subject, doer with *por*), `register` (news and official texts; speech says it with se or the active).
  Examples: natural Mexican Spanish, accents correct, Slovak natural; reuse the moved rules' examples where they fit.

- [ ] **Step 3: English layer.** In `en/tips.json`, for each of the 8 tips the entry's `rules` must list exactly the tip's rule ids in order, each with `title`, optional `text`, `because` where the Slovak rule has one, and `examples` translating each Slovak example in order (validator lines 673–700). Move the English texts of moved rules to the new entries; write English for new rules.

- [ ] **Step 4: Spain overlay.** In `es/tips.json`, entries whose rule lists contain moved rules (`futuro`: `ir-a`; `relatives`: `el-que`; check others with the script below) move those rule overrides to the new tip's entry (create it). Run:

```bash
node -e "const t=require('./src/data/tips.json'),e=require('./src/data/es/tips.json');for(const x of e){const tip=t.find(a=>a.id===x.id);for(const r of x.rules||[])if(!tip.rules.some(q=>q.id===r.id))console.log(x.id,r.id)}"
```
Expected after the move: no output.

- [ ] **Step 5: Validate**

Run: `npm run validate:data`
Expected: errors only of the kind "why "aunque" is not a rule…"/"unknown tip" on sentence blanks (fixed in Task 3) and path units with moved rules (Task 7). No tip, en/tips or es/tips errors.
Run: `npx vitest run src/lib/tips.test.ts` — the two cases from Task 1 now PASS.

- [ ] **Step 6: Checkpoint.** No commit.

---

### Task 3: Retag blanks of moved rules

**Files:**
- Create (scratch, not in repo): `retag.mjs` in the session scratchpad
- Modify: `src/data/sentences/*.json` (only `tip`, `why` of affected blanks and the `grammar` array of their sentences)

**Interfaces:**
- Consumes: rule ids from Task 2.
- Produces: no blank with `tip` ∈ {`subjuntivo-clauses`, `relatives`, `passive-se`} and `why` ∈ {`aunque`, `el-que`, `quien`, `cuyo`, `ser-passive`}.

- [ ] **Step 1: Write the script.** Mapping: `subjuntivo-clauses`+`aunque` → `subjuntivo-aunque`; `relatives`+`el-que|quien|cuyo` → `relatives-prep`; `passive-se`+`ser-passive` → `ser-passive`. For each sentence file, edit the raw text: for each affected cloze object, replace `"tip": "<old>"` with the new tag inside that cloze's text span only (locate by `"tokenIndex": N` within the sentence's span), then in the sentence's `grammar` array add the new tag and remove the old one if no other blank of that sentence still uses the old tip. Parse the result with `JSON.parse` before writing. Print each changed `id#index`.

- [ ] **Step 2: Run it**, expected ~30 lines (aunque 12, el-que 10, quien 2, cuyo 2, ser-passive 4, as counted on 2026-11-09).
  Then check by hand the one A1 sentence tagged `passive-se` (blank `why: impersonal`): if its blank is a fixed phrase
  (¿Cómo se dice…?) at A1, keep the sentence and drop the `passive-se` tag and the blank's `tip`/`why` (an A1 sentence
  cannot practise a B1 tip); otherwise move nothing and note it.

- [ ] **Step 3: Dataset scan (Review Focus 2 and 5).** Add to `src/lib/tips.test.ts`:

```ts
  it('sends every blank of a split tip to the tip that now holds its rule', () => {
    for (const s of sentences) for (const c of s.cloze ?? []) {
      if (!c.tip || !c.why) continue
      const found = tipForCloze(s, c)
      expect(found?.tip.id, `${s.id}`).toBe(c.tip)
      expect(found?.rule?.id, `${s.id}`).toBe(c.why)
    }
  })
```
(`sentences` from `../data`.)

- [ ] **Step 4: Validate and test**

Run: `npm run validate:data` → no sentence-blank errors left (path errors may remain until Task 7).
Run: `npx vitest run src/lib/tips.test.ts` → PASS.

- [ ] **Step 5: Checkpoint.** No commit.

---

### Task 4: Rewrite the 37 A2 futuro sentences to *ir a*

**Files:**
- Modify: `src/data/sentences/*.json` (the A2 sentences tagged `futuro`)
- Modify: `src/data/en/sentences/*.json` (their `en`, and `hints` if a hint changes)
- Modify: `src/data/es/sentences/*.json` and `src/data/es/hand/sentences/*` only where one of these ids has a Spain entry (check: `grep -l '"s<id>"' src/data/es -r`)

**Interfaces:**
- Consumes: tip `ir-a` with rules `forms`, `use`, `pronouns`.
- Produces: 37 A2 sentences tagged `ir-a` (not `futuro`), each with a blank on the form of *ir*: `answer` the form (`voy`, `vas`, `va`, `vamos`, `van`), `lemma: "ir"`, `hint: "ir · <person> · presente"`, `tip: "ir-a"`, `why: "forms"` (or `"pronouns"` where a pronoun sits before *ir* or on the infinitive, `"use"` where the point is plan vs. now), `distractors` 2–3 other forms or the -ré form (`iré`) as a wrong option.

- [ ] **Step 1: List them**

```bash
node -e "const fs=require('fs'),d='src/data/sentences/';for(const f of fs.readdirSync(d))for(const s of JSON.parse(fs.readFileSync(d+f)))if(s.level==='A2'&&(s.grammar||[]).includes('futuro'))console.log(f,s.id,s.es)"
```
Expected: 37 lines.

- [ ] **Step 2: Rewrite each** (by hand or one Sonnet agent with this task's text): `es` with *ir a + infinitivo* (`Mañana iré al dentista` → `Mañana voy a ir al dentista`; `¿Podrás ayudarme mañana?` → `¿Vas a poder ayudarme mañana?`), `tokens` rebuilt (`voy`, `a`, `ir` separate tokens), the futuro blank replaced by the ir blank above, other blanks kept with their `tokenIndex` shifted, `grammar`: `futuro` → `ir-a`. Slovak `sk` keeps its meaning (Slovak future is fine). English `en` in the overlay: "going to …". Keep the sentence id, level and topics.

- [ ] **Step 3: Validate**

Run: `npm run validate:data`
Expected: no errors from these ids (tokens rebuild `es`, hint conjugates to the answer, English present for every id).

- [ ] **Step 4: Checkpoint.** No commit.

---

### Task 5: New B1 sentences (3 × ~20) — content batch

**Files:**
- Modify: `src/data/sentences/<topic>.json` (append), `src/data/en/sentences/<topic>.json` (append), Spain overlay only for sentences with Mexico-only words.

**Interfaces:**
- Consumes: rule ids of `subjuntivo-clauses`, `relatives`, `passive-se` (Task 2).
- Produces: B1 blanks with `tip` + `why` for those three tips, at least 6 in each Cesta topic named here and ≥20 per tip in total:
  - `subjuntivo-clauses`: topics `family` and `greetings` (≥6 each), rest spread; `why` from `opinion` (no creo que / no pienso que + subj.), `cuando` (cuando + subj. about the future), `para-que`.
  - `relatives`: `home` and `greetings` (≥6 each); `why` `que`, `donde`, `lo-que`; blank = the relative word.
  - `passive-se`: `body` and `school` (≥6 each); `why` `se`, `impersonal`, `estar-result`; blank = the verb after se (hint `"<inf> · él/ellos · presente"` with the matching form) or `se` itself with a short Slovak hint.

- [ ] **Step 1:** Two Sonnet agents at most, disjoint id ranges (agent 1: subjuntivo-clauses + relatives, ids from max+1; agent 2: passive-se, ids from max+101). Each agent reads CLAUDE.md §1 (Mexican rules), §3 (content conventions), three existing B1 sentences with `tip` blanks as models, and writes: `id`, `es`, `sk`, `level: "B1"`, `topics` (first = the unit topic), `tokens`, `grammar` (the tip tag + the tense tag of the form), `cloze` with `tip`/`why`/`hint`/`distractors`; plus the English overlay entry. Everyday, natural sentences, 8–14 words, no repeated frames.
- [ ] **Step 2:** After each batch: `npm run validate:data` → green; fix and rerun.
- [ ] **Step 3:** Count:

```bash
node -e "const fs=require('fs'),d='src/data/sentences/';const c={};for(const f of fs.readdirSync(d))for(const s of JSON.parse(fs.readFileSync(d+f)))for(const z of s.cloze||[])if(s.level==='B1'&&['subjuntivo-clauses','relatives','passive-se'].includes(z.tip)){const k=z.tip+' '+s.topics[0];c[k]=(c[k]||0)+1}console.log(c)"
```
Expected: each tip ≥20, the two named topics ≥6.

- [ ] **Step 4: Checkpoint.** No commit.

---

### Task 6: New B2 sentences for the new B2 tips — content batch

**Files:** as Task 5.

**Interfaces:**
- Produces: B2 blanks so that each new B2 tip has ≥16 blanks in total and ≥5 in each of its two Cesta topics:
  - `subjuntivo-aunque`: topics `work`, `health` (today 1 each); `why` `aunque`, `a-pesar-de`, `hasta-que`.
  - `relatives-prep`: topics `travel` (today 1), `nature` (today 3); `why` `el-que`, `quien`, `cuyo` (cuyo at most 3 in all).
  - `ser-passive`: topics `shopping`, `tech` (today 1 each); `why` `ser-passive`, `register`; news-like sentences.

- [ ] **Step 1:** One Sonnet agent (or two with disjoint ids), same instructions as Task 5 Step 1 with `level: "B2"`.
- [ ] **Step 2:** `npm run validate:data` → green.
- [ ] **Step 3:** Count with the Task 5 script (B2, the three new tags). Expected as above.
- [ ] **Step 4: Checkpoint.** No commit.

---

### Task 7: Cesta units

**Files:**
- Modify: `src/data/path.json`
- Test: `src/lib/path.test.ts:30-35`

**Interfaces:**
- Consumes: tips and sentences from Tasks 2–6.
- Produces: every usage tip in exactly two units (existing test), no unit teaching a tense above its level.

- [ ] **Step 1: Re-point units** (edit the `grammar`/`rules` of each line in place; drop `rules` where the old rule ids no longer exist):

| Unit | Today | After |
|---|---|---|
| A2 health/1 | futuro (endings) | `ir-a` |
| A2 weather/1 | futuro (stems) | `ir-a` |
| A2 numbers/1 | futuro (endings) | `preterito` |
| A2 home/2 | futuro (stems) | `imperativo` |
| A2 hobbies/2 | futuro | `progresivo` |
| A2 nature/2 | futuro (stems) | `imperativo` |
| B1 family/1 | ser-estar | `subjuntivo-clauses` |
| B1 greetings/1 | preterito-imperfecto | `subjuntivo-clauses` |
| B1 home/1 | imperfecto | `relatives` |
| B1 greetings/2 | imperfecto | `relatives` |
| B1 body/1 | ser-estar | `passive-se` |
| B1 school/1 | preterito | `passive-se` |
| B1 home/2 | ser-estar | `futuro` |
| B2 work/1, health/1 | subjuntivo-clauses | `subjuntivo-aunque` |
| B2 travel/1, nature/1 | relatives | `relatives-prep` |
| B2 shopping/1, tech/1 | passive-se | `ser-passive` |

If the A2 `ir-a` units have fewer than 4 own `ir-a` sentences (health and weather have 3 each after Task 4), rewrite one more A2 sentence of that topic to *ir a* as in Task 4, or pick the A2 unit of `family` (3) only if it is not already a usage unit.

- [ ] **Step 2: Update the level test** in `src/lib/path.test.ts:31`: add `futuro: 'B1'` to `LEVEL`. The counts on lines 33–34 do not change (imperativo/subjuntivo/condicional/pluscuamperfecto units at B1/B2 are untouched).

- [ ] **Step 3: Run**

Run: `npm run validate:data` → green (path units' tips and rules exist).
Run: `npx vitest run src/lib/path.test.ts` → PASS, in particular "give every usage tip two units, each with a full grammar step of its blanks" and "give every usage unit sentences of its own on its tip". If a unit misses blanks, add sentences in its topic (Task 5/6 instructions), never loosen the test.

- [ ] **Step 4: Checkpoint.** No commit.

---

### Task 8: Deviations, docs and full checks

**Files:**
- Modify: `docs/grammar-gap-analysis.md` (§6: what part A1 changed; new §7 "Recorded deviations" with the four items of spec §7)
- Modify: `CLAUDE.md` is Adam's: do not edit; tell him what to update (§1.2 tenses' levels, §8 totals).
- Modify: `docs/superpowers/plans/2026-11-03-after-part-c-roadmap.md` (status line: part A1 done, A2–A4 and B next)

- [ ] **Step 1:** Write the deviations section (progresivo A1; si-clauses B1 with the A2 real condition; `cuyo` outside PCIC; relatives `que` A1 in PCIC but the tip at B1) and the summary of changed counts (sentences rewritten/added, units re-pointed).
- [ ] **Step 2:** Full checks:

Run: `npm run validate:data && npm test && npm run build`
Expected: all green.
Run: `E2E_PORT=5299 npm run test:e2e -- --workers=3`
Expected: all pass (grammar, path and drill specs included). A failing e2e that encodes the old A1 tenses or old tip levels is updated to the new behaviour; anything else is a bug to fix.

- [ ] **Step 3:** One whole-diff review (one reviewer agent, Sonnet, read-only) before Adam's phone test; report to Adam what to test on the phone (spec §8). No commit, no push.

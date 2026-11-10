# New A1–A2 grammar tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Adam chose Native). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five new tips (demonstratives, possessives, interrogatives, negation, personal-a) with blanks that open them and two Cesta units each.

**Architecture:** Five new `Grammar` tags that are usage tips (a blank names its `tip` + `why`), the tip texts in the three
tip files, blanks retagged/added by throw-away scripts in the scratchpad, ~60 new sentences, ten re-pointed path units.

**Tech Stack:** TypeScript, Vitest, JSON data validated by `scripts/validate-data.ts`.

**Spec:** `docs/superpowers/specs/2026-11-09-grammar-a1-a2-tips-design.md`

## Global Constraints

- No commits: Adam tests on the phone first and approves the commit (2026-11-09). Work in the main checkout, uncommitted, on top of the uncommitted part A1.
- UI strings and tip texts in Slovak; Spanish Mexican (no vosotros, no Spain-only words: coche, ordenador, móvil, zumo, patata, conducir, coger, billete…).
- Tip levels: demonstratives A1, possessives A1, interrogatives A1, negation A2, personal-a A2.
- A blank never names a tip above its sentence's level.
- New sentence ids start at s2264; tokens rebuild `es` exactly; every new blank has 3 distractors.
- English hints: `src/data/en/sentences/<topic>.json` entry `hints` is aligned with `cloze` (one per blank, `null` for verb hints).
- Subagents: at most 2 at a time, `model: "sonnet"`, each with its own tips and id range.
- E2E only with `E2E_PORT=5299 npm run test:e2e -- --workers=3`; never kill Adam's dev server on 5173.

## Review Focus

1. A retagged *tu* that is the pronoun *tú* or a *mi* that is *mí* would open the possessives tip for a pronoun — Task 3 retag only matches unaccented determiners and lists every retagged blank for a hand check.
2. An exclamative *¡Qué bonito!* blank opening interrogatives — Task 3 skips tokens inside `¡…!`.
3. A new blank appended to a sentence whose English overlay has no `hints` array, so the English hint is lost or misaligned — Task 3 script asserts `hints.length === cloze.length` after the change.
4. A path unit whose new point has <10 fitting blanks at its level, so its grammar step shrinks — the existing path test "full grammar step" pins it (Task 5).
5. A Spain overlay sentence whose cloze patch points at a token index that moved — validator (`applyVariant` checks) runs after every data task.

---

### Task 1: Code — tags, usage tips, priority, level test, s1105

**Files:**
- Modify: `src/data/types.ts` (`Grammar` union)
- Modify: `scripts/validate-data.ts` (`GRAMMAR` list)
- Modify: `src/lib/clozeChecks.ts:7-23` (`USAGE_TIPS`)
- Modify: `src/lib/tips.ts:29-60` (`TAG_PRIORITY`)
- Modify: `src/data/sentences/*.json` (s1105)
- Test: `src/lib/clozeChecks.test.ts` (describe 'blank levels')

**Interfaces:**
- Produces: tags `'demonstratives' | 'possessives' | 'interrogatives' | 'negation' | 'personal-a'` in `Grammar`, in `USAGE_TIPS`, in `TAG_PRIORITY`.

- [ ] **Step 1: Write the failing test** (in `describe('blank levels')`)

```ts
it('names no tip above the sentence’s level', () => {
  const levelOf = new Map(tips.map((t) => [t.id, t.level]))
  const above: string[] = []
  for (const s of sentences)
    for (const c of s.cloze ?? [])
      if (c.tip && LEVELS.indexOf(levelOf.get(c.tip) ?? 'A1') > LEVELS.indexOf(s.level)) above.push(`${s.id} ${c.tip}`)
  expect(above).toEqual([])
})
```
(import `tips` from `../data` if the file does not yet.)

- [ ] **Step 2: Run** `npx vitest run src/lib/clozeChecks.test.ts` — Expected: FAIL `["s1105 subjuntivo-aunque"]`.
- [ ] **Step 3: Fix s1105**: remove `tip`/`why` from its *cueste* blank and `subjuntivo-aunque` from its `grammar` (keep the blank). If `grammar` becomes empty, drop the key only if other sentences do so; otherwise keep the remaining tags.
- [ ] **Step 4: Add the five tags** to `Grammar`, `GRAMMAR`, `USAGE_TIPS`; `TAG_PRIORITY`: `'negation', 'personal-a'` right after `'object-pronouns'`; `'interrogatives', 'possessives', 'demonstratives'` right before `'gender'`.
- [ ] **Step 5: Run** `npx vitest run src/lib/clozeChecks.test.ts src/lib/tips.test.ts` — Expected: level test PASS. Known red until later tasks: validator (tags without tips → Task 2), path "every usage tip two units" (Task 5).
- [ ] **Step 6:** No commit. Ledger line.

### Task 2: The five tips (Slovak, English, Spain) and NGLE chapters

**Files:**
- Modify: `src/data/tips.json`, `src/data/en/tips.json`, `src/data/es/tips.json` (only for Mexican-only words in examples)
- Test: `src/lib/localized.test.ts` (citation strings, if it lists every tip), `e2e/grammar.spec.ts:117` (33 → 38)

**Interfaces:**
- Consumes: tags from Task 1.
- Produces: tip ids and rule ids exactly as below; Tasks 3–5 use them.

| id | level | rules |
|---|---|---|
| demonstratives | A1 | near, far, neutral, time, alone |
| possessives | A1 | short, nuestro, su, svoj, long, body |
| interrogatives | A1 | words, prep, por-que, cual |
| negation | A2 | no, double, tambien, pairs |
| personal-a | A2 | person, thing, tener, nadie |

- [ ] **Step 1: NGLE chapters.** In Claude in Chrome open https://www.rae.es/gramática/ index; read it with a same-origin `fetch` + `DOMParser` (the visible page is auto-translated). Note the chapter / § for demonstratives, possessives, interrogatives (with exclamatives), negation, and the direct object with *a* (prepositional DO). If rae.es is unreachable, cite the chapter titles from the NGLE table of contents known from part A1 and mark it in the ledger.
- [ ] **Step 2: Write each tip** following the shape of `gustar` (`id, title, level, sources[{source:'pcic',where}, {source:'ngle',where}], variants{mx,es}, ideas[], intro, related[], rules[{id,title,text,because,examples[{es,sk}]}]`). Content per spec §3. PCIC `where` strings:
  - demonstratives `Gramática 4 (A1–A2); 8.2 (A1)`
  - possessives `Gramática 5 (A1–A2); 12.2.3 (A2)`
  - interrogatives `Gramática 7.3 (A1–A2); 8.8 (A1–A2); 8.9 (A1); Ortografía 2.2 (A1)`
  - negation `Gramática 6.1 (A2); 6.2 (A1); 8.2 (A1–A2); 8.5 (A1)`
  - personal-a `Gramática 12.2.2 (A2); 7.3 (A1)`
  `related`: demonstratives → articles, adjectives; possessives → articles, gustar; interrogatives → accents, relatives;
  negation → object-pronouns, gustar, personal-a; personal-a → object-pronouns, articles, negation.
  `because` is one sentence a learner reads after a wrong blank ("Vec je blízko hovoriaceho, preto este.").
- [ ] **Step 3: English** in `src/data/en/tips.json`, same ids, translated title/intro/rules/because/examples.sk→en/variants, as the existing entries.
- [ ] **Step 4: Spain overlay** only for examples with Mexican-only words (carro, departamento, celular, jugo, camión, papás…): add entries like the existing ones in `src/data/es/tips.json`.
- [ ] **Step 5:** `e2e/grammar.spec.ts:117` → `toBe(38)`.
- [ ] **Step 6: Run** `npm run validate:data` (tips part green; sentence counts unchanged) and `npx vitest run src/lib/localized.test.ts src/data/applyVariant.test.ts`. Expected PASS.

### Task 3: Retag existing blanks and add blanks to existing sentences

**Files:**
- Create (scratchpad, not in repo): `retag.cjs`, `candidates.cjs`, `addblanks.cjs`
- Modify: `src/data/sentences/*.json`, `src/data/en/sentences/*.json`, `src/data/es/**/sentences/*.json` only if an overlay patches a cloze list

**Interfaces:**
- Consumes: tip/rule ids of Task 2.
- Produces: per tip ≥ 20 blanks at its level; each Task 5 unit ≥ 4 own sentences with the tip (with Task 4).

- [ ] **Step 1: retag.cjs.** For every blank without `tip`, decide by `answer` (case-insensitive) and context:
  - demonstratives (sentence level ≥ A1): este/esta/estos/estas → `near`; ese/esa/esos/esas/aquel/aquella/aquellos/aquellas → `far`; esto/eso/aquello → `neutral`; then override: next token in {tarde, mañana, noche, semana, fin, año, mes, día, vez, verano, invierno, lunes…domingo} → `time`; next token punctuation or a verb form (`lookupForm` not needed: next token not a noun/adjective in `vocabWords`) → `alone` only when sentence level ≥ A2.
  - possessives: mi/mis/tu/tus (exact, no accent) → `short`; nuestro/nuestra/nuestros/nuestras → `nuestro`; su/sus → `su`; mío/mía/míos/mías/tuyo…/suyo… → `long` (sentence level ≥ A2).
  - interrogatives: answer in {qué, quién, quiénes, cuál, cuáles, dónde, adónde, cuándo, cómo, cuánto, cuánta, cuántos, cuántas, porque} and the token sits after a `¿` (not after `¡`); `cuál/cuáles` → `cual`; `porque`, or `qué` preceded by `por` → `por-que`; preceded by a preposition (a, de, con, para, en, desde, hasta) → `prep`; else `words`. Indirect questions without `¿` are skipped.
  - negation (sentence level ≥ A2): nada/nadie/nunca/jamás → `double`; también/tampoco → `tambien`; algo/alguien/algún/alguno/alguna/algunos/algunas/ningún/ninguno/ninguna → `pairs`; `no` → `no`.
  - personal-a (sentence level ≥ A2): answer a/al with hint containing "pred osobou", or the next token is a proper name, a possessive + family/person noun, quién/alguien/nadie, or a person noun from the family/work topics; next token quién/alguien/nadie → `nadie`, else `person`.
  Add the tag to the sentence's `grammar` (create the array if missing). Print every change (`id answer → tip/why`).
- [ ] **Step 2: Run, read the printout by hand**, revert wrong ones (pronoun *tu*, *eso* as conjunction part *por eso* — skip `eso` after `por`), rerun `npm run validate:data`.
- [ ] **Step 3: candidates.cjs.** Per tip, list sentences at the tip's level (and per Task 5 unit: topic × level × part via the same `partOf` split) that contain a token of the point but no blank on it, with the token index.
- [ ] **Step 4: addblanks.cjs** takes a hand-written list `[{id, tokenIndex, hint, lemma, distractors[3], why, enHint}]` and appends the blank (`answer` = token, `tip`, `why`), the tag, and the English hint (asserts `hints.length === cloze.length` afterwards; creates `hints` filled with `null` for earlier blanks when missing). Hints: Slovak meaning in today's style (`tento`, `tá`, `môj`, `naša`, `jeho`, `kde`, `koľko`, `kto`, `čo`, `prečo`, `nikto`, `nič`, `nikdy`, `tiež nie`, `predložka`); distractors from the same family (este → ese, esta, aquel; mi → mis, tu, su; dónde → cuándo, cómo, qué; nadie → nada, alguien, nunca; a → al, de, en). Pick blanks so that: demonstratives A1 ≥ 20 total, possessives A1 ≥ 20, interrogatives A1 ≥ 20, and the A1 units of Task 5 (home/1, family/2 possessives; travel/1, school/2 demonstratives; numbers/2, work/1 interrogatives) reach ≥ 4 own sentences each, where candidates exist.
- [ ] **Step 5: Run** `npm run validate:data`, `npx vitest run src/lib/clozeChecks.test.ts src/lib/tips.test.ts src/lib/localized.test.ts`. Expected PASS (path still red until Task 5).
- [ ] **Step 6: tips.test cases**:

```ts
it('opens negation for a nadie blank and personal-a for an a blank', () => {
  const blankOf = (tip: string) => {
    for (const s of sentences) { const i = (s.cloze ?? []).findIndex((c) => c.tip === tip); if (i >= 0) return { s, i } }
    throw new Error(tip)
  }
  for (const [tip, rule] of [['negation', 'double'], ['personal-a', 'person']] as const) {
    const s = sentences.find((x) => x.cloze?.some((c) => c.tip === tip && c.why === rule))!
    const i = s.cloze!.findIndex((c) => c.tip === tip && c.why === rule)
    const found = tipFor(taskFromItem('cloze', `${s.id}#${i}`)!, 'wrong')
    expect(found?.tip.id).toBe(tip)
    expect(found?.rule?.id).toBe(rule)
  }
})
```
(adapt to the helpers `tips.test.ts` already uses for an `ir-a` blank — same shape, drop `blankOf` if unused.)

### Task 4: New sentences (two Sonnet agents)

**Files:**
- Modify: `src/data/sentences/<topic>.json`, `src/data/en/sentences/<topic>.json`, Spain overlay `src/data/es/sentences/<topic>.json` where a sentence has a Mexican-only word.

- [ ] **Step 1: Count after Task 3** with candidates.cjs: own sentences per Task 5 unit and blanks per tip at level; write the exact shortfall per unit into the agent prompts.
- [ ] **Step 2: Agent A (sonnet)** — negation A2 (~20: food part 1, hobbies part 1, rest spread; rules no, double, tambien, pairs) and personal-a A2 (~20: greetings part 2, body part 2, rest spread; rules person, nadie). Ids s2264–s2303. Sentences for a part-1 unit are inserted before the middle of that topic × A2 block in the file (partOf splits by file order); part-2 ones appended at the end of the A2 block.
- [ ] **Step 3: Agent B (sonnet)** — A1: interrogatives ~8 (cual, por-que; numbers part 2 / work if short), possessives ~6 (svoj, su; home part 1 / family part 2 if short), demonstratives A2 ~5 (time, alone). Ids s2304–s2330, same placement rule.
  Both prompts carry: the tip's rules (ids + one line each), CLAUDE.md content rules (Mexican, natural Slovak, no vosotros, tokens rebuild `es`, cloze `answer` = token, hint style, 3 distractors, `tip` + `why`, `grammar` tag, `level`, `topics`), the English overlay shape (`{id, en, hints}`), and "run `npm run validate:data` after every file; do not touch other ids".
- [ ] **Step 4: Controller check**: read every new sentence; fix calques; `npm run validate:data` green.

### Task 5: Cesta

**Files:**
- Modify: `src/data/path.json`
- Test: `src/lib/path.test.ts` (existing tests)

- [ ] **Step 1: Re-point** (keep order and ids): A1 home/1, family/2 → `possessives`; travel/1, school/2 → `demonstratives`; numbers/2, work/1 → `interrogatives`; A2 food/1, hobbies/1 → `negation`; greetings/2, body/2 → `personal-a`. Remove their `rules` (null = every rule of the new tip).
- [ ] **Step 2: Rules that would leave the path:** ser-estar `trait` (was only on A1 family/2) → add to A1 emotions/1 (`["state","trait"]`). Every other removed rule is covered by a remaining unit with `rules` null (A1 basics/2, tech/1 presente; school/2 gone → greetings/1 keeps identity/origin/profession; A2 health/1 preterito, numbers/1 and city/2 imperfecto).
- [ ] **Step 3: Run** `npx vitest run src/lib/path.test.ts` and `npm run validate:data`. Expected PASS ("every usage tip two units, full grammar step", "own sentences ≥ 4", no point twice in a row). If a unit is short, add blanks (Task 3 Step 4) or move a new sentence into the unit's part — not by changing the unit.

### Task 6: Deviations, docs, full checks

**Files:**
- Modify: `docs/grammar-gap-analysis.md` (new §8), `docs/superpowers/plans/2026-11-03-after-part-c-roadmap.md` (status line), memory `grammar-reorg-literature.md`

- [ ] **Step 1: §8 "Part A2 applied (uncommitted)"**: five tips, blank counts, new sentence ids, units, the deviations of spec §7.
- [ ] **Step 2: Full checks**: `npm run validate:data`, `npm test`, `npm run build`, `E2E_PORT=5299 npm run test:e2e -- --workers=3`. All green.
- [ ] **Step 3: One fresh reviewer** over the part-A2 diff (Sonnet, Adam's standing rule): content (Mexican, Slovak naturalness, tip texts), retag correctness, path. Fix Critical/Important.
- [ ] **Step 4:** Ledger final lines; report to Adam with the phone test list (spec §8). No commit.

# B1–B2 grammar tips, Mexican notes and loose ends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Adam left the method to Claude: Native, as in part A2). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eleven new B1–B2 tips with blanks that open them and two Cesta units each, `variants.mx` notes from the PCIC, and seven loose hints.

**Architecture:** Same as part A2: new `Grammar` tags that are usage tips (a blank names `tip` + `why`), tip texts in the three tip files, blanks retagged/added by throw-away scripts in the scratchpad, new sentences from s2313, re-pointed path units.

**Tech Stack:** TypeScript, Vitest, JSON data validated by `scripts/validate-data.ts` (and `validate:es`).

**Spec:** `docs/superpowers/specs/2026-11-10-grammar-b1-b2-tips-design.md`

## Global Constraints

- No commit until Adam has tested on the phone and approves (standing pattern of parts A1/A2). Work in the main checkout.
- UI strings and tip texts in Slovak; Spanish Mexican (no vosotros, no Spain-only words: coche, ordenador, móvil, zumo, patata, conducir, coger, billete…).
- Tip ids and levels: periphrases B1, temporal B1, cause B1, reported B1, doubt B1, verb-prep B1, ser-estar-meaning B2, cambio B2, conditional-perfect B2, cond-connectors B2, relatives-mood B2.
- A blank never names a tip above its sentence's level. New sentence ids start at s2313; tokens rebuild `es` exactly; every new blank has 3 distractors.
- English hints: `src/data/en/sentences/<topic>.json` entry `hints` is aligned with `cloze`.
- Subagents: at most 2 at a time, `model: "sonnet"`, own id range, only for new sentences.
- E2E only with `E2E_PORT=5299 npm run test:e2e -- --workers=3`; never kill Adam's dev server on 5173.

## Review Focus

1. Retagging by word (*como*, *que*, *si*, *cuando*) would tag non-matching uses (*como* = I eat) — retag matches by hint/lemma and is printed for a hand check.
2. A new blank appended to a sentence whose English overlay has no `hints` — script asserts `hints.length === cloze.length`.
3. Verb-form answers (*habría ido*, *hubiera sabido*) as multi-token blanks: tokens rebuild `es`, so the blank is the auxiliary token only (`habría`, `hubiera`) — new sentences are written for that.
4. A path unit with <4 own blanks, or the same point twice in a row — existing path tests (Task 6).
5. A Spain overlay cloze patch pointing to a moved token — `validate:es` runs after every data task.

---

### Task 1: Loose-end hints (spec §7)

**Files:** Modify `src/data/sentences/*.json` (+ `src/data/en/sentences`, `src/data/es/**` if they carry the same hint).

- [ ] **Step 1:** Read s371, s2265, s2271, s019, s836, s273, s1228 (blanks, hints, distractors). Fix each so the hint alone does not decide and the hint is accurate: nadie/nada (s371, s2265) and no/nunca (s2271) get a hint that names the *meaning* not the word (`nikto` vs `nič` only if the sentence allows both grammatically — otherwise change a distractor); s019 *Qué/Cuál* hint wording; s836, s273 wording; s1228 *tu jefa* = *šéfka* (not *mamu*) in sk and English.
- [ ] **Step 2:** Run `npm run validate:data && npm run validate:es`. Expected PASS.

### Task 2: A4 — `variants.mx` notes and the three unsupported claims

**Files:** Modify `src/data/tips.json`, `src/data/en/tips.json` (variants.mx), `src/data/es/tips.json` only if a note touches Spain text.

- [ ] **Step 1:** In Claude in Chrome open https://dle.rae.es (same-origin `fetch` + `DOMParser`): check *radio* (m./f.), *sartén* (f.; m. in parts of America), *casa* with article; check the NGLE sections cited in gap-analysis §4 rows 19–20. A claim the RAE does not support is rewritten or removed from `variants.mx` of `gender` / `articles`. If rae.es is unreachable, soften the claim to what the PCIC says and note it in the ledger.
- [ ] **Step 2:** Add one-sentence notes (Slovak + English) per the list in spec §6 to the target tips' `variants.mx` (object-pronouns, progresivo, subjuntivo-clauses, condicional, gender, articles, presente, imperativo, reflexive, hay-estar, negation, futuro). Never repeat what a note already says.
- [ ] **Step 3:** `npx vitest run src/lib/localized.test.ts && npm run validate:data`. Expected PASS.

### Task 3: Code — eleven tags

**Files:** `src/data/types.ts` (`Grammar`), `scripts/validate-data.ts` (`GRAMMAR`), `src/lib/clozeChecks.ts` (`USAGE_TIPS`), `src/lib/tips.ts` (`TAG_PRIORITY`).

- [ ] **Step 1:** Add the eleven ids (spec §3 table) to `Grammar`, `GRAMMAR`, `USAGE_TIPS`; `TAG_PRIORITY`: `periphrases` after `obligation`; `temporal`, `cause`, `reported` after `si-clauses`; `doubt` after `subjuntivo-wishes`; `verb-prep` after `por-para`; `ser-estar-meaning`, `cambio` after `ser-estar`; `conditional-perfect`, `cond-connectors` after `subj-imperfecto`; `relatives-mood` after `relatives-prep`.
- [ ] **Step 2:** `npx vitest run src/lib/clozeChecks.test.ts src/lib/tips.test.ts`. Expected: level test PASS; validator red until Task 4.

### Task 4: The eleven tips (Slovak, English, Spain) and NGLE chapters

**Files:** `src/data/tips.json`, `src/data/en/tips.json`, `src/data/es/tips.json`; `e2e/grammar.spec.ts` (38 → 49); `src/lib/localized.test.ts` if it lists citations.

- [ ] **Step 1:** NGLE chapters from the rae.es index (Chrome fetch): periphrases §28 (perífrasis verbales); temporal ch. 47?/subordinadas temporales; cause ch. 46 (causales y consecutivas); reported ch. 43 (oración subordinada sustantiva, estilo indirecto) ; doubt § 25.x / adverbios de duda; verb-prep ch. 36 (régimen preposicional); ser-estar-meaning § 37.7–37.9; cambio § 37.x (verbos de cambio, 38); conditional-perfect § 23.15–23.16 + 47; cond-connectors ch. 47; relatives-mood ch. 44 + 25. Verify each number against the index; unreachable → mark in ledger.
- [ ] **Step 2:** Write each tip in the shape of `gustar` (`id,title,level,sources[pcic,ngle],variants{mx,es},ideas[],intro,related[],rules[{id,title,text,because,examples}]`), rule ids exactly as the spec §3 table. PCIC `where` from the table's last column with levels. `because` is one sentence read after a wrong blank.
- [ ] **Step 3:** English in `src/data/en/tips.json`; Spain overlay only where examples use Mexican-only words.
- [ ] **Step 4:** `e2e/grammar.spec.ts` count → 49.
- [ ] **Step 5:** `npm run validate:data` (tip part green), `npx vitest run src/lib/localized.test.ts src/data/applyVariant.test.ts`. Expected PASS.

### Task 5: Retag existing blanks and add blanks to existing sentences

**Files:** scratchpad `retag.cjs`, `candidates.cjs`, `addblanks.cjs`; modify `src/data/sentences/*.json`, `src/data/en/sentences/*.json`.

- [ ] **Step 1: retag.cjs** per point (sentence level ≥ tip level): acabar/empezar/volver/soler/dejar/seguir blanks (answer is the periphrastic verb form or the preposition `de`/`a` after them) → `periphrases`; `cuando/mientras/antes/después/desde/hasta` conjunctions → `temporal`; `porque/como/así/entonces/por eso/ya que` → `cause`; verbs of saying followed by *que* (`dijo`, `preguntó`, `explicó`) → `reported`; `quizá/tal vez/a lo mejor/capaz/probablemente` → `doubt`; preposition blanks after pensar/soñar/contar/depender/darse cuenta/acordarse → `verb-prep`; `listo/aburrido/…` ser/estar blanks → `ser-estar-meaning`; ponerse/quedarse/hacerse/volverse → `cambio`; `habría/hubiera/hubiese` → `conditional-perfect`; `siempre que/a no ser que/salvo que/por si/con tal de que` → `cond-connectors`; subjunctive after `que` in a relative with indefinite antecedent (nadie/algo/alguien/un … que) → `relatives-mood`. Print every change; Adam-style hand check; revert wrong ones.
- [ ] **Step 2: candidates.cjs** lists sentences containing each point but no blank on it; **addblanks.cjs** appends hand-written blanks (hint in today's style, 3 distractors, `why`, English hint; asserts hints length).
- [ ] **Step 3:** Target ≥ 20 blanks per tip at its level and above, ≥ 4 own sentences per Task 6 unit.
- [ ] **Step 4:** `npm run validate:data && npm run validate:es`; `npx vitest run src/lib/clozeChecks.test.ts src/lib/tips.test.ts src/lib/localized.test.ts`. Add to `tips.test.ts` (same shape as the existing negation case): a *dijo que* blank opens `reported`/`que`, a *quizá* blank opens `doubt`/`subj`. Expected PASS.

### Task 6: New sentences (up to two Sonnet agents)

- [ ] **Step 1:** Count shortfalls per tip/unit with candidates.cjs; put exact numbers in the prompts.
- [ ] **Step 2:** Agent A: ids s2313–s2400 for periphrases, temporal, cause, reported, doubt, verb-prep (B1). Agent B: ids s2401–s2500 for ser-estar-meaning, cambio, conditional-perfect, cond-connectors, relatives-mood (B2). Prompts carry rules (ids + one line), CLAUDE.md content rules, English overlay shape, "run `npm run validate:data` after every file; do not touch other ids".
- [ ] **Step 3:** Controller reads every new sentence, fixes calques; `validate:data` + `validate:es` green.

### Task 7: Cesta

**Files:** `src/data/path.json`; test `src/lib/path.test.ts`.

- [ ] **Step 1:** Choose two B1/B2 units per tip from units whose point has surplus (presente, preterito, subjuntivo-wishes, si-clauses, por-para), where the topic fits and ≥ 4 own blanks exist; re-point (rules null); same point never twice in a row.
- [ ] **Step 2:** Rules that would leave the path move to a remaining unit of that point.
- [ ] **Step 3:** `npx vitest run src/lib/path.test.ts && npm run validate:data`. Expected PASS.

### Task 8: Docs and full checks

- [ ] **Step 1:** `docs/grammar-gap-analysis.md` new §9 (A3 + A4 applied, blank counts, ids, units, deviations of spec §9); roadmap status line; memory `grammar-reorg-literature.md`.
- [ ] **Step 2:** `npm run validate:data`, `npm run validate:es`, `npm test`, `npm run build`, `E2E_PORT=5299 npm run test:e2e -- --workers=3`. All green.
- [ ] **Step 3:** One Sonnet reviewer over the diff (content, retag correctness, path). Fix Critical/Important.
- [ ] **Step 4:** Report with the phone-test list (spec §10). No commit until Adam says so.

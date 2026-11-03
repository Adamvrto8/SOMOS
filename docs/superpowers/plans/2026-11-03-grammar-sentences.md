# Sentences for the new grammar points — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 16 grammar points of step 1 about 20 sentences each with blanks on the point, link usage blanks to their tip and rule, and give the 11 usage tips 2 path units each.

**Architecture:** A blank gets an optional `tip` (usage tip id) next to `why` (its rule). The checks for such blanks live in a pure module `src/lib/clozeChecks.ts`, used by the validator. `tipForCloze` reads `tip` first; the path matches usage units by `tip` and tense units by the hint as before. Content is written by two sonnet agents into staging files and merged by a script.

**Tech Stack:** Vite + React + TS, Vitest, Playwright, Node type-stripping scripts (`node scripts/x.ts`, imports with `.ts`).

**Spec:** `docs/superpowers/specs/2026-11-03-grammar-sentences-design.md`

## Global Constraints

- Worktree `C:\CODE\SOMOS-sentences`, branch `grammar-sentences`; e2e there runs with `E2E_PORT=5299 npm run test:e2e -- --workers=3`.
- UI strings Slovak (+ English overlay); code, comments, commits English; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mexican Spanish only, no vosotros, no Spain-only words (validator rejects them).
- Sentence ids continue from `s1626`; tokens rebuild `es` exactly (no space before `.,!?;:`, none after `¿¡`).
- Never stage `CLAUDE.md`, `poznaky.txt`, `.gitignore`, `Design/`. Never curl the live site.
- At most 2 subagents at a time, `model: "sonnet"`, each with its own staging file.
- `npm run validate:data` after every data change, `npm test` after `src/lib` changes, build + e2e before the push.

## Review Focus

1. Old sentences with a second blank: the English `hints` array must stay aligned (one entry per blank) — a misaligned hint shows the wrong English hint for a blank.
2. Adding sentences to a topic re-splits `partOf` for two-part topics: a unit's own sentences change; nothing stored depends on the split (attempts use sentence ids), but the path tests that pin a unit's tasks may move.
3. A `subjuntivo-wishes` blank with a full subjunctive hint must still serve a subjuntivo unit (`tipForHint`), while "Prečo?" opens the usage tip.
4. A `lemma · person` blank answered with another tense's form (viajo for viajaría) must be ❌ with its meaning, not a typo.
5. Choice tasks use `cloze[0]`: new second blanks must not replace the first one.

---

### Task 1: `clozeChecks.ts` — usage blank checks

**Files:**
- Create: `src/lib/clozeChecks.ts`
- Test: `src/lib/clozeChecks.test.ts`

**Interfaces:**
- Produces:
  - `USAGE_TIPS: readonly Grammar[]` — the 11 usage tip ids.
  - `type UsageHint = { kind: 'person'; lemma: string; person: Person } | { kind: 'lemma' } | { kind: 'other' }`
  - `usageHint(cloze: Cloze, verbs: Map<string, Verb>): UsageHint` — `"leer · yo"` → person; hint equal to a verb lemma → lemma; else other.
  - `formsFor(verb: Verb, person?: Person): string[]` — lowercase single-token forms (last token, so reflexive "me levanto" → "levanto") of presente, preterito, imperfecto, futuro, subjuntivo, subjImperfecto, condicional, plus `imperativo[person]` (not yo); all persons when `person` is omitted.
  - `usageClozeErrors(sentence: Sentence, cloze: Cloze, tips: Map<string, Tip>, verbs: Map<string, Verb>): string[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { tipById, verbById } from '../data'
import type { Cloze, Sentence } from '../data/types'
import { formsFor, usageClozeErrors, usageHint, USAGE_TIPS } from './clozeChecks'

const sentence = (cloze: Cloze, grammar: Sentence['grammar'] = ['si-clauses']): Sentence => ({
  id: 's9999', es: 'x', sk: 'x', level: 'B1', topics: ['basics'], tokens: [cloze.answer], grammar, cloze: [cloze],
})
const errors = (cloze: Cloze, grammar?: Sentence['grammar']) => usageClozeErrors(sentence(cloze, grammar), cloze, tipById, verbById)
const blank = (over: Partial<Cloze>): Cloze => ({ tokenIndex: 0, answer: 'leería', lemma: 'leer', hint: 'leer · yo', tip: 'si-clauses', why: 'unreal', ...over })

describe('usageHint', () => {
  it('tells a hint without tense, the lemma alone and anything else apart', () => {
    expect(usageHint(blank({}), verbById)).toEqual({ kind: 'person', lemma: 'leer', person: 'yo' })
    expect(usageHint(blank({ hint: 'gustar', lemma: 'gustar', answer: 'gustan' }), verbById)).toEqual({ kind: 'lemma' })
    expect(usageHint(blank({ hint: 'por/para', lemma: 'para', answer: 'para' }), verbById)).toEqual({ kind: 'other' })
    expect(usageHint(blank({ hint: 'leer · yo · condicional' }), verbById)).toEqual({ kind: 'other' })
  })
})

describe('formsFor', () => {
  it('lists the one-word forms of a person in every simple tense', () => {
    const forms = formsFor(verbById.get('tener')!, 'yo')
    expect(forms).toEqual(expect.arrayContaining(['tengo', 'tuve', 'tenía', 'tendré', 'tenga', 'tuviera', 'tendría']))
    expect(formsFor(verbById.get('tener')!, 'tu')).toContain('ten')
    expect(formsFor(verbById.get('levantarse')!, 'yo')).toContain('levanto')
  })
})

describe('usageClozeErrors', () => {
  it('accepts a good usage blank', () => {
    expect(errors(blank({}))).toEqual([])
    expect(errors(blank({ hint: 'gustar', lemma: 'gustar', answer: 'gustan', tip: 'gustar', why: 'plural' }), ['gustar'])).toEqual([])
    expect(errors(blank({ hint: 'por/para', lemma: 'para', answer: 'para', tip: 'por-para', why: 'para' }), ['por-para'])).toEqual([])
  })
  it('wants a usage tip, its own rule and the tag', () => {
    expect(errors(blank({ tip: 'subjuntivo' }))).toContain('tip "subjuntivo" is not a usage tip')
    expect(errors(blank({ why: undefined }))).toContain('a blank with `tip` needs `why`')
    expect(errors(blank({ why: 'para' }))).toContain('why "para" is not a rule of the tip "si-clauses"')
    expect(errors(blank({}), ['condicional'])).toContain('the sentence is not tagged "si-clauses"')
  })
  it('allows a hint without tense only on a usage blank, with a form of that person', () => {
    expect(errors(blank({ tip: undefined, why: undefined }))).toContain('a hint without tense needs `tip`')
    expect(errors(blank({ answer: 'leíste' }))).toContain('"leíste" is not a form of leer for yo')
    expect(errors(blank({ hint: 'gustar', lemma: 'gustar', answer: 'gustamos', tip: 'gustar', why: 'how' }), ['gustar'])).toEqual([])
    expect(errors(blank({ hint: 'gustar', lemma: 'gustar', answer: 'gusto', tip: 'gustar', why: 'how' }), ['gustar'])).toEqual([])
    expect(errors(blank({ hint: 'gustar', lemma: 'gustar', answer: 'gustón', tip: 'gustar', why: 'how' }), ['gustar'])).toContain('"gustón" is not a form of gustar')
  })
  it('names eleven usage tips, each a tip with rules', () => {
    expect(USAGE_TIPS).toHaveLength(11)
    for (const id of USAGE_TIPS) expect(tipById.get(id)?.rules.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/clozeChecks.test.ts`
Expected: FAIL — cannot resolve `./clozeChecks`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Cloze, Grammar, Person, Sentence, Tip, Verb } from '../data/types.ts'

// The blanks of the usage tips (step 2 of part C): a blank names its tip and rule, since no verb hint leads there.

export const USAGE_TIPS: readonly Grammar[] = [
  'gustar', 'hay-estar', 'object-pronouns', 'comparisons', 'obligation', 'subjuntivo-wishes',
  'si-clauses', 'por-para', 'subjuntivo-clauses', 'relatives', 'passive-se',
]

const PERSON_LABELS: Record<string, Person> = {
  yo: 'yo', tú: 'tu', él: 'el', ella: 'el', usted: 'el', nosotros: 'nosotros', ellos: 'ellos', ellas: 'ellos', ustedes: 'ellos',
}
const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos']
const SIMPLE = ['presente', 'preterito', 'imperfecto', 'futuro', 'subjuntivo', 'subjImperfecto', 'condicional'] as const

export type UsageHint = { kind: 'person'; lemma: string; person: Person } | { kind: 'lemma' } | { kind: 'other' }

/** "leer · yo": the sentence picks the tense; "gustar": the sentence picks the person too. */
export function usageHint(cloze: Cloze, verbs: Map<string, Verb>): UsageHint {
  const hint = cloze.hint ?? ''
  const two = /^(\S+) · (\S+)$/.exec(hint)
  if (two && verbs.has(two[1]) && PERSON_LABELS[two[2]]) return { kind: 'person', lemma: two[1], person: PERSON_LABELS[two[2]] }
  if (hint === cloze.lemma && verbs.has(hint)) return { kind: 'lemma' }
  return { kind: 'other' }
}

/** The one-word forms of a verb (the pronoun of a reflexive left out), of one person or all. */
export function formsFor(verb: Verb, person?: Person): string[] {
  const out: string[] = []
  for (const p of person ? [person] : PERSONS) {
    for (const tense of SIMPLE) out.push(verb[tense][p])
    if (p !== 'yo') out.push(verb.imperativo[p])
  }
  return out.map((f) => f.split(' ').at(-1)!.toLowerCase())
}

export function usageClozeErrors(sentence: Sentence, cloze: Cloze, tips: Map<string, Tip>, verbs: Map<string, Verb>): string[] {
  const hint = usageHint(cloze, verbs)
  if (!cloze.tip) return hint.kind === 'person' ? ['a hint without tense needs `tip`'] : []
  const errors: string[] = []
  if (!USAGE_TIPS.includes(cloze.tip)) errors.push(`tip "${cloze.tip}" is not a usage tip`)
  if (!sentence.grammar?.includes(cloze.tip)) errors.push(`the sentence is not tagged "${cloze.tip}"`)
  if (!cloze.why) errors.push('a blank with `tip` needs `why`')
  else if (!tips.get(cloze.tip)?.rules.some((r) => r.id === cloze.why)) errors.push(`why "${cloze.why}" is not a rule of the tip "${cloze.tip}"`)
  const answer = cloze.answer.toLowerCase()
  if (hint.kind === 'person') {
    if (hint.lemma !== cloze.lemma) errors.push(`lemma "${cloze.lemma}" is not the hint's "${hint.lemma}"`)
    else if (!formsFor(verbs.get(hint.lemma)!, hint.person).includes(answer)) errors.push(`"${cloze.answer}" is not a form of ${hint.lemma} for ${cloze.hint!.split(' · ')[1]}`)
  }
  if (hint.kind === 'lemma' && !formsFor(verbs.get(cloze.lemma)!).includes(answer)) errors.push(`"${cloze.answer}" is not a form of ${cloze.lemma}`)
  return errors
}
```

(`Cloze.tip` does not exist yet: add `tip?: Grammar` to `Cloze` in `src/data/types.ts` in this step, with the comment from the spec §2.1, and change the `why` comment to "ser/estar blanks: a rule of ser-estar; blanks with `tip`: a rule of that tip".)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/clozeChecks.test.ts`
Expected: PASS (4 describe blocks, all green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/clozeChecks.ts src/lib/clozeChecks.test.ts src/data/types.ts
git commit -m "feat(data): checks for blanks that name a usage tip"
```

---

### Task 2: Validator uses the checks; usage rules get `because`

**Files:**
- Modify: `scripts/validate-data.ts` (cloze loop ~455–475, tip checks ~337–345)
- Modify: `src/data/types.ts` (`TipRule.because` comment)
- Modify: `src/data/tips.json`, `src/data/en/tips.json` (a `because` on every rule of the 11 usage tips)

**Interfaces:**
- Consumes: `usageHint`, `usageClozeErrors`, `USAGE_TIPS` from Task 1 (import `'../src/lib/clozeChecks.ts'`).
- Produces: `TipRule.because` present on every usage-tip rule, a short sentence for one blank ("Ide o účel, preto para.").

- [ ] **Step 1: Write the failing check**

In the tip section of the validator add:

```ts
for (const id of USAGE_TIPS) {
  for (const rule of tipById.get(id)?.rules ?? []) if (!isNonEmpty(rule.because)) fail(`tips[${id}]`, `rule "${rule.id}" needs \`because\` (shown for a blank)`)
}
```

and in the English tip overlay check the same for `because` of these rules (find where the overlay's rules are checked and require `because` when the base rule has one).

- [ ] **Step 2: Run to verify it fails**

Run: `npm run validate:data`
Expected: FAIL — 40 lines `rule "…" needs \`because\``.

- [ ] **Step 3: Add the `because` lines and wire the cloze checks**

Add a `because` to each of the 40 rules in `src/data/tips.json` and `src/data/en/tips.json`. Form: one short sentence naming the reason as seen in a blank, e.g. por-para/para "Ide o účel alebo cieľ, preto para." / "It is a purpose or goal, so para."; si-clauses/unreal "Podmienka je nereálna: si + subj. imperfecto, potom condicional." / "An unreal condition: si + imperfect subjunctive, then the conditional.".

In the cloze loop replace the hint and `why` checks with:

```ts
    const usage = usageHint(c, verbById)
    if (usage.kind === 'other') {
      const result = expectedFromHint(c)
      if (result && 'error' in result) fail(cw, result.error)
      if (result && 'expected' in result && result.expected.toLowerCase() !== c.answer.toLowerCase()) {
        fail(cw, `hint "${c.hint}" gives "${result.expected}", answer is "${c.answer}"`)
      }
    }
    for (const error of usageClozeErrors(s, c, tipById, verbById)) fail(cw, error)

    // A ser/estar cloze says why it is that verb: the tip shows this reason for the sentence.
    if (c.hint?.startsWith('ser/estar ·')) {
      … unchanged …
    } else if (c.why !== undefined && c.tip === undefined) fail(cw, '`why` is only for ser/estar clozes and blanks with `tip`')
```

Note: a usage blank with a verb lemma and a Slovak hint (e.g. obligation "debo" with hint "musieť") would hit `expectedFromHint`'s "verb needs a hint" error; such blanks use the lemma-only hint (`deber`) instead — say so in the content brief (Task 4).

Update the `TipRule.because` comment: "ser-estar and the usage tips: shown for one blank".

- [ ] **Step 4: Run to verify it passes**

Run: `npm run validate:data && npx vitest run src/lib/clozeChecks.test.ts`
Expected: `validate:data` prints its OK summary; tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-data.ts src/data/types.ts src/data/tips.json src/data/en/tips.json
git commit -m "feat(data): the validator checks usage blanks, usage rules say why for one blank"
```

---

### Task 3: "Prečo?" for usage blanks

**Files:**
- Modify: `src/lib/tips.ts` (`tipForCloze` ~219, `TAG_PRIORITY` ~29)
- Test: `src/lib/tips.test.ts`

**Interfaces:**
- Produces:
  - `tipForHint(sentence: Sentence, cloze: Cloze): TaskTip | undefined` — today's `tipForCloze` body (the tip the hint points at).
  - `tipForCloze(sentence, cloze)` — `cloze.tip` first (targeted, rule `why`, its localized `because`), else `tipForHint`.

- [ ] **Step 1: Write the failing test** (append to `src/lib/tips.test.ts`; add `tipForCloze, tipForHint` to the import from `./tips` and `import type { Cloze, Sentence } from '../data/types'`)

```ts
describe('usage blanks', () => {
  const blank: Cloze = { tokenIndex: 3, answer: 'para', lemma: 'para', hint: 'por/para', tip: 'por-para', why: 'para', distractors: ['por', 'de'] }
  const sentence: Sentence = { id: 's9999', es: 'Estudio mucho para aprender.', sk: 'x', level: 'B1', topics: ['school'], grammar: ['por-para', 'presente'], tokens: ['Estudio', 'mucho', 'para', 'aprender', '.'], cloze: [{ ...blank, tokenIndex: 2 }] }

  it('open their tip at their rule with its reason', () => {
    const found = tipForCloze(sentence, sentence.cloze![0])
    expect(found?.tip.id).toBe('por-para')
    expect(found?.rule?.id).toBe('para')
    expect(found?.because).toBeTruthy()
    expect(found?.targeted).toBe(true)
  })

  it('a subjunctive with a full hint explains the use, its hint still the form', () => {
    const wish: Cloze = { tokenIndex: 2, answer: 'vengas', lemma: 'venir', hint: 'venir · tú · subjuntivo', tip: 'subjuntivo-wishes', why: 'wish', distractors: ['vienes', 'vendrás'] }
    const s: Sentence = { ...sentence, es: 'Quiero que vengas.', grammar: ['subjuntivo-wishes', 'subjuntivo'], tokens: ['Quiero', 'que', 'vengas', '.'], cloze: [wish] }
    expect(tipForCloze(s, wish)?.tip.id).toBe('subjuntivo-wishes')
    expect(tipForHint(s, wish)?.tip.id).toBe('subjuntivo')
  })

  it('a hint without tense points nowhere by itself', () => {
    const si: Cloze = { tokenIndex: 0, answer: 'leería', lemma: 'leer', hint: 'leer · yo', tip: 'si-clauses', why: 'unreal' }
    expect(tipForHint({ ...sentence, cloze: [si] }, si)).toBeUndefined()
    expect(tipForCloze({ ...sentence, cloze: [si] }, si)?.rule?.id).toBe('unreal')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/tips.test.ts`
Expected: FAIL — `tipForHint` is not exported / `tipForCloze(...).tip.id` is `undefined` for the por/para blank.

- [ ] **Step 3: Write minimal implementation**

Rename today's `export function tipForCloze` to `export function tipForHint` (body unchanged) and add above it:

```ts
/** The tip a blank practises: the usage tip it names, else the one its hint points at. */
export function tipForCloze(sentence: Sentence, cloze: Cloze): TaskTip | undefined {
  if (!cloze.tip) return tipForHint(sentence, cloze)
  const tip = tipById.get(cloze.tip)
  // The reason is said in the learner's language; the rule is found by its id in either.
  const rule = tip && localizedTip(tip).rules.find((r) => r.id === cloze.why)
  return targeted(cloze.tip, rule?.because ? { rule: rule.id, because: rule.because } : undefined)
}
```

Extend `TAG_PRIORITY`: put `'por-para', 'gustar', 'hay-estar', 'relatives', 'passive-se', 'comparisons', 'obligation', 'object-pronouns'` right after `'ser-estar'`, and `'si-clauses', 'subjuntivo-clauses', 'subjuntivo-wishes'` right before `'subj-imperfecto'` (a builder of a si-sentence explains the si-clause before the tense).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: all unit tests PASS (tips.test old cases unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tips.ts src/lib/tips.test.ts
git commit -m "feat(grammar): a usage blank opens its tip at its rule"
```

---

### Task 4: Staging format, merge script, content briefs

**Files:**
- Create (scratchpad, not committed): `<scratchpad>/stage/merge.ts`, `<scratchpad>/stage/brief.md`
- Staging files written by agents: `<scratchpad>/stage/a.json`, `<scratchpad>/stage/b.json`

**Interfaces:**
- Produces the staging format (one array per file):

```ts
interface Staged {
  topic: string            // topic id
  level: Level
  es: string               // the sentence, Mexican Spanish
  sk: string               // natural Slovak
  en: string               // natural English
  grammar: Grammar[]       // the point first, then tense tags of the verbs
  blanks: {
    answer: string         // a token of es, exactly
    occurrence?: number    // 1-based, only when the token occurs twice
    lemma: string
    hint: string           // see spec §2.2
    tip?: Grammar          // usage points only
    why?: string           // rule id; required with tip
    distractors: string[]  // 2–3
    enHint?: string        // English of a Slovak hint ("por/para" stays "por/para")
  }[]
}
```

- [ ] **Step 1: Write the merge script** — reads both staging files, tokenizes `es` with `es.match(/[¿¡]|[^\s¿¡.,!?;:]+|[.,!?;:]/g)`, checks the tokens rebuild `es` (same `joinTokens` rule as the validator), finds each blank's `tokenIndex` (by occurrence), gives ids from `s1626` in file order, appends each sentence to `src/data/sentences/<topic>.json` and `{ id, en, hints? }` to `src/data/en/sentences/<topic>.json` (`hints` only when a blank has a Slovak hint: `null` for verb-hinted blanks, `enHint` otherwise), keeping the files' existing formatting (insert before the closing `]`, one object per line as the files use). It prints per point and level the counts. Run with `node <scratchpad>/stage/merge.ts --dry` first (prints, writes nothing).

- [ ] **Step 2: Write `brief.md`** — the spec §2.2–2.4 tables verbatim, the staging format, the Mexican rules (CLAUDE.md §1), the 22 units of spec §3.1 with their topics (≈6 sentences per unit topic and level, rest across other topics of the level), 20–22 sentences per point, the hint rules (verb lemma with a non-verb meaning → lemma-only hint, never a Slovak hint on a verb), every blank 2–3 distractors that are real words a learner could confuse, A1 vocabulary for A1 points; and a list of 10 good example entries (one per kind of hint).

- [ ] **Step 3: Dispatch 2 agents** (`model: "sonnet"`, background): agent A — gustar, hay-estar, object-pronouns, comparisons, obligation, imperativo, pluscuamperfecto → `a.json`; agent B — subjuntivo, condicional, subj-imperfecto, subjuntivo-wishes, si-clauses, por-para, subjuntivo-clauses, relatives, passive-se → `b.json`. Each runs `node <scratchpad>/stage/merge.ts --dry --file <own>` until it reports no errors.

- [ ] **Step 4: Merge and validate**

Run: `node <scratchpad>/stage/merge.ts && npm run validate:data`
Expected: ~320 sentences added (16 points × ~20), validator OK.

- [ ] **Step 5: Read every merged sentence** (a compact dump: id, level, es, sk, blank) and fix what is unnatural, wrong or Spain-only by hand; re-run `npm run validate:data && npm test`.

Expected: validator OK, unit tests PASS (path tests may move — Review Focus 2; fix the test only if it pinned a split, never the data to suit a test).

- [ ] **Step 6: Commit**

```bash
git add src/data/sentences src/data/en/sentences
git commit -m "feat(content): ~320 sentences on the B1-B2 tenses and the usage tips"
```

---

### Task 5: Second blanks in old sentences

**Files:**
- Create (scratchpad): `<scratchpad>/stage/candidates.ts`, `<scratchpad>/stage/old.json`, `<scratchpad>/stage/apply-old.ts`
- Modify: `src/data/sentences/*.json`, `src/data/en/sentences/*.json`

- [ ] **Step 1: Candidate script** — prints old sentences (id < s1626) without a `tip` blank that contain: `por`/`para`; `si` + a verb; `que` followed by a subjunctive form (from `formsFor` subjuntivo set); `gusta(n)`/`encanta(n)`/`duele(n)`; `hay`; `más … que`/`tan … como`/`mejor`/`peor`; `que`/`donde`/`lo que` after a noun; `se` + a 3rd-person verb; `tener que`/`hay que`/`debe`. One line each: `id level | es | existing blank answers`.

- [ ] **Step 2: Pick ~100 by hand** into `old.json`: `{ id, answer, occurrence?, hint, tip, why, distractors, enHint? }`, only where the structure is the clear point of the sentence and the token is not already blanked.

- [ ] **Step 3: Apply script** — appends the blank (with `tokenIndex`) to the sentence's `cloze`, adds the `tip` to `grammar` if missing, and in the English overlay extends `hints` to one entry per blank (`null` for the old verb blanks when `hints` did not exist and no Slovak hint needs one; the new `enHint`).

Run: `node <scratchpad>/stage/apply-old.ts && npm run validate:data && npm test`
Expected: ~100 blanks added; validator OK (it enforces `hints` length = blanks); tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/data/sentences src/data/en/sentences
git commit -m "feat(content): old sentences with por/para, si, gustar… get a blank on it"
```

---

### Task 6: Path — usage units take over 22 units

**Files:**
- Modify: `src/data/path.json` (22 entries of spec §3.1: `grammar` changed, `rules` removed)
- Modify: `src/lib/path.ts` (`clozeFits` ~103)
- Test: `src/lib/path.test.ts`

**Interfaces:**
- Consumes: `tipForHint` (Task 3), `USAGE_TIPS` (Task 1).

- [ ] **Step 1: Write the failing tests** (in `describe('steps')`)

```ts
  it('give every usage tip two units, each with a full grammar step of its blanks', () => {
    for (const id of USAGE_TIPS) {
      const units = pathUnits.filter((u) => u.grammar === id)
      expect(units, id).toHaveLength(2)
      for (const unit of units) {
        const tasks = stepTasks(unit, 'grammar')
        expect(tasks, unit.id).toHaveLength(LESSON_SIZE)
        expect(tasks.every((t) => (t.kind === 'cloze' || t.kind === 'choice') && t.cloze.tip === id), unit.id).toBe(true)
      }
    }
  })

  it('let a subjuntivo unit practise a wish blank with a full subjunctive hint', () => {
    const units = pathUnits.filter((u) => u.grammar === 'subjuntivo')
    const blanks = units.flatMap((u) => stepTasks(u, 'grammar')).filter((t) => (t.kind === 'cloze' || t.kind === 'choice') && t.cloze.tip === 'subjuntivo-wishes')
    expect(blanks.length).toBeGreaterThan(0)
  })
```

(imports: `USAGE_TIPS` from `./clozeChecks`, `LESSON_SIZE` from `./lesson`, `pathUnits` as the file already uses.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/path.test.ts`
Expected: FAIL — `gustar` has 0 units.

- [ ] **Step 3: Implement**

Edit the 22 entries of `src/data/path.json` (indices and new points in spec §3.1; drop `rules`). In `clozeFits`:

```ts
  if (USAGE_TIPS.includes(unit.grammar as Grammar)) return cloze.tip === unit.grammar && ruleFits(unit, cloze.why)
  const found = cachedTip(`${sentence.id}#${index}`, () => {
    const tip = tipForHint(sentence, cloze)
    …unchanged…
```

- [ ] **Step 4: Run to verify**

Run: `npm run validate:data && npm test`
Expected: validator OK (no neighbouring units share a point); all unit tests PASS. If a usage unit has fewer than 10 blanks, add sentences for that point and level (back to Task 4's staging and merge), not a smaller expectation.

- [ ] **Step 5: Commit**

```bash
git add src/data/path.json src/lib/path.ts src/lib/path.test.ts
git commit -m "feat(path): the usage tips take over 22 units"
```

---

### Task 7: e2e, docs, final checks

**Files:**
- Modify: `e2e/grammar.spec.ts` (or the path spec that already opens units; pick the file that has the path helpers)
- Modify: `docs/guided-path-spec.md` (§ on grammar steps: usage units have only blanks)

- [ ] **Step 1: Write the e2e test** — open the path step URL of `b1-shopping-1` grammar (same URL helper the existing path e2e uses), skip the tip card, answer the first blank wrongly ("xxx"), open "Prečo?", expect the sheet to show the title "por alebo para" and one rule highlighted (`.ring-amber`).

- [ ] **Step 2: Run it**

Run: `E2E_PORT=5299 npx playwright test e2e/grammar.spec.ts`
Expected: PASS.

- [ ] **Step 3: Full verification**

Run: `npm run lint && npm run validate:data && npm test && npm run build && E2E_PORT=5299 npm run test:e2e -- --workers=3`
Expected: all green; e2e 100+ passed.

- [ ] **Step 4: Sample for Adam** — write ~30 sentences across the 16 points (es, sk, the blank, the hint, why) into the final message.

- [ ] **Step 5: Commit**

```bash
git add e2e docs/guided-path-spec.md
git commit -m "test(path): a por/para unit explains its blank"
```

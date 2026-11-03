# More varied blanks (part C, step 3)

Date: 2026-11-03. Branch `grammar-varied-blanks`, worktree `C:\CODE\SOMOS-varied-blanks`, based on `grammar-sentences`
(step 2, not yet merged: this step uses its `tip` field on blanks). Merge order: `grammar-sentences` first.
Follows the part B report §4, item 3: "more varied blanks (prepositions, pronouns, conjunctions)".

## 1. Why

Measured on `grammar-sentences` @ 5b7240d: 2089 blanks in 1971 sentences. 1311 are verb forms (63 %), 330 carry a
usage `tip` (step 2), 448 are other words, mostly nouns/adjectives with a Slovak hint. Prepositions, conjunctions and
pronouns as the blank: 41 + 32 + 60 = 133 (6 %). A learner who only fills verb forms never practises `a/en/de`,
`pero/sino/aunque` or `me/le/lo`, the words Slovak speakers get wrong most.

## 2. Scope (proposal, to confirm)

- Blanks on **function words** in existing sentences (second blank on a sentence, like step 2's 88 old sentences) and
  in a smaller set of new sentences where no old one fits.
- Four classes, each with a Slovak hint of the class so the task is solvable (`predložka`, `spojka`, `zámeno`, `člen`
  already exist as styles):
  1. prepositions: a (personal a, direction), en (place/time), de (origin, possession), con, desde/hasta, sin, entre
  2. conjunctions: pero / sino, porque / como, aunque, mientras, que, y→e, o→u
  3. object, reflexive and possessive pronouns not covered by the `object-pronouns` tip
  4. demonstratives and indefinites: este/ese/aquel, algo/nada, alguien/nadie, todo/cada
- Target: ~240 new blanks (60 per class), A1 15 %, A2 35 %, B1 30 %, B2 20 %.
- Never duplicate a blank step 2 already put on `por/para`, `object-pronouns`, `gustar`, `relatives`, `passive-se`.

## 3. Data and validation

No new fields. A function-word blank is a normal `cloze` with a Slovak `hint` (+ English in `hints`). Validator
additions:
- the answer of a blank hinted `predložka | spojka | zámeno | ukazovacie zámeno | neurčité zámeno` is in the closed
  word list of that class (guards against a content slip);
- `distractors` of such a blank are from the same class (a preposition is not offered against a conjunction).

## 4. Out of scope

New exercise types (step 4), the sources database (step 5), tips for these classes (the existing tips already name
them; a new tip only if a class has no rule to link).

## 5. Open questions for Adam

1. Is ~240 blanks right, or smaller first (e.g. only prepositions + conjunctions, ~120)?
2. Should these blanks open a "Prečo?" tip (needs a tip per class), or stay hint-only like `člen`?

## 6. Decisions (Adam, 2026-11-03) and result

- Size left to Claude: 227 blanks, all second blanks on existing sentences (A1 36, A2 71, B1 72, B2 48). No new sentences:
  the old ones had enough fitting candidates.
- Hint only, like `člen`: no tip per class, no `tip`/`why` fields.
- How they were chosen: a one-off script looked for a closed list of function words (prepositions, conjunctions,
  demonstratives, possessives, indefinites, subject pronouns) in sentences with at most one blank. The Slovak
  translation must contain the word the hint names, so no blank is unfair. Hints are the Slovak word (`bez`, `ale`,
  `keď`), or `predložka` for a / en / de, where Slovak has no single word.
- Distractors come from the same class, minus words that would also be correct (mientras/cuando, nada/algo).
- Not native-checked: the a / en / de blanks (their distractors are a, en, de, hasta, sin).

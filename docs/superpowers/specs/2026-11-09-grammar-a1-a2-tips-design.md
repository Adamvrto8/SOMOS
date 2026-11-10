# New A1–A2 grammar tips (roadmap §4a.5, part A2): design

Date: 2026-11-09. Status: approved in chat by Adam ("súhlas, môžeš stavať"), uncommitted until his phone test.
Background: `docs/grammar-gap-analysis.md` §3 (gaps D1, D2, P4, D4/D5, C1; action 9) and the PCIC files in
`docs/research_notes/Akademické zdroje pre španielčinu/pcic/` (`02_gramatica_inventario_a1-a2.md`). Part A1 (levels after
the PCIC, `2026-11-09-grammar-levels-design.md`) is built and uncommitted in the same checkout; this part builds on it.

## 1. Goal

The five A1–A2 basics without a tip get one each — demonstratives, possessives, interrogatives, negation, personal *a* —
with blanks that open them through "Prečo?", and with places in the guided path (Cesta). Nothing that depends on tips may
break: "Prečo?", Cesta, tests and exams, the Spain overlay, the English layer.

Out of scope: A3 (new B1–B2 tips), A4 (`variants.mx` notes from the PCIC), B (grammar screen), findmistake tasks for the
"no *a*" rules.

## 2. Adam's decisions (2026-11-09)

1. **One tip per point (5 tips)**, level = where the point's core sits. Higher-level rules inside a tip are recorded
   deviations from the PCIC (one tip one level, as before; no splitting into tiny tips).
2. **Blanks from three sources:** existing blanks on these words get `tip`/`why`; new blanks are added to existing
   sentences that hold the word; new sentences only where a point is thin. Target ≥ 20 blanks per tip at its level.
3. **Cesta: 10 units re-pointed** (2 per tip), taken from presente, ser-estar, pretérito and imperfecto.
4. **Wider than the PCIC in two places:** `negation` includes algo/alguien/algún ↔ nada/nadie/ningún (PCIC B1),
   `interrogatives` includes qué vs cuál (PCIC B1).

## 3. Tips

Every tip has what a tip has today: Slovak `title`, `intro`, rules with `title`, `text`, `because` and 1–3 examples,
`sources` (PCIC with sections + NGLE), `variants.mx` and `variants.es`, `ideas`, `related`; English in
`src/data/en/tips.json`; a Spain overlay entry in `src/data/es/tips.json` only where an example uses Mexican-only words.
Rules marked ᴬ² / ᴮ¹ sit above the tip's level (recorded deviations, §7). NGLE numbers are checked against the index on
rae.es before they are written.

| Tip (id) | Level | Rules (`why`) | Sources |
|---|---|---|---|
| `demonstratives` "este, ese, aquel" | A1 | `near` este/esta/estos/estas (by me) · `far` ese (by you), aquel (far from both) · `neutral` esto/eso/aquello for an unknown thing or idea (*¿Qué es eso?*) · `time` ᴬ² *esta tarde, este fin de semana, aquel año* · `alone` ᴬ² without a noun: *ese no, prefiero este* (no written accent) | PCIC Gramática 4 (A1–A2); NGLE ch. on demonstratives |
| `possessives` "mi, tu, su… mío, tuyo" | A1 | `short` mi/tu/su, mis/tus/sus, no gender · `nuestro` nuestro/a/os/as agrees with the thing · `su` = his/her/your (usted)/their; *de él / de ellos* for clarity · `svoj` Slovak *svoj* does not exist: the possessive follows the person (*tienes tu libro*) · `long` ᴬ² *es mío, un amigo mío, el mío* · `body` ᴬ² the article with body and clothes: *me duele la cabeza* | PCIC Gramática 5 (A1–A2); NGLE ch. on possessives |
| `interrogatives` "Otázky: qué, quién, dónde…" | A1 | `words` qué, quién/quiénes, dónde, cuándo, cómo, cuánto/a/os/as (agreement: *¿cuántas hermanas?*) · `prep` the preposition goes first: *¿De dónde eres? ¿Con quién? ¿A qué hora?* · `por-que` ¿por qué? vs porque · `cual` ᴮ¹ qué vs cuál: *¿Cuál es tu número?*, *¿Qué libro?* | PCIC Gramática 7.3, 8.8, 8.9 (A1–A2); NGLE ch. on interrogatives |
| `negation` "Zápor: no, nunca, nada, nadie" | A2 | `no` no before the verb and before its pronouns (*No lo sé*) · `double` after the verb a double negative (*No veo a nadie*), before it no *no* (*Nadie vino*, *Nunca como carne*) · `tambien` también/tampoco, *a mí también / a mí tampoco* · `pairs` ᴮ¹ algo↔nada, alguien↔nadie, algún↔ningún; *ningún* singular only | PCIC Gramática 6.1, 6.2, 8.2, 8.5 (A1–A2); NGLE ch. on negation |
| `personal-a` "a pred osobou" | A2 | `person` *Veo a María, conozco a tu hermano*, also a family pet · `thing` no *a* with things: *Veo la tele, busco un departamento* · `tener` no *a* after *tener* and *hay*: *Tengo dos hermanos* · `nadie` also before quién/alguien/nadie: *¿A quién buscas? No conozco a nadie* | PCIC Gramática 12.2.2 (A2); NGLE § on the direct object with *a* |

`variants.mx`: demonstratives — *ese* dominates in speech, *acá/allá* preferred over *aquí/allí* (PCIC 8.2, Hispanoamérica);
possessives — *la casa de nosotros* (PCIC 5 A2); interrogatives — *¿Mande?*, *¿Qué tanto?*, *¿A poco?*; negation —
*ni modo*, *para nada*, *también no* heard but *tampoco* is standard (PCIC 8.2); personal *a* — same as in Spain.
`variants.es` describe Spain the same way (*vosotros* forms are never used in examples).
`related`: `accents` (rule `questions`), `articles` (contraction *al*), `object-pronouns` (*lo vi*), `gustar` (*a mí también*).

## 4. Sentences and blanks

1. **Retag (script).** Every existing blank whose answer is one of the point's words gets `tip` + `why` and its sentence
   the tag, at the tip's level and above (a higher level repeats a lower one). Blanks below the tip's level keep no tip
   (A1 *también/tampoco*, one A1 "predložka pred osobou"). Prepositional *mí/ti* and exclamative *qué* are left out;
   doubtful cases are checked by hand.
2. **New blanks in existing sentences** holding the word: appended to `cloze` (task ids, mistakes and SRS stay valid),
   with a Slovak hint in today's style (`môj`, `tento`, `kde`, `nikto`, `predložka`), 3 distractors, and the English
   hint appended to the sentence's `hints` in `src/data/en/sentences/`. Estimate: demonstratives A1 ~18,
   possessives A1 ~10–15, interrogatives A1 ~17.
3. **New sentences** (ids from s2264), each with a blank on its point, Slovak, English, Spain overlay where needed:
   negation A2 ~20, personal-a A2 ~20, interrogatives A1 ~8 (`cual`, `por-que`), possessives A1 ~6 (`svoj`, `su`),
   demonstratives A2 ~5 (`time`, `alone`). Written by at most two Sonnet agents, each with its own tips and id range;
   the validator runs after every batch.
4. Rules `thing` and `tener` of `personal-a` have no blanks (the right answer is "nothing"); they stay explanation only.
5. **s1105** (B1) loses its `subjuntivo-aunque` tip on *cueste* and the sentence's `subjuntivo-aunque` tag; the blank stays.

## 5. Cesta (`src/data/path.json`)

| Unit | Today | New |
|---|---|---|
| A1 home/1 | ser-estar | possessives |
| A1 family/2 | ser-estar | possessives |
| A1 travel/1 | presente | demonstratives |
| A1 school/2 | ser-estar | demonstratives |
| A1 numbers/2 | presente | interrogatives |
| A1 work/1 | presente | interrogatives |
| A2 food/1 | preterito | negation |
| A2 hobbies/1 | imperfecto | negation |
| A2 greetings/2 | preterito | personal-a |
| A2 body/2 | imperfecto | personal-a |

- Each unit needs ≥ 4 of its own blanks in its topic × level × part; new blanks and sentences are aimed there and placed
  in the file so they fall into the right part.
- Rules of the units that lose ser-estar, presente, pretérito or imperfecto move into the remaining units of that point,
  so no rule leaves the path. The same point never twice in a row (validator).
- Units keep their ids (a finished unit shows as done with its new grammar; known minor from part A1).

## 6. Code

- `Grammar` (`src/data/types.ts`) and `GRAMMAR` (`scripts/validate-data.ts`): add the five tags.
- `USAGE_TIPS` (`src/lib/clozeChecks.ts`): add the five tips.
- `TAG_PRIORITY` (`src/lib/tips.ts`): `negation`, `personal-a` after `object-pronouns`; `interrogatives`, `possessives`,
  `demonstratives` before `gender`.
- No new checking logic: non-verb hints are short Slovak, as today.

## 7. Recorded deviations from the PCIC

Into `docs/grammar-gap-analysis.md` §8: A2 rules in A1 tips (`demonstratives` time/alone, `possessives` long/body);
`cual` (B1) in the A1 `interrogatives`; `pairs` (B1) in the A2 `negation`; A1 *también/tampoco* taught by an A2 tip.

## 8. Testing

- New in `clozeChecks.test.ts`: no blank names a tip above its sentence's level.
- `tips.test.ts`: a *nadie* blank opens `negation` / `double`; an *a* blank opens `personal-a` / `person`.
- `path.test.ts` (every unit has enough tasks), `localized.test.ts` (citations), `e2e/grammar.spec.ts` tip count 33 → 38.
- `npm run validate:data` after every data batch; `npm test`; `npm run build`; `E2E_PORT=5299 npm run test:e2e -- --workers=3`.
- On the phone (Adam): an A1 lesson with a possessive blank and "Prečo?", the A2 negation unit, a tip page of each tip.

## 9. Order of work

1. Code + tests. 2. Five tips (SK, EN, ES) and NGLE chapters checked. 3. Retag + new blanks in existing sentences.
4. New sentences (two Sonnet agents). 5. Cesta. 6. Deviations, full checks, Adam's phone test.

# B1–B2 grammar tips, Mexican notes and loose ends (roadmap §4a.5, parts A3 + A4): design

Date: 2026-11-10. Status: draft for Adam's review. Scope chosen by Adam: all 11 tips in one go.
Background: `docs/grammar-gap-analysis.md` §3 (the 18 "high" gaps) and §4 (American notes), the PCIC files in
`docs/research_notes/Akademické zdroje pre španielčinu/pcic/` (`02_gramatica_inventario_b1-b2.md`). Parts A1 (levels) and A2
(new A1–A2 tips) are committed (962a12c); this part builds on them.

## 1. Goal

1. **A3:** the high-priority B1–B2 gaps get a tip each (11 tips, 38 → 49), with blanks that open them through "Prečo?",
   places in the guided path (Cesta), the English layer and a Spain overlay where needed.
2. **A4:** `variants.mx` of existing tips gets the PCIC notes of gap-analysis §4 (and the unsupported claims there are checked).
3. **Loose ends:** the deferred hints of s371, s2265, s2271, s019, s836, s273, s1228.

Out of scope: B (the Grammar screen, next), medium/low gaps (they stay in the gap analysis), findmistake tasks for new tips.

## 2. Decisions (defaults; Adam corrects)

1. **One tip per point**, level = where the point's core sits. Rules above the tip's level are recorded deviations (as in A1/A2).
2. **V2 + V3 merge** into one B2 tip (*condicional compuesto* and *si hubiera… habría*), because the "pretérito perfecto de
   subjuntivo" is thin in speech and the PCIC puts all three at B2.
3. **PP1 + PP2 merge** into one B1 tip of aspect periphrases. `ir a` has its own A2 tip; `acabar de` (A2 in the PCIC) is
   taught here together with `empezar a`, `volver a`, `soler`, `dejar de`, `seguir + gerundio` — recorded deviation.
4. **Blanks from three sources** as in A2: retag existing blanks, add blanks to existing sentences, new sentences only where thin.
   Target ≥ 20 blanks per tip at its level and above.
5. **Cesta: 2 units per tip re-pointed** where the topic fits; no rule leaves the path.
6. Sonnet agents only for new sentences (at most two, own id range, `validate:data` after every batch), as in A2.

## 3. Tips

Every tip: Slovak `title`, `intro`, rules (`title`, `text`, `because`, 1–3 examples), `sources` (PCIC with sections + NGLE
checked against the index on rae.es), `variants.mx` and `variants.es`, `ideas`, `related`; English in `src/data/en/tips.json`;
a Spain overlay entry only where an example uses Mexican-only words. Rules marked ᴬ² sit below / ᴮ² above the level.

| Tip (id) | Lvl | Rules (`why`) | PCIC |
|---|---|---|---|
| `periphrases` "acabar de, volver a, soler…" | B1 | `acabar` acabar de + inf. · `empezar` empezar a / ponerse a · `volver` volver a + inf. (*otra vez*) · `soler` soler + inf. (habit) · `dejar` dejar de · `seguir` seguir + gerundio | 12.1 (A2, B1) |
| `temporal` "Časové vety: cuando, mientras, antes de que" | B1 | `inf` antes de / después de + inf. ᴬ² · `cuando` cuando + indicative (past, habit) vs subj. (future) · `mientras` mientras + indicative · `antes-que` antes de que + subj. · `desde` desde / desde hace / hasta ᴬ² | 15.3.1 (A2–B1) |
| `cause` "Príčina a dôsledok: como, así que, por eso" | B1 | `porque` porque / como (cause first) · `por-eso` por eso, entonces, así que · `ya-que` ya que, puesto que ᴮ² · `tan-que` tan… que / tanto… que ᴮ² | 15.3.4, 15.3.7 (A1–B2) |
| `reported` "Nepriama reč: dijo que…" | B1 | `que` dijo que + backshift (presente → imperfecto, pretérito → pluscuamperfecto) · `question` preguntó si / qué / dónde · `command` dijo que + subjuntivo ᴮ² · `mx` Mexico: *iba a* for the conditional | 9.1.2, 9.2.1, Tácticas 1.5.2 |
| `doubt` "quizá, tal vez, a lo mejor, capaz que" | B1 | `subj` quizá / tal vez + subj. (or indic. for more doubt) · `lo-mejor` a lo mejor + indicative only · `prob` probablemente / seguramente + indic. or subj. · `capaz` capaz que + subj. (Mexico) | 8.4, 9.2.1, 13.3 (B1–B2) |
| `verb-prep` "pensar en, darse cuenta de, contar con" | B2 | `de` hablar de, acordarse de, darse cuenta de · `en` pensar en, confiar en, tardar en · `a` empezar a, aprender a, ayudar a · `con` contar con, soñar con · `change` the preposition changes the meaning (*pensar en / pensar de*) | 12.2.5 (B1–B2) |
| `ser-estar-meaning` "ser listo / estar listo" | B2 | `listo` listo, aburrido, abierto, malo (ser vs estar) · `verde` verde, seguro, rico, vivo · `delgado` es delgado vs está delgado (permanent vs state) | 12.1 (B2), 12.2.1 |
| `cambio` "ponerse, quedarse, hacerse, volverse" | B2 | `ponerse` ponerse + adj. (temporary) · `quedarse` quedarse + adj. (result) · `hacerse` hacerse + noun / adj. (effort, profession) · `volverse` volverse loco (sudden, lasting) | 12.1, 12.2.1 (B2) |
| `conditional-perfect` "habría ido, si hubiera sabido" | B2 | `habria` condicional compuesto: habría + participio · `hubiera` pluscuamperfecto de subj.: hubiera + participio · `si` *Si lo hubiera sabido, te habría llamado* · `mx` Mexico: *hubiera* instead of *habría* in colloquial speech | 9.1.10, 9.2.3–9.2.4, 15.3.6 (B2) |
| `cond-connectors` "siempre que, a no ser que, por si" | B2 | `siempre-que` siempre que / con tal de que + subj. · `a-no-ser` a no ser que, salvo que + subj. · `por-si` por si (acaso) · `como` como + subj. (*como no vengas…*) ᴮ² | 15.3.6 (B2) |
| `relatives-mood` "Busco un libro que sea…" | B2 | `exists` known (indicative) vs unknown or hypothetical (subjunctive) · `negative` *no hay nadie que…* + subj. · `explicative` with commas indicative only · `quantity` *todo lo que* | 15.2, 9.2.1 (B2) |

Examples avoid *vosotros* and Spain words; `variants.mx` / `variants.es` per tip (Mexico first; for `doubt` *capaz que*,
for `reported` *iba a* instead of the conditional, for `conditional-perfect` *hubiera/habría*, for `cause` *como*).
`related` links the neighbour tips (`futuro`, `subjuntivo-clauses`, `si-clauses`, `condicional`, `por-para`, `ser-estar`).

## 4. Sentences and blanks

Same three steps as A2 §4: (1) retag script for existing blanks on the point's words, at the tip's level and above;
(2) new blanks appended to `cloze` of existing sentences (hint in today's style, 3 distractors, English hint in `src/data/en/sentences/`);
(3) new sentences from `s2313`, each with one blank on its point, Slovak, English, Spain overlay where needed.
Estimate: ~250 blanks in total, of which ~120 new sentences (periphrases, doubt, cond-connectors, ser-estar-meaning, cambio, relatives-mood thin).
Rules that have no right answer to type stay explanation only. Check as in A2: no blank names a tip above its sentence's level.

## 5. Cesta (`src/data/path.json`)

Per tip two units re-pointed (22 units B1/B2), taken from the units of tips with surplus (presente, preterito, subjuntivo-wishes,
si-clauses, por-para); each unit needs ≥ 4 own blanks in its topic × level × part; same point never twice in a row (validator);
units keep their ids. The mapping is proposed in the plan after the blanks exist (it depends on the topics the blanks land in).

## 6. A4: `variants.mx`

Notes from gap-analysis §4, in the order of value; each as one sentence in Slovak (+ English) in the target tip's `variants.mx`:
object-pronouns (*ándale*, *la pasamos bien*), progresivo (punctual *está viniendo*), subjuntivo-clauses (*capaz que*; the rest in `doubt`),
condicional (*iba a* in reported speech; the rest in `reported`), gender (*la sala*, *el bombillo* not Mexican — only the PCIC varieties
that concern Mexico), articles (*Vamos a la casa*), presente / imperativo (tuteo only, Chiapas voseo as a note), reflexive
(*desayunarse*, *amanecerse*), hay-estar ("do not imitate" *habían cajas*), negation (*más nada*), futuro (`haber de`, `ir y` not needed).
Also: check the three unsupported claims (`el radio`, `el sartén`, `la María`) in the RAE (DLE / NGLE) through Chrome; wrong ones are fixed or removed.

## 7. Loose ends

Hints (and, where the hint alone decides, the distractors): s371, s2265 (*nadie / nada*), s2271 (*no / nunca*), s019 (*Qué / Cuál*),
s836, s273 (hint wording), s1228 ("tu jefa" = *mamu*). Done in one small step before A3.

## 8. Code

`Grammar` (`src/data/types.ts`), `GRAMMAR` (`scripts/validate-data.ts`): add 11 tags. `USAGE_TIPS` (`src/lib/clozeChecks.ts`):
the tips with `tip` + `why` blanks. `TAG_PRIORITY` (`src/lib/tips.ts`): the new tags beside their neighbours. No new checking logic.

## 9. Recorded deviations from the PCIC (to gap-analysis §9)

`acabar de` (A2) inside the B1 `periphrases`; `desde / antes de + inf.` (A2) inside `temporal`; `ya que`, `tan… que` (B2) inside `cause`;
`dijo que + subjuntivo` (B2) inside `reported`; `como + subj.` and `ser-estar-meaning` pairs beyond the PCIC list.

## 10. Testing

`validate:data` + `validate:es` after every batch; `npm test` (new `clozeChecks` case: no tip above a sentence's level;
`tips.test.ts`: *dijo que* blank opens `reported` / `que`, *quizá* opens `doubt` / `subj`; `path.test.ts`; `localized.test.ts`
citations); `npm run build`; `E2E_PORT=5299 npm run test:e2e -- --workers=3` (grammar spec tip count 38 → 49).
On the phone (Adam): a B1 lesson with a `reported` blank and "Prečo?", a B2 `cambio` unit, a tip page of each tip.

## 11. Order of work

0. Loose ends (§7). 1. A4 `variants.mx` (§6, with the RAE check). 2. Code + tests (§8). 3. Eleven tips (SK, EN, ES) with NGLE checked.
4. Retag + blanks in existing sentences. 5. New sentences (≤ 2 Sonnet agents). 6. Cesta. 7. Deviations, full checks, phone test.

## 12. Changes made while building (2026-11-10)

- `verb-prep` is **B2**, not B1: the B1 level has only 11 non-usage path units to give away (the other four keep the only unit of subjuntivo, condicional, pluscuamperfecto and futuro), enough for five tips with two units each. PCIC 12.2.5 covers B1–B2.
- Cesta: 22 units re-pointed; the B1 imperativo units are gone (A2 keeps imperativo); B1/B2 tense-unit counts in path.test.ts are 3 each.
- NGLE: the rae.es index could not be read in this session, so only chapter numbers known from part A1 are cited; the others name the chapter topic.

# SOMOS grammar vs. PCIC: gap analysis

Date: 2026-11-09. Working doc for the developer; nothing under `src/` or `scripts/` was changed.

**Compared:** the 29 tips in `src/data/tips.json` (+ sentence counts per grammar tag and level in `grammar_by_level.txt`)
against the Plan curricular del Instituto Cervantes (PCIC), *Gramática* inventory A1-A2 and B1-B2
(`docs/research_notes/.../pcic/02_gramatica_inventario_*.md`), plus *Funciones*, *Ortografía* and *Tácticas* where a tip's point lives there.

**Conventions.** "Gramática 9.2.1 (B1)" = section number + level column exactly as in the Markdown. Every number below was seen in those files.
Short quotes only (copyright); everything else is paraphrase. Level of the app's tip = `level` field of the tip.

**Facts re-verified in the text** (all confirmed):
- 9.1.4 Futuro imperfecto and 9.1.5 Condicional simple are empty headings (`[]`) at A2 and have content from B1 (and B2).
- Periphrases `ir a`, `acabar de`, `empezar a`, `volver a`, `estar + gerundio`, `tener que`, `hay que`, `poder`: Gramática 12.1 (A2). Further periphrases (soler, dejar de, ponerse a, estar a punto de, seguir + gerundio): 12.1 (B1).
- Subjunctive: no 9.2 section at A1-A2 (`## 9.2. []`); presente 9.2.1 (B1); imperfecto 9.2.2 (B2); perfecto 9.2.3 and pluscuamperfecto 9.2.4 (B2).
- Imperativo 9.3: empty at A1, affirmative at A2, negative + combined clitics at B1.
- Two extra facts: (a) PCIC has **no chapter on prepositions** (the Introducción says they are treated lexically), so a source like "Gramática A2-B2" for por/para cannot point to one section; (b) `cuyo` does not occur anywhere in the Gramática inventory.

Sentence counts used below come from `grammar_by_level.txt` (tag = the sentence's `grammar` array; it has no tag for `perfecto`, `reflexive`, `accents`, `adjectives`).
I also ran two read-only checks on `src/data/sentences/*.json`: all 37 A2 sentences tagged `futuro` are synthetic `-ré` forms (none uses `ir a`); and 0 of the 2167 sentences contain a `he/has/ha/hemos/han + participle` perfect.

---

## 1. Tip-by-tip mapping

Verdicts: **OK** (level and citation fine; "rule note" = a few rules of the tip sit at another PCIC level, see section 2), **level mismatch**, **partly covered**, **citation imprecise** (range/level in `sources` is wrong or unverifiable; all tips lack section numbers, the `where` column proposes them).
Proposed `where` is the exact string for the `pcic` source; sections separated by `;`.

| # | Tip id | Tip lvl | PCIC sections covering it | Verdict | Proposed `where` for the pcic source |
|---|---|---|---|---|---|
| 1 | ser-estar | A1 | 12.1 A1 (ser/estar without adjective), 12.2.1 A1, 9.4.3 A1; 12.1 A2 (ser/estar + adjective, causa, finalidad), 9.4.3 A2; 12.1 B1 (es de noche); 12.1 B2 (events: "La cita es en el cine", adjectives with change of meaning) | partly covered (rule `event` = B2, `result` and `progressive` = A2; change-of-meaning pairs and verbos de cambio only in `ideas`, not rules) | `Gramática 12.1 (A1-A2); 9.4.3 (A1-A2); 12.1 (B2)` |
| 2 | presente | A1 | 9.1.1 A1 (regular paradigm; ser, estar, haber, ir), 9.1.1 A2 (frequent vocalic/consonantal irregularities; saber, dar; habitual; future value), 9.1.1 B1 (systematisation) | OK (rule note: `stem`, `yo`, future use = A2) | `Gramática 9.1.1 (A1-A2)` |
| 3 | preterito | A2 | 9.1.3 A2 (regular; root irregularity tener/hacer/estar; ser, ir; ver, dar); 9.1.3 B1 (vestir/dormir/leer, huir/apagar, strong perfects traer/decir/poner) | OK (rule note: `third`, `spelling`, part of `stems` = B1) | `Gramática 9.1.3 (A2-B1)` |
| 4 | imperfecto | A2 | 9.1.2 A2 (regular; ser, ir, ver; descriptive, habitual); 9.1.2 B1-B2 (other values) | OK | `Gramática 9.1.2 (A2)` |
| 5 | preterito-imperfecto | A2 | 9.1.3 A2 + 9.1.2 A2 (separate values); 9.1.2 B1 (action interrupted by another verb); 15.3.1 B1 (cuando + imperfecto, simultaneity) | OK (rule note: `together` = B1) | `Gramática 9.1.2 (A2-B1); 9.1.3 (A2); 15.3.1 (B1)` |
| 6 | futuro | A2 | 9.1.4 B1 (forms, irregular stems, probability); 9.1.4 B2; 12.1 A2 (`ir a`); 9.1.1 A2 (presente with future value) | **level mismatch** (synthetic futuro is B1; `ir a` and presente-for-future are A2) | `Gramática 9.1.4 (B1); 12.1 (A2); 9.1.1 (A2)` |
| 7 | progresivo | A2 | 9.4.2 A2 (gerundio forms, enclitics), 12.1 A2 (`estar + gerundio`) | citation imprecise ("A1-A2": no gerundio content at A1) + sentence mismatch (22 A1 sentences) | `Gramática 9.4.2 (A2); 12.1 (A2)` |
| 8 | gender | A1 | 1.2 A1 (-o/-a, vowel/consonant, la moto/foto, heteronyms); 1.2 A2 (-ma, el día, la mano, -dor/-tor, -esa/-triz/-ina); 1.2 B2 (-dad, -ción, -sión, -tud, -umbre; el + tonic a); 3.1 A2 (el aula) | OK (rule note: `feminine`, `masculine`, `exceptions`, `a-tonica` are A2-B2) | `Gramática 1.2 (A1-A2); 3.1 (A2); 1.2 (B2)` |
| 9 | articles | A1 | 3.1 A1 (forms, al/del, absent with names), 3.2 A1, 3.3 A1; 3.1 A2 (generic, deictic, with leisure activities), 3.2 A2 (profession without article) | OK | `Gramática 3.1 (A1-A2); 3.2 (A1-A2); 3.3 (A1)` |
| 10 | adjectives | A1 | 2.1 A1, 2.2 A1, 2.3 A1, 2.4 A1 (postnominal); 2.2 A2 (-e adjectives, -dor); 2.4 B1 (apócope buen/mal/gran) | OK (rule note: apocope in `position` = B1) | `Gramática 2.1 (A1); 2.2 (A1-A2); 2.3 (A1); 2.4 (A1-B1)` |
| 11 | reflexive | A1 | 7.1.4 A1 (reflexive pronoun); 13.3 A2 (reflexive sentences); 7.1.2 A2 (clitic position with periphrases); 7.1.4 B1 (reciprocal) | OK (rule note: `position` = A2) | `Gramática 7.1.4 (A1); 13.3 (A2); 7.1.2 (A2)` |
| 12 | accents | A1 | Ortografía 2.2 A1 (qué/que, él/el, té/te, sé/se, tú/tu), 2.2 A2 (mí/mi, sí/si), 2.2 B1 (cuándo/cuando, dónde/donde, cómo/como, dé/de), 2.1 B1 (numero/numeró type) | citation imprecise (pairs `mas/más`, `esta/está`, `papa/papá` are not in the PCIC lists; `hablo/habló` is the 2.1 B1 type) | `Ortografía 2.2 (A1-A2); 2.2 (B1); 2.1 (B1)` |
| 13 | imperativo | A2 | 9.3 A2 (affirmative tú/usted/ustedes, irregular di/haz/pon/sal, enclitics); 9.3 B1 (negative = present subjunctive, `díselo`, request/advice values); 7.1.2 A2, 7.1.5 B1 | OK (rule note: `negative` and combined pronouns `dímelo` = B1; source already splits A2/B1) | `Gramática 9.3 (A2); 9.3 (B1); 7.1.5 (B1)` |
| 14 | subjuntivo | B1 | 9.2.1 B1 (regular, inherited irregularities, estar/ser/dar/ir; uses); 9.2.1 B2 (more uses) | OK | `Gramática 9.2.1 (B1)` |
| 15 | condicional | B1 | 9.1.5 B1 (forms, politeness, modesty, suggestion deber/poder); 9.1.5 B2 (hypothesis, probability in past, `dijo que vendría`); Funciones 3.8 A2 (`me gustaría + inf.`), 3.7 A2, 4.13 B1, 4.18 B1 (`Yo que tú`) | citation imprecise (9.1.5 is **empty at A2**; hypothesis is B2, not B1) | `Gramática 9.1.5 (B1); 9.1.5 (B2); Funciones 3.8 (A2); 4.18 (B1)` |
| 16 | perfecto | A2 | 9.1.6 A2 (haber + participle; hecho/escrito/visto; hoy, este año, ya, todavía no); 9.1.6 B1 (nunca he estado vs nunca estuve; hace que); 9.4.3 A2 | OK | `Gramática 9.1.6 (A2); 9.4.3 (A2)` |
| 17 | pluscuamperfecto | B1 | 9.1.8 B1 (anteriority); 9.1.8 B2 (interrupted plan `Había pensado ir`) | OK | `Gramática 9.1.8 (B1)` |
| 18 | subj-imperfecto | B2 | 9.2.2 B2 (-ra/-se forms, irregularities, wishes, `ojalá`, reported requests); 15.3.6 B2 | OK | `Gramática 9.2.2 (B2); 15.3.6 (B2)` |
| 19 | gustar | A1 | 12.1 A1 (`gustar`), 7.1.3 A1, 12.2.3 A1, 15.1.1 A1, 3.1 A1; 12.1 A2 (`encantar`, `doler`), 7.1.3 A2 (`interesar`, `encantar`), 7.1.6 A2 (`A mí me gusta`); Funciones 3.2 A1-A2 | OK (rule note: `encantar`, `doler`, `interesar` = A2; `importar`, `molestar` not listed in PCIC) | `Gramática 12.1 (A1-A2); 7.1.3 (A1-A2); 7.1.6 (A2); Funciones 3.2 (A1)` |
| 20 | hay-estar | A1 | 3.1 A1 (haber incompatible with the, estar compatible), 3.3 A1 (bare nouns with haber), 13.3 A1 (impersonal haber), 7.1.2 A1 | OK | `Gramática 3.1 (A1); 3.3 (A1); 13.3 (A1)` |
| 21 | object-pronouns | A2 | 7.1.2 A2, 7.1.3 A2 (incl. le/les -> se before lo/la), 12.2.2 A2, 12.2.3 A2; 7.1.5 B1 (combination of clitics) | citation imprecise ("A1-B1": A1 has only `me gusta`/absence with hay; `se lo` is already A2 in 7.1.3, systematised B1 in 7.1.5) | `Gramática 7.1.2 (A2); 7.1.3 (A2); 12.2.2 (A2); 7.1.5 (B1)` |
| 22 | comparisons | A2 | 2.5 A2, 6.1 A2, 15.3.8 A2 (más/menos que, tan/tanto como, mejor/peor/mayor/menor); 2.5 B1 (-ísimo, el más...de, igual de), 15.3.8 B1 | citation imprecise (A1 has only `muy + adj`; superlative rule = B1) | `Gramática 2.5 (A2); 6.1 (A2); 15.3.8 (A2); 2.5 (B1)` |
| 23 | obligation | A2 | 12.1 A2 (tener que, hay que, poder); Funciones 4.18 A2 (tienes que, hay que, puedes); 9.1.5 B1 + Funciones 4.18 B1 (debes/deberías, podrías); 12.1 B2 (deber de) | OK (rule note: plain `deber` and `podría` = B1) | `Gramática 12.1 (A2); 9.1.5 (B1); Funciones 4.18 (A2)` |
| 24 | subjuntivo-wishes | B1 | 9.2.1 B1, 15.1.2 B1 (desiderativos, emotion), 15.1.1 B1, 13.3 B1 (`¡Ojalá venga!`); Funciones 3.22 B1 (esperanza) | OK | `Gramática 9.2.1 (B1); 15.1.2 (B1); 13.3 (B1)` |
| 25 | si-clauses | B1 | 15.3.6 A2 (si + presente, presente), 15.3.6 B1 (apódosis futuro/imperativo; no future after si), 9.1.1 B1; 15.3.6 B2 (irreal, imperfecto de subjuntivo) | level mismatch (partial): `real` rule is A2 in PCIC; `unreal` is B2 | `Gramática 15.3.6 (A2-B2); 9.1.1 (B1)` |
| 26 | por-para | B1 | no prepositions chapter. Nearest: 15.3.5 A1-A2 (`para + inf.`), 12.1 A2 (`es por tu culpa`, `es para escribir`), 15.3.4 A2 (`por` + noun = cause), 15.3.5 B1 (por/para contrast), 15.3.4 B1 (`por + inf.`), 9.2.1 B1 (`para que`) | citation imprecise (rule `para` + inf. and `por` = cause are A1-A2; contrast is B1) | `Gramática 15.3.5 (A1-B1); 15.3.4 (A2-B1); 12.1 (A2)` |
| 27 | subjuntivo-clauses | B2 | 9.2.1 B1 (cuando + subj., para que, antes de que), 15.1.2 B1 (`No creo que tengas razón`), 15.3.1 B1, 15.3.5 B1; 9.2.1 B2 (no creo que, hasta que, aunque), 15.3.9 B2 (aunque + subj.) | **level mismatch** (half of the rules are B1) | `Gramática 9.2.1 (B1-B2); 15.1.2 (B1); 15.3.1 (B1-B2); 15.3.5 (B1); 15.3.9 (B2)` |
| 28 | relatives | B2 | 7.2 A1 + 15.2 A1 (`que`), 7.2 B1 (que/quien), 8.8 B1 (`donde`); 7.2 B2, 15.2 B2 (el que/la que/lo que with preposition, quien, explicativas) | **level mismatch** (`que`, `donde` are A1/B1; `cuyo` is not in PCIC) | `Gramática 7.2 (A1-B2); 15.2 (A1-B2); 8.8 (B1)` |
| 29 | passive-se | B2 | 7.1.4 B1 + 13.3 B1 (pasiva refleja, impersonal `se`: "Se venden pisos"); 12.1 B2, 13.3 B2, 9.4.3 B2 (pasiva perifrástica `ser + participio`); 12.2.1 A2 + 9.4.3 A2 (`estar + participio`) | **level mismatch** (the `se` rules are B1; only ser-passive is B2) | `Gramática 7.1.4 (B1); 13.3 (B1-B2); 12.1 (B2); 9.4.3 (A2-B2)` |

---

## 2. Level mismatches

Format per item: PCIC evidence, app sentence counts (A1/A2/B1/B2 from `grammar_by_level.txt`), options. **No decision is taken here.**
Options: **(a)** move the tip level, **(b)** split the tip, **(c)** retag sentences, **(d)** keep and record a deliberate deviation.

### 2.1 Tip-level mismatches

| # | Tip | App level | PCIC evidence | App sentences | Options |
|---|---|---|---|---|---|
| M1 | futuro | A2 | 9.1.4 is empty at A2; B1 has the forms and "Acciones futuras absolutas". The A2 route is `ir a` (12.1 A2) and presente with future value (9.1.1 A2: "Mañana voy al cine") | futuro 0/**37**/27/11; all 37 A2 ones are `-ré` forms | (a) tip to B1, drop A2 sentences into B1; (b) split: "ir a + infinitivo" (A2, rule `ir-a` plus the presente `use` rule) and "futuro -ré" (B1); (c) retag/replace the 37 A2 sentences with `ir a` ones; (d) keep (the Mexican norm is `ir a`; the A2 `-ré` stays) |
| M2 | subjuntivo-clauses | B2 | `cuando` + subj., `para que`, `antes de que` and `No creo que tengas razón` are B1 (9.2.1, 15.3.1, 15.3.5, 15.1.2); `aunque` + subj., `hasta que`/`en cuanto`/`apenas` are B2 (9.2.1, 15.3.9, 15.3.1). PCIC itself is inconsistent: 15.1.2 B1 vs 9.2.1 B2 for "no creo que" | subjuntivo-clauses 0/0/**2**/95 | (b) split into B1 "cuando / para que / no creo que" and B2 "aunque / en cuanto / hasta que"; (c) retag about 20 sentences to B1; (d) keep |
| M3 | relatives | B2 | `que` is A1 (7.2, 15.2) and `donde` B1 (8.8); B2 is `el que`+preposition, `quien`, explicativas (7.2, 15.2). `cuyo` is outside PCIC | relatives 0/0/**1**/79 | (b) split "que, donde" (A1/B1) from "el que, quien, lo que, cuyo" (B2); (a) tip to B1 and keep the B2 rules inside; (c) add A1-B1 `que` sentences |
| M4 | passive-se | B2 | pasiva refleja and impersonal `se` are B1 (7.1.4, 13.3); `ser + participio` is B2 (12.1, 13.3) | passive-se **1**/0/0/25 (the one A1 sentence looks like an outlier) | (b) split "se" (B1) from "ser + participio" (B2); (c) move 1 A1 sentence and some B2 `se` sentences to B1; (d) keep |
| M5 | si-clauses | B1 | `Si quieres...puedes comprar` (present/present) is A2 (15.3.6); future/imperative apodosis B1; irreal (imperfecto de subjuntivo) B2 | si-clauses 0/0/18/39 | (b) split real (A2/B1) from irreal (B2); (c) retag/add A2 present-present sentences; (d) keep |

### 2.2 Sentence-level mismatches (tip level is right)

| # | Tag | PCIC evidence | App sentences | Options |
|---|---|---|---|---|
| M6 | progresivo (tip A2) | gerundio first appears at A2 (9.4.2 A2; 12.1 A2: "estar + gerundio"); A1 has an empty 9.4.2 | progresivo **22**/18/11/10 | (c) retag the 22 A1 sentences to A2; (a) tip to A1 (would contradict PCIC); (d) keep, because `estoy comiendo` is early survival language (record as deliberate). Related: `ser-estar` rule `progressive` is shown at A1 |
| M7 | presente (tip A1) | A1 only has the regular paradigm + ser/estar/haber/ir; stem changes and yo-irregulars are A2 (9.1.1 A2: "Irregularidades vocálicas y consonánticas más frecuentes") | presente **297**/120/212/210 | (d) keep (PCIC's own A1 examples use `tengo`, 12.2.2 A1); (b) split regular vs irregular presente |
| M8 | preterito (tip A2) | A2 roots: tener, hacer, estar, ser/ir, ver/dar. B1 (9.1.3): vestir/dormir/leer, huir/apagar, strong perfects traer/decir/poner | preterito 1/179/**151**/154 | (d) keep; (c) retag the sentences by verb; (b) move `third`/`spelling` rules to a B1 tip |
| M9 | preterito-imperfecto (tip A2) | the combined use (action interrupted by another verb) is 9.1.2 B1; the A2 level has each tense apart | no own tag | (d) keep; (a) tip to B1 |
| M10 | comparisons (tip A2) | `muy + adj` is A1 (2.5); más/menos que, tan...como, mejor/peor A2; `-ísimo`, `el más...de` B1 (2.5, 15.3.8) | comparisons 0/22/8/6 | (b) move the `superlative` rule to B1; (d) keep |
| M11 | gender (tip A1) | A1: -o/-a, consonants, la foto; A2: -ma, el día, la mano, -dor, -esa; B2: -dad/-ción/-umbre, el agua (1.2) | gender **39**/15/0/1 | (d) keep (pedagogically sensible for Slovak learners); (c) none needed |
| M12 | imperativo (tip A2) | negative imperative and `díselo`-type clitics are B1 (9.3 B1) | imperativo 0/**7**/18/12 | (c) A2 has only 7 sentences: add affirmative A2 ones; (d) keep the mixed tip |
| M13 | gustar (tip A1) | `encantar`, `doler`, `interesar` are A2 (12.1, 7.1.3) | gustar 28/3/1/3 | (d) keep; (b) split "gustar" (A1) / "encantar, doler" (A2) |
| M14 | obligation (tip A2) | `deber` and `podría` are B1 (Funciones 4.18 B1; 9.1.5 B1); Gramática 12.1 A2 lists tener que, hay que, poder only | obligation 0/21/7/4 | (d) keep; (b) move `deber` to the condicional tip |
| M15 | adjectives (tip A1), reflexive (tip A1), ser-estar (tip A1) | apocope `buen/mal` B1 (2.4); clitic position with infinitive/gerund A2 (7.1.2); `event` rule (La fiesta es en...) B2 (12.1), `result` A2 | n/a (no per-rule tags) | (d) keep all three; note in `sources.where` |
| M16 | por-para (tip B1) | `para + infinitivo` is A1 (15.3.5), `por` = cause A2 (15.3.4, 12.1); only the por/para **contrast** is B1 (15.3.5 B1) | por-para 0/**0**/27/9 | (b) split a basic "para + infinitivo" tip (A1/A2) from the B1 contrast; (c) add A2 sentences; (d) keep |
| M17 | perfecto (tip A2) | 9.1.6 is A2 | no sentence has `he + participio` (checked); no tag | (d) deliberate if the Mexican base prefers pretérito (the Spain overlay may carry them); otherwise add A2 sentences |

---

## 3. PCIC points A1-B2 with no tip (the gaps)

"Existing sentences": **yes** = practised incidentally in many sentences (my regex count, indicative only); **partly** = a few; **no** = about none. Counts are matches over all 2167 sentences (A1/A2/B1/B2).

### 3.1 Nouns, adjectives, determiners, quantifiers

| ID | PCIC | Gap | Priority | Existing sentences |
|---|---|---|---|---|
| N1 | Gramática 1.3 (A1-A2) | plural of nouns (-s/-es, país/países, el lunes/los lunes, las gafas) | medium | yes (incidental); only the adjective plural has a rule |
| N2 | Gramática 2.6 (A1-A2); 3.1 (B2) | nominalisation: `el grande`, `lo interesante`, `lo mejor`, `lo de ayer` | low | no (0 with `lo + adj`) |
| N3 | Gramática 2.4 (B2) | adjective position with change of meaning (`un viejo amigo`, `un único profesor`) | low | no |
| D1 | Gramática 4 (A1-B2) | demonstratives este/ese/aquel, esto/eso, temporal and anaphoric uses | **high** | yes (141: 23/28/36/54) |
| D2 | Gramática 5 (A1-B2) | possessives: átonos mi/tu/su/nuestro (A1), tónicos mío/tuyo and `el mío` (A2), `un amigo mío` (B1); `el libro tuyo` in Hispanoamérica (A2) | **high** | átonos yes (495); tónicos no (1) |
| D3 | Gramática 6.1 (A1-B2) | numerals: cardinals and ordinals (A1), primer/tercer (A2), ordinals from 11th (B1), partitives/multiples (B2) | medium | probably via the "Čísla" topic |
| D4 | Gramática 6.1 (A1-B2) | indefinite quantifiers: poco/mucho/bastante (A1), todo, otro, demasiado (A2), algo/alguien/alguno, nada/nadie/ninguno, cada (B1), cualquier(a) (B2) | **high** | partly (todo 123; alguien/algo 15; ninguno few) |
| D5 | Gramática 6.2, 8.2, 8.5 (A1-A2); 6.1, 8.2 (B1) | también/tampoco (A1), nunca / `no...nada/nadie` double negation (A2), `nunca más` (B1) | **high** | partly (negatives 55: 2/7/9/37; thin at A1-A2) |
| D6 | Gramática 3.1, 3.2, 3.3 (A2) | article uses beyond articles tip: generic value, obligatory with leisure activities (`Juego al tenis`), `todos los`, indefinite as attribute | medium | partly |
| D7 | Gramática 6.3 (B1) | partitive structures: `la mayoría de`, `un montón de` | low | no |

### 3.2 Pronouns and adverbs

| ID | PCIC | Gap | Priority | Existing sentences |
|---|---|---|---|---|
| P1 | Gramática 7.1.1 (A1-A2) | subject pronoun: omission vs presence for contrast/ambiguity, ustedes | medium | partly (presente intro) |
| P2 | Gramática 7.1.6 (A2); 7.1.6 (B1) | prepositional pronouns: conmigo/contigo, `a mí me gusta`, `según tú`, `entre tú y yo` | medium | partly (11; `a mí` 1) |
| P3 | Gramática 7.1.4 (B1-B2) | `se` values: reciprocal (`se quieren`), voz media, mitigating `se me perdió` (very common in Mexican speech) | medium | partly |
| P4 | Gramática 7.3 (A1-B2) | interrogatives: qué/quién/cuánto/dónde/cómo/cuándo (A1-A2), cuál vs qué and preposition + interrogative, `adónde` (B1), `¿Quién de...?` (B2) | **high** | yes (incidental); the accents tip only covers the written accent |
| P5 | Gramática 7.4 (A2-B2) | exclamatives `¡Qué bonito!`, `¡Cómo canta!`, `¡Cuánto sabe!` | low | partly (4) |
| P6 | Gramática 7.1.2 (B2) | neutral `lo` replacing an attribute (`Lo soy`, `Lo está`) | low | no |
| A1 | Gramática 8.2 (A1-B1) | core adverbs: muy vs mucho, bien/mal, aquí/ahí/allí (acá/allá), ahora/hoy, ya/todavía, `lejos/cerca` | medium | yes (muy/mucho 167; ya/todavía 68) |
| A2 | Gramática 8.1 (A2-B2) | adverbs in `-mente` (basic rule A2; restrictions B1-B2) | medium | partly |
| A3 | Gramática 8.4 (B1-B2); 9.2.1 (B1); 13.3 (B1-B2) | doubt adverbs `quizá / tal vez / probablemente / seguramente` with indicative or subjunctive; `a lo mejor` + indicative; `capaz que` (Mexico) | **high** | partly (inside subjuntivo sentences) |
| A4 | Gramática 8.9, 15.3.4 (A1) | `por qué` vs `porque` | medium | partly (porque 59) |

### 3.3 Verb forms, periphrases, ser/estar extensions, simple sentence

| ID | PCIC | Gap | Priority | Existing sentences |
|---|---|---|---|---|
| V1 | Gramática 9.1.9 (B2) | futuro perfecto (`habrá terminado`) incl. probability in the past | medium | no (1) |
| V2 | Gramática 9.1.10 (B2) | condicional compuesto (`habría ido`) | **high** | partly (5 together with V3) |
| V3 | Gramática 9.2.3, 9.2.4, 15.3.6 (B2) | pretérito perfecto and pluscuamperfecto de subjuntivo; `Si lo hubiera sabido, te habría llamado` | **high** | partly (5) |
| V4 | Gramática 9.1.2 (B1); 9.2.1 (B1); 9.1.5 (B2); Tácticas 1.5.2 (B1-B2) | indirect speech: `Dijo que tenía sueño`, backshift, questions with `si`, `Le dijo que tuviera cuidado` | **high** | yes (35: 0/2/8/25) |
| V5 | Gramática 9.1.2 (B1-B2) | other imperfecto values: `iba a salir cuando...`, courtesy `quería`, `pensaba ir (pero...)` | medium | partly |
| V6 | Gramática 9.4.2 (B1-B2) | gerundio beyond `estar +`: manner (`aprende leyendo`), `seguir + gerundio`, temporal/predicative | medium | partly (5) |
| V7 | Gramática 9.4.1 (B1-B2) | infinitive uses: indirect question (`no sé qué hacer`), infinitivo compuesto, signs (`No fumar`) | low | no |
| V8 | Gramática 9.1.1 (B1-B2) | presente gnómico, presente histórico/de instruction | low | no |
| V9 | Gramática 9.3 (B1-B2) | lexicalised imperatives (`anda`, `venga`, `oye`), emphatic repetition | low | no |
| PP1 | Gramática 12.1 (A2) | aspect periphrases: `ir a`, `acabar de`, `empezar a`, `volver a` (+ pronoun position `Lo voy a hacer`) | **high** | partly (`ir a` only inside futuro; acabar de 3, volver a 2, empezar a 11) |
| PP2 | Gramática 12.1 (B1-B2) | `soler`, `dejar de`, `ponerse a`, `estar a punto de`, `seguir + gerundio`, `deber de` | medium | no for soler (0); dejar de 9 |
| S1 | Gramática 12.1 (B2); 12.1 (A2) | ser/estar + adjective with change of meaning (`listo`, `verde`, `es/está delgado`) | **high** | partly (tip `ideas` only) |
| S2 | Gramática 12.1 (B2); 12.2.1 (B2) | verbos de cambio `ponerse, quedarse, hacerse, volverse` | **high** | partly (14: 0/2/4/8) |
| S3 | Gramática 12.1 (B1) | `parecer` (attribute, `parece que`), `estar de + profesión`, `es una pena que`, `es de noche` | medium | partly |
| S4 | Gramática 12.1 (A2) | `ser` + cause (`por`), + purpose (`para`); `estar a` + date/temperature (`estamos a tres grados`) | low | no |
| C1 | Gramática 12.2.2 (A2) | personal `a` before a direct object (`Vi a Almudena`) | **high** | probably yes (incidental), no rule |
| C2 | Gramática 12.2.5 (B1-B2) | verbs with prepositional complement: `hablar de`, `pensar en`, `decidirse a`, `darse cuenta de`, `contar con` | **high** | partly |
| C3 | Gramática 13.3 (A2-B1) | impersonal weather and `hacer` (`Hace frío`, `Llueve`), `haber` in other tenses | medium | partly |
| C4 | Gramática 13.2 (B1-B2) | subject postposition (`Ha llegado una carta`, `Se venden pisos`) | low | partly |
| C5 | Gramática 13.3 (A2) | question/exclamation/exhortative sentence types, `¿té o café?` | low | yes |

### 3.4 Coordination and subordination

| ID | PCIC | Gap | Priority | Existing sentences |
|---|---|---|---|---|
| CO1 | Gramática 14.1-14.3 (A1-B2) | `y/e`, `o/u`, `ni`, `pero` (A1-A2); `sin embargo`, `aunque`-adversative (B1); `sino`, `no obstante` (B2) | medium | partly (ni 18; sino 1) |
| SU1 | Gramática 15.3.1 (A2-B2) | temporal clauses: `antes de/después de + inf.`, `desde/hasta/desde hace` (A2); `mientras`, `al + inf.`, `antes de que` (B1); `en cuanto`, `apenas`, `nada más + inf.`, `una vez que` (B2) | **high** | yes (cuando 111; mientras 25; en cuanto/apenas/hasta que 24) |
| SU2 | Gramática 15.3.4, 15.3.7 (A1-B2) | cause and consequence: `porque` (A1), `por eso`, `entonces` (A2), `como`, `así que`, `o sea que` (B1), `ya que`, `tan...que`, `por lo tanto`, `de modo que` (B2) | **high** | yes (porque 59; así que/por eso 24; tan...que 6) |
| SU3 | Gramática 15.3.9 (B1-B2) | concessive clauses beyond `aunque`: `a pesar de (que)`, `por más que`, `tanto si...como si`, `y eso que` | medium | partly (aunque 31) |
| SU4 | Gramática 15.3.6 (B2) | conditional connectors: `siempre que`, `con tal de que`, `a no ser que`, `salvo que`, `por si (acaso)` | **high** | no (4) |
| SU5 | Gramática 15.2 (B2); 9.2.1 (B2) | relative clauses with indicative vs subjunctive (`Busco un libro que sea divertido`), explicativas with commas | **high** | partly (inside relatives sentences) |
| SU6 | Gramática 15.3.2, 15.3.3, 8.8 (B1-B2) | `donde`, `como`, `según` + indicative or subjunctive (`Lo haré como digas`, `Voy donde digas`) | medium | partly |
| SU7 | Gramática 15.3.8 (B1-B2) | comparatives beyond the A2 set: `igual de...que`, `más de/no más de + cantidad`, `lo mismo que`, `el doble de` | medium | no |
| SU8 | Gramática 15.1.1 (A2-B2) | infinitive complements and influence verbs (`aprender a`, `aconsejar/permitir/prohibir + inf.`, `Me invitó a cenar`) | medium | partly |

Counts: **18 high, 19 medium, 11 low** (48 gaps).

---

## 4. American / Mexican notes in the PCIC grammar (A1-B2)

Source of every row: `02_gramatica_inventario_a1-a2.md` / `_b1-b2.md`. "Mexico?" = whether the note concerns Mexico (explicitly "México" or all "Hispanoamérica").
"In mx?" = whether the target tip's `variants.mx` already says it (checked against the text). `-` = no fitting tip exists (see gap id).

| # | Section (level) | PCIC note (paraphrase) | Mexico? | Target tip | In `variants.mx`? |
|---|---|---|---|---|---|
| 1 | 1.1.1 (A1) | nicknames Chayo, Chava, Güicho, Pancho | yes | - (names/vocabulary) | no, not needed |
| 2 | 1.1.1 (A1) | don/doña + name in Ecuador, Colombia; `su merced` in Dominican Rep. | no | - | n/a |
| 3 | 5 (A2) | postposed possessives (`el libro tuyo`, `la escuela de nosotros`) | yes | - (gap D2) | no |
| 4 | 7.1.1 (A1) | Mexico (except Chiapas) uses tuteo only; ustedes for plural, no vosotros; tendency to explicit subject pronouns (`Yo estudio español`) | yes | presente | ustedes yes; tuteo-only/Chiapas and explicit subject tendency no |
| 5 | 7.1.2 (A2) | `la pasamos bien` (Hispanoamérica) vs `lo pasamos bien` (Spain) | yes | object-pronouns | no |
| 6 | 7.1.3 (A2), 7.1.6 (A2) | voseo with `te`, forms `vos` after preposition | partly (Chiapas) | imperativo / presente | no |
| 7 | 7.1.4 (A1) | tendency to reflexive forms (`desayunarse`, `tardarse`, `amanecerse`, `robarse`) | yes | reflexive | partly (`tardarse` yes; `regresarse` is not in PCIC; desayunarse/amanecerse/robarse no) |
| 8 | 8.2 (A1) | `acá/allá` preferred; `ahora` for `hoy`; `demasiado` for `mucho/muy`; `también no` for `tampoco` | yes | - (gap A1) | no; `progresivo` mentions `ahorita`, not in PCIC |
| 9 | 8.9 (A2) | `arriba de` for `encima de` | yes | - | no |
| 10 | 9.1.1 (A1) | voseo verb forms, incl. parts of Mexico (Chiapas, Tabasco, Yucatán, Quintana Roo) | partly | presente | no |
| 11 | 9.1.1 (A1) | `voy a + inf.` with present value | yes | presente / futuro | partly (presente `use`: near future in Mexico) |
| 12 | 9.3 (A2) | voseo imperative `-á/-é/-í`, incl. Chiapas | partly | imperativo | no (says only ustedes, no vosotros) |
| 13 | 12.1 (A2) | `estar + gerundio` with punctual value (`Está viniendo` = viene) | yes | progresivo | no (mentions frequency and `ahorita` only) |
| 14 | 12.1 (A2) | `saber + inf.` = `soler` (Panama, Ecuador, Bolivia) | no | - | n/a |
| 15 | 13.2 (A1) | Caribbean: explicit pronoun subject with SVO order | no | - | n/a |
| 16 | 13.3 (A1) | personalised `haber` (`Habían cajas`, `Hubieron...`) | yes (Hispanoamérica) | hay-estar | no ("same as elsewhere"); a "do not imitate" note could go here |
| 17 | 13.3 (A2) | personalised `hacer` (`Hacen dos días que...`) | yes (Hispanoamérica) | - | no |
| 18 | 15.3.1 (A2) | `hasta` without `no` with start value (`Viene hasta hoy`) in Mexico, Central America, Andes | yes | - (gap SU1) | no |
| 19 | 1.2 (B1) | gender differs by variety: `el bombillo`, `la bolsa`, `el costumbre` (part of Mexico), `la sala` | yes | gender | no (mx text gives el radio / el sartén, which PCIC does not list: verify elsewhere) |
| 20 | 3.1 (B1) | article before `casa` (`Vamos a la casa`) | yes | articles | no (mx text is about `la María`, not in PCIC) |
| 21 | 6.1 (B1) | `más nada`, `más nadie` word order | yes | - (gap D5) | no |
| 22 | 7.1.3 (B1) | Mexico, Central America, Chile: `le` as an enclitic emphasiser (`¡Ándale!`, `¿Qué le haces?`) | yes | object-pronouns | no |
| 23 | 8.2 (B1), (B2) | `más nunca` (B1); `inmediato` for `inmediatamente` (B2) | yes | - (gap A1) | no |
| 24 | 8.4 (B2) | `casualmente` for `exactamente` | yes | - | no |
| 25 | 8.9 (B2) | `no más` (`ahí no más`, `Diga no más`) | yes | - | no |
| 26 | 9.1.4 (B1) | futuro: `ir a`, present, `haber de`, `ir y + presente` preferred | yes | futuro | yes (`ir a`); `haber de`/`ir y` no, not needed |
| 27 | 9.1.4 (B1) | futuro `-ré` used for probability, doubt, exclamations | yes | futuro | yes (`¿qué hora será?`) |
| 28 | 9.1.5 (B2) | condicional replaced by `iba a + inf.` / imperfecto in reported speech (`Le dije que iba a venir`) | yes | condicional | no |
| 29 | 9.1.9 (B2) | futuro perfecto replaced by pretérito or `ir a` (`Cuando vengas, ya lo terminé`) | yes | - (gap V1) | no |
| 30 | 9.2.2 (B2) | `-ra` forms preferred, `-se` formal | yes | subj-imperfecto, si-clauses | yes (both) |
| 31 | 10.4 (B1) | Central America, Colombia, Peru, Chile: plural verb with `con` (`Cantamos con él`) | no | - | n/a |
| 32 | 12.2.2 (B2) | leísmo in Caribbean, S. Colombia, Ecuador coast, Bolivia | no | object-pronouns | n/a (mx says Mexico uses lo/la, consistent) |
| 33 | 13.3 (B2) | `capaz que + subjuntivo` = quizás (Mexico, Antilles, South America) | yes | subjuntivo-clauses | no |
| 34 | 9.4.1 (B2) | Caribbean: pronoun before infinitive (`al yo decir`) | no | - | n/a |
| 35 | 15.3.5 (B1) | Caribbean: pronoun before `para + inf.` with other subject | no | - | n/a |

Result: of 35 notes, **25 concern Mexico or all Hispanoamérica** (+ 3 that touch Chiapas only: rows 6, 10, 12); the tips' `variants.mx` fully reflect **3** (rows 26, 27, 30) and partly **3** (rows 4, 7, 11). Notes worth adding to an existing mx text, in order of value:
row 22 (`ándale`) and row 5 (`la pasamos`) to object-pronouns; row 13 (puntual `está viniendo`) to progresivo; row 33 (`capaz que`) to subjuntivo-clauses; row 28 to condicional; row 19 and row 20 to gender/articles; rows 4 and 12 (Chiapas voseo, tuteo-only) to presente/imperativo; rows 7 and 16 as small extensions. The rest belong to gap tips (D5, A1, SU1, V1).

---

## 5. Summary

**Tips (29):** 17 OK (8 clean + 9 with rule-level notes), 5 level mismatch (futuro, subjuntivo-clauses, relatives, passive-se, si-clauses partial), 6 citation imprecise (progresivo, accents, condicional, object-pronouns, comparisons, por-para), 1 partly covered (ser-estar). All 29 `sources.where` strings lack section numbers; proposed strings are in section 1.
**Gaps:** 48 (18 high, 19 medium, 11 low).
**Sentence mismatches:** futuro 37 A2, progresivo 22 A1; thin spots: imperativo A2 (7), por-para A2 (0), relatives B1 (1), subjuntivo-clauses B1 (2); no perfecto sentences.

### Most important actions

1. **Fix the `pcic` `where` strings** of all 29 tips with the section-numbered values from section 1; at minimum correct condicional (9.1.5 is empty at A2, hypothesis is B2), progresivo (gerundio is A2), object-pronouns, comparisons, accents and por-para (no preposition chapter in PCIC).
2. **Decide the futuro/`ir a` question (M1):** split into "ir a + infinitivo" (A2) and "futuro -ré" (B1), or record a deliberate deviation. It is the largest sentence mismatch (37 A2 sentences, none with `ir a`).
3. **Decide on progresivo at A1 (M6):** retag 22 sentences to A2 or document the deviation; same for the `progressive` rule inside ser-estar.
4. **Split or retag the B2 tips that hold B1 content** (subjuntivo-clauses, relatives, passive-se): B1 currently has 2, 1 and 0 sentences for them.
5. **Add a tip on the A2 aspect periphrases** (`acabar de`, `empezar a`, `volver a`, with `ir a`): PP1, high, 12.1 A2; B1 follow-up `soler`, `dejar de`, `seguir + gerundio` (PP2).
6. **Add B2 tips for ser/estar + adjective (change of meaning) and verbos de cambio** (S1, S2): both are named in PCIC 12.1 B2 and already in the tip's `ideas`.
7. **Add a tip on temporal and causal/consecutive clauses** (SU1, SU2) and on **indirect speech** (V4): high value, B1-B2 and common in DELE.
8. **Cover the B2 subjunctive tenses**: perfecto/pluscuamperfecto de subjuntivo, condicional compuesto, `si hubiera...habría` (V2, V3), and conditional connectors (SU4).
9. **Add A1-A2 basics that have no tip**: demostrativos, posesivos, interrogativos, negation/indefinites (D1, D2, P4, D4, D5), and personal `a` (C1).
10. **Update `variants.mx`** with the PCIC notes in section 4 (ándale, `la pasamos bien`, puntual `está viniendo`, `capaz que`, Chiapas voseo/tuteo, gender and `la casa`), and verify the unsupported claims (`el radio`, `el sartén`, `la María`) against another source.

---

## 6. Applied on 2026-11-09 (uncommitted)

- **Action 1 done.** Every tip's `pcic` source now carries the section-numbered `where` from section 1 (level ranges written
  with an en dash, `A1–A2`, as before). Only the `sources` line of each tip changed; levels, rules and texts are untouched.
- **New source `ngle`** in `src/data/sources.json`: RAE y ASALE, *Nueva gramática de la lengua española* (2009), free online
  at https://www.rae.es/gramática/. 28 tips cite it right after the PCIC (the `accents` tip keeps the RAE *Ortografía*).
  Section numbers were read from the NGLE index on rae.es on 2026-11-09 (section titles, not the section texts):

| Tip | NGLE | Tip | NGLE |
|---|---|---|---|
| ser-estar | § 37.7–37.9 (atributo con ser y estar) | subjuntivo | cap. 4 (flexión verbal); cap. 24 |
| presente | § 23.5–23.6 | condicional | § 23.15 |
| preterito | § 23.9 | perfecto | § 23.7–23.8 |
| imperfecto | § 23.10–23.13 | pluscuamperfecto | § 23.16 (tiempos compuestos no orientados desde el habla) |
| preterito-imperfecto | § 23.9–23.13 | subj-imperfecto | cap. 24 |
| futuro | § 23.14 (futuros sintéticos y analíticos); 28.8 (perífrasis con ir) | gustar | cap. 35 (complemento indirecto) |
| progresivo | § 28.12 (perífrasis de gerundio con estar) | hay-estar | § 41.6 (impersonales con haber…) |
| gender | cap. 2 | object-pronouns | § 16.7–16.11 (átonos, leísmo/loísmo, secuencias) |
| articles | cap. 14–15 | comparisons | § 45.1–45.3 |
| adjectives | cap. 13 | obligation | § 28.6–28.7 (perífrasis modales) |
| reflexive | § 16.4; 41.13 (verbos pronominales) | subjuntivo-wishes | § 25.3–25.8; 25.14 (modo con interjecciones: ojalá) |
| imperativo | § 42.3–42.5 | si-clauses | § 47.1; 47.8 (tiempo y modo en condicionales) |
| por-para | § 29.8 | subjuntivo-clauses | § 25.3–25.8; 25.13 (modo con conjunciones) |
| relatives | cap. 44 | passive-se | § 41.2; 41.10–41.12 (pasiva perifrástica, impersonal y pasiva refleja) |

- `src/lib/localized.test.ts` expects the new citation strings. `validate:data`, `npm test` (828) and `e2e/grammar.spec.ts` (8) are green.
- **Not done (decisions for Adam):** actions 2–10. No tip level, sentence tag or `variants.mx` text was changed.

## 7. Part A1 applied on 2026-11-09 (uncommitted): levels after the PCIC

Spec `docs/superpowers/specs/2026-11-09-grammar-levels-design.md`, plan `docs/superpowers/plans/2026-11-09-grammar-levels.md`.

- **Tips split (29 → 33):** `ir-a` (A2, new) + `futuro` (B1); `subjuntivo-clauses` (B1) + `subjuntivo-aunque` (B2, new);
  `relatives` (B1) + `relatives-prep` (B2, new); `passive-se` (B1) + `ser-passive` (B2, new). Mismatches M1–M4 of §2.1
  are resolved; English and Spain overlays follow.
- **Sentences:** the 37 A2 `-ré` sentences are rewritten to *ir a* (blank = the form of *ir*); 30 blanks retagged to the
  new tips; s1392 (A1 `¿Cómo se dice…?`) lost its `passive-se` tag; new: s2168–s2211 (B1 subjuntivo-clauses 22,
  relatives 22), s2212–s2259 (B1 passive-se 20; B2 subjuntivo-aunque 8, relatives-prep 8, ser-passive 12),
  s2260–s2263 (A2 ir-a). Totals: 2263 sentences, 33 tips.
- **Drill and level exams:** pretérito, imperfecto and perfecto from A2, futuro from B1; the A1 exam conjugates
  presente and progresivo only.
- **Cesta:** A2 family/1 and weather/1 → `ir-a`; health/1 → preterito, numbers/1 → imperfecto, home/2 and nature/2 →
  imperativo, hobbies/2 → progresivo; B1 family/1 + greetings/1 → subjuntivo-clauses, home/1 + greetings/2 → relatives,
  body/1 + school/1 → passive-se, work/1 → futuro; B2 work/1 + health/1 → subjuntivo-aunque, travel/1 + nature/1 →
  relatives-prep, shopping/1 + tech/1 → ser-passive.

### Recorded deviations from the PCIC

1. `progresivo` at A1 (PCIC: estar + gerundio A2, 9.4.2 / 12.1): *estoy comiendo* is useful from the first week; the
   ser-estar rule `progressive` stays at A1 with it, and the drill keeps progresivo at A1.
2. `si-clauses` at B1 holds the A2 real condition (PCIC 15.3.6 A2) with the B2 unreal one: one tip contrasting both is clearer.
3. `cuyo` in `relatives-prep` although the PCIC grammar inventory does not list it (cited from the NGLE).
4. `relatives` at B1 although `que` alone is A1 in the PCIC: A1–A2 sentences use `que` freely without a tip.

## 8. Part A2 applied on 2026-11-09 (uncommitted): new A1–A2 tips

Spec `docs/superpowers/specs/2026-11-09-grammar-a1-a2-tips-design.md`, plan `docs/superpowers/plans/2026-11-09-grammar-a1-a2-tips.md`.
Gaps D1, D2, P4, D5 (+ part of D4) and C1 of §3 are closed.

- **Tips (33 → 38):** `demonstratives` (A1; PCIC 4, NGLE cap. 17), `possessives` (A1; PCIC 5, NGLE cap. 18),
  `interrogatives` (A1; PCIC 7.3, 8.8, 8.9, NGLE cap. 22, 42), `negation` (A2; PCIC 6.1, 6.2, 8.2, 8.5, NGLE cap. 48, 20),
  `personal-a` (A2; PCIC 12.2.2, NGLE § 34.8–34.10). All five are usage tips (a blank names `tip` + `why`).
- **Blanks** at the tip's level and below: demonstratives 27, possessives 25, interrogatives 34, negation 26,
  personal-a 24. 104 existing blanks retagged (all levels), 66 blanks added to existing sentences, new sentences
  s2264–s2312 (49). Existing `porque` blanks keep no tip (their distractors are conjunctions).
- **Cesta:** A1 home/1, family/2 → possessives; travel/1, school/2 → demonstratives; numbers/2, work/1 → interrogatives;
  A2 food/1, hobbies/1 → negation; greetings/2, body/2 → personal-a. ser-estar `trait` moved to A1 emotions/1.
- **Checks:** no blank names a tip above its sentence's level (new test; s1105 lost its B2 tip). The Spain overlay of
  14 part-A1 sentences (s2173–s2256) was added: `validate:es` is clean again.

### Recorded deviations from the PCIC (part A2)

5. A2 rules inside A1 tips: `demonstratives` time and alone (PCIC 4 A2), `possessives` long and body (PCIC 5 A2).
6. `cual` (qué vs cuál, PCIC 7.3 B1) inside the A1 `interrogatives`: a frequent mistake from the first weeks.
7. `pairs` (algo/alguien/algún ↔ nada/nadie/ningún, PCIC 6.1 B1) inside the A2 `negation`.
8. `también / tampoco` (PCIC 6.2 A1) taught by the A2 `negation`; A1 blanks on them keep no tip.

## 9. Parts A3 + A4 applied on 2026-11-10 (uncommitted)

Spec `docs/superpowers/specs/2026-11-10-grammar-b1-b2-tips-design.md`, plan `docs/superpowers/plans/2026-11-10-grammar-b1-b2-tips.md`.
Gaps V2+V3 (merged), V4, PP1+PP2, S1, S2, A3, C2, SU1, SU2, SU4 and SU5 of §3 are closed.

- **Tips (38 → 49):** B1 `periphrases`, `temporal`, `cause`, `reported`, `doubt`; B2 `verb-prep`, `ser-estar-meaning`, `cambio`,
  `conditional-perfect`, `cond-connectors`, `relatives-mood`. All are usage tips (a blank names `tip` + `why`).
- **Blanks:** 15–31 per tip; 158 new sentences s2313–s2466 (B1 / B2), blanks added to about 45 existing sentences.
- **Cesta:** 22 units re-pointed (all B1 imperativo units, two B1 subjuntivo, two B1 condicional, one B1 pluscuamperfecto, B1 accents and
  reflexive, and B2 units of imperfecto, subjuntivo, condicional, subj-imperfecto, imperativo, preterito, reflexive, accents, ser-estar);
  the B1 and B2 tense-unit counts in `path.test.ts` are 3 each.
- **A4 (`variants.mx`):** notes for presente (tuteo, Chiapas voseo, explicit subject), imperativo (Chiapas voseo), progresivo (punctual
  *está viniendo*), condicional (*iba a*), object-pronouns (*ándale*, *la pasamos bien*), subjuntivo-clauses (*capaz que*), reflexive
  (*desayunarse*, *amanecerse*), hay-estar (*habían cajas* is wrong), negation (*más nada*, *hasta* without *no*), gender and articles rewritten.
  Checked in the DLE (dle.rae.es): *sartén* and *radio* have both genders in American Spanish; the old claim that Mexico says *el radio* and
  Spain *la radio* was not supported and is gone. *la María* (the mx text of `articles`) is replaced by *Vamos a la casa* (PCIC 3.1 B1).
- **Loose ends:** the hints of s371, s2265, s2271, s019, s836, s273 and s1228 are fixed.
- NGLE numbers: the rae.es index could not be read in this session; only numbers known from part A1 are cited, the other tips name the chapter topic.

### Recorded deviations from the PCIC (part A3)

9. `acabar de` (A2) inside the B1 `periphrases`; `soler` is not a verb of the app, so its blanks are word blanks.
10. `desde` and `antes de + inf.` (A2) inside `temporal`; `ya que` and `tan… que` (B2) inside `cause`; `dijo que + subjuntivo` (B2) inside `reported`.
11. `verb-prep` is B2 (PCIC 12.2.5 B1–B2): the B1 level had no more path units to give.
12. `conditional-perfect` merges V2 and V3; the pluscuamperfecto de subjuntivo is taught through *hubiera* only.

## 10. Part B applied on 2026-11-10 (uncommitted): the grammar screen

Spec `docs/superpowers/specs/2026-11-10-grammar-screen-design.md`, plan `docs/superpowers/plans/2026-11-10-grammar-screen.md`.

- `Tip.area` (7 areas: tenses, moods, verbs, nouns, pronouns, sentences, spelling) in `tips.json`, checked by `validate:data`.
- `src/lib/tipSearch.ts`: accent-insensitive search over title, intro, rules, Spanish examples and `ideas`; title matches rank first.
- `/practice/grammar`: search field, level chips, tips grouped by area (A1 → B2 inside an area), query and level in the URL.

# Skupiny cvičení podľa zručností (návrh)

Stav: **fázy 1 a 2 postavené** (2026-11-16, necommitnuté), fáza 3 čaká na rozhodnutie. Rozhodnutia Adama: variant A (4 skupiny), chipy, Doplňovačka v Slovnej
zásobe, Pravda alebo nie v Gramatike, Skladanie viet v Písaní.

Cieľ: v Cvičiť si učiaci sa vyberie, **čo chce trénovať** (slovnú zásobu, gramatiku, písanie, počúvanie a hovorenie),
a uvidí len cvičenia danej skupiny. Skupina je filter, nie zámok ani kurz (pozri `docs/product-vision.md`): pri
„Všetko“ ostáva Cvičiť presne ako dnes.

Netreba nový obsah ani zmenu databázy. Skupina sa dá určiť z typu cvičenia.

---

## 1. Skupiny

| Skupina (id) | SK | EN | Cvičenia (`ExerciseType`) |
|---|---|---|---|
| `vocabulary` | Slovná zásoba | Vocabulary | `vocab`, `matching`, `cloze` |
| `grammar` | Gramatika | Grammar | `conjugation`, `choice`, `findmistake`, `truefalse` |
| `writing` | Písanie | Writing | `builder`, `translation` |
| `listening` | Počúvanie a hovorenie | Listening & speaking | `dictation`, `speaking` |

Každé cvičenie patrí do práve jednej skupiny. Poradie skupín v chipoch je poradie v tabuľke.

## 2. Dáta: `src/lib/skills.ts` (nový súbor)

```ts
import type { ExerciseType } from './lesson'

export type Skill = 'vocabulary' | 'grammar' | 'writing' | 'listening'
export const SKILLS: readonly Skill[] = ['vocabulary', 'grammar', 'writing', 'listening']

/** The group of every exercise type. A Record, so a new ExerciseType does not compile until it has one. */
export const SKILL_OF: Record<ExerciseType, Skill> = { ... }

export const typesOfSkill = (skill: Skill): ExerciseType[] => ...
export const isSkill = (value: unknown): value is Skill => ...
```

Unit test `skills.test.ts`: každý typ z `EXERCISE_TYPES` má skupinu, každá skupina má aspoň jeden typ a mapovanie
zodpovedá tabuľke v §1.

## 3. Fáza 1: chipy v Cvičiť (povinná)

Súbor: `src/features/exercises/PracticeHub.tsx`, komponent `ExerciseList`.

- **Riadok chipov** medzi nadpisom „Cvičenia“ a zoznamom: `Všetko · Slovná zásoba · Gramatika · Písanie ·
  Počúvanie a hovorenie`. Použi existujúci `Chip` (`src/components/Chip.tsx`) v obale
  `role="group"` s `aria-label` (SK „Skupiny cvičení“, EN „Exercise groups“).
  Pri 375 px sa chipy na jeden riadok nezmestia: zalom ich (`flex-wrap gap-2`), alebo ich vodorovne posúvaj ako
  filtrovacie chipy v Hľadať. Stránka sa nesmie posúvať do strany.
- **Filtrovanie**: najprv sa zoradí celý zoznam ako dnes (`orderExercises`), potom sa vyfiltruje podľa skupiny.
  V rámci skupiny tak platí poradie učiaceho sa (podľa posledného hrania aj vlastné).
- **Upraviť poradie**: počas úprav sa chipy skryjú a zobrazí sa celý zoznam, lebo `moveExercise` pracuje nad celým
  zoznamom. Po „Hotovo“ sa vráti zvolená skupina.
- **Zapamätanie**: zvolená skupina sa ukladá do `localStorage` pre zariadenie (napr. kľúč `somos.practiceSkill`),
  každé čítanie a zápis obal do `try/catch`. Neplatná alebo chýbajúca hodnota = `all`. Nesynchronizuje sa s účtom
  ani nejde do zálohy: je to len pohodlie na jednom zariadení.
- **Štítok skupiny na karte**: iba keď je zvolené „Všetko“, nad názvom cvičenia malý štítok
  (`text-[0.7rem] uppercase tracking-wide text-ink-muted`, ako eyebrow na Domov). Pri zvolenej skupine sa nezobrazuje,
  lebo by sa opakoval. Ak bude karta pri 375 px preplnená, štítok vynechaj a napíš to do súhrnu.
- **Nedostupné Vyslovovanie** (prehliadač bez rozpoznávania reči) ostáva v skupine ako vypnutá karta, ako dnes.
  Skupina má stále Diktát.
- **Netýka sa**: Zmiešané cvičenie, Pokračovať, skratiek (Chyby, Duel, Testy, Gramatika), Cesty, testov ani URL
  `/practice?type=…`.

Texty (`src/i18n/sk.ts` a `src/i18n/en.ts`, pod `practice`):

```ts
skills: {
  label: 'Skupiny cvičení',
  all: 'Všetko',
  vocabulary: 'Slovná zásoba',
  grammar: 'Gramatika',
  writing: 'Písanie',
  listening: 'Počúvanie a hovorenie',
},
```

EN: `Exercise groups`, `All`, `Vocabulary`, `Grammar`, `Writing`, `Listening & speaking`.

## 4. Fáza 2: štatistiky po skupinách v Prehľade (povinná)

Súbory: `src/lib/stats.ts`, `src/features/stats/StatsPage.tsx`.

- Nová funkcia `bySkill(attempts)` v `stats.ts`, vedľa `byExercise`. Vráti pre každú skupinu `{ skill, count,
  correct }`, len skupiny s aspoň jedným pokusom, najviac precvičovanú prvú.
- Pokusy `exercise: 'review'` (opakovanie kartičiek) a neznáme hodnoty (staré dáta) sa **nezapočítavajú**. Opakovanie
  ostáva ako vlastný riadok v časti „Podľa cvičení“.
- Pokusy z Cesty, testov, chýb a Zmiešaného cvičenia sa počítajú do skupiny podľa svojho typu (`attempt.exercise` je
  typ úlohy).
- Na `StatsPage` pribudne sekcia **„Podľa zručností“** (EN „By skill“) **nad** sekciou „Podľa cvičení“. Má rovnaký
  vzhľad (riadok: názov · počet · % správne, pruh podľa podielu) a rovnaké obdobie (7/30/90 dní). Pri nule pokusov
  sa sekcia nezobrazí, prázdny stav ostáva v „Podľa cvičení“.
- Unit testy pre `bySkill`: zoskupenie, vynechanie `review`, poradie a prázdny vstup.

## 5. Fáza 3: Zmiešané cvičenie po skupinách (voliteľná, rozhodne Adam neskôr)

Nápad: keď je zvolená skupina, nad zoznamom je tlačidlo „Zmiešané: Gramatika“, ktoré spustí 10 úloh len z typov
skupiny. **Do fázy 1 a 2 to nepatrí.** Obmedzenie: `PREPARE_MIX` v `src/lib/tests.ts` dnes mieša len
`vocab, choice, cloze, conjugation, builder, dictation, translation`. Celoobrazovkové behy (`matching`, `truefalse`)
ani `findmistake` a `speaking` sa v zmiešanej lekcii nepoužívajú, takže pred stavbou treba overiť, ktoré typy sa dajú
miešať. Bez toho by „Počúvanie a hovorenie“ bolo iba 10× Diktát.

## 6. Testy a hotovo

- `npm test` (nové `skills.test.ts`, `bySkill` v testoch stats).
- e2e v existujúcom spece pre Cvičiť: klik na „Gramatika“ ukáže práve Časovanie, Výber z možností, Nájdi chybu,
  Pravda alebo nie. Klik na „Všetko“ vráti všetkých 11. Zvolená skupina vydrží reload.
  Upraviť poradie skryje chipy. Na Prehľade je sekcia „Podľa zručností“ po jednej odohranej lekcii.
- `npm run build`, `npm run test:e2e` pred pushom (`E2E_PORT=5299`, ak beží iná kópia).
- Ručne pri 375 px: chipy bez vodorovného posúvania stránky, ciele dotyku ≥ 44 px, svetlá aj tmavá téma.
- Do `CLAUDE.md` §5 (Cvičiť) doplň jednu vetu: chipy skupín filtrujú cvičenia, skupiny sú v `src/lib/skills.ts`.

## 7. Mimo rozsahu

- Nové cvičenia na čítanie, režim „iba zvuk“ pre existujúce cvičenia (variant B z návrhu): neskôr, ako vlastný projekt.
- Skupiny v Ceste, testoch alebo na Domov.
- Synchronizácia zvolenej skupiny medzi zariadeniami.

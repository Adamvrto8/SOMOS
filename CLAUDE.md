# SOMOS — Spanish learning app (Slovak ⇄ Mexican Spanish)

Personal mobile-first PWA for learning Spanish (Mexican variant) from Slovak.
Single user, no login, works offline. Owner: Adam (knows basic Spanish, A1).

**UI language: Slovak.** Code, comments, commit messages: English.

---

## 1. Product scope

### Core features
1. **Search / dictionary** — type Slovak or Spanish, instant results (diacritic-insensitive, fuzzy).
   Tap a Spanish word → **Word detail**: translation(s), part of speech, gender (el/la),
   plural, example sentences (ES + SK), 🔊 pronunciation, ⭐ save to archive.
   Verbs additionally show a full conjugation table.
2. **Verbs & conjugation** — tenses in scope (MVP):
   - `presente` (hablo)
   - `presente progresivo` = estar (presente) + gerundio (estoy hablando)
   - `pretérito` (pretérito perfecto simple: hablé, fui)
   Irregular forms highlighted (amber). Conjugation drill exercise.
3. **Vocabulary groups** — thematic topics (jídlo, cestovanie, práca, dom, telo, rodina,
   čas, počasie, oblečenie, mesto, škola, emócie, zdravie, nakupovanie, príroda…)
   plus grammar groups (false friends, verbs with prepositions, common phrases).
4. **Exercises** (lesson = ~10 tasks, filtered by type + topic + level):
   - **Cloze** — fill the missing word in the correct form (typed input)
   - **Multiple choice** — pick the correct word/form
   - **Sentence builder** — arrange shuffled word tiles into a correct sentence
   - **Translation SK → ES** — free typing, tolerant checking
   - **Conjugation drill** — "tener · yo · pretérito → ___"
5. **Archive** — ⭐ saved words and sentences (star on word detail or in exercise feedback),
   user's **own custom words** (ES, SK, note, topic), and **Chyby** — exercises answered wrong,
   kept until the learner removes them. ⭐ + custom words are reviewed via spaced repetition;
   mistakes are practised as a lesson. Export / import JSON backup.
6. **Levels** — every word/verb/sentence tagged `A1 | A2 | B1…`. MVP content A1–A2.

### Mexican Spanish rules (important for all content)
- No `vosotros` anywhere. Persons: `yo, tú, él/ella/usted, nosotros, ellos/ellas/ustedes` (5 forms).
- Mexican vocabulary: carro (not coche), computadora (not ordenador), celular (not móvil),
  jugo (not zumo), platicar, camión (bus), departamento (apartment), papa (potato), etc.
- Past tense default = pretérito (not pretérito perfecto compuesto).
- TTS voice: prefer `es-MX`, fall back to any `es-*`.

---

## 2. Tech stack (all free)

| Concern | Choice |
|---|---|
| Framework | Vite + React + TypeScript |
| Styling | Tailwind CSS with design tokens as CSS variables |
| Routing | react-router |
| PWA / offline | vite-plugin-pwa (precache app + all JSON data) |
| Local storage | Dexie (IndexedDB) — archive, custom words, SRS state, stats |
| Search | MiniSearch (or Fuse.js) with accent-folding normalization |
| Spaced repetition | ts-fsrs (FSRS algorithm) |
| Pronunciation | Web Speech API `speechSynthesis` (free, built into browser) |
| Hosting | Vercel (free) |
| Optional later | DeepL API Free for lookups outside dataset — via a Vercel serverless function (never expose the key in client code) |

Content lives as **static JSON in `src/data/`**, bundled with the app → offline & free.

---

## 3. Data model

```ts
type Level = 'A1' | 'A2' | 'B1' | 'B2';
type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'ellos'; // el = él/ella/usted, ellos = ellos/ellas/ustedes

interface Word {
  id: string;                 // slug, e.g. "casa", "carro"
  es: string;                 // lemma
  sk: string[];               // Slovak translations, first = primary
  pos: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'pron' | 'conj' | 'phrase' | 'other';
  gender?: 'm' | 'f';         // nouns only
  plural?: string;            // nouns/adjs if not trivial
  feminine?: string;          // adjs: "bonito" → "bonita"
  level: Level;
  topics: string[];           // topic ids
  examples: { es: string; sk: string }[]; // 1–3
  note?: string;              // usage note in Slovak (false friend, MX-specific…)
  verbId?: string;            // link to Verb when pos === 'verb'
}

interface Verb {
  id: string;                 // infinitive, e.g. "tener"
  sk: string[];
  group: 'ar' | 'er' | 'ir';
  regular: boolean;
  reflexive?: boolean;        // levantarse
  gerund: string;             // teniendo
  gerundIrregular?: boolean;
  presente: Record<Person, string>;
  preterito: Record<Person, string>;
  irregularForms?: string[];  // "presente.yo", "preterito.*" → highlighted in UI
  level: Level;
}
// presente progresivo is derived: estar.presente[person] + " " + gerund

interface Sentence {
  id: string;
  es: string;
  sk: string;
  level: Level;
  topics: string[];
  tokens: string[];           // for sentence builder, punctuation separate
  cloze?: {
    tokenIndex: number;       // which token is blanked
    answer: string;           // correct form
    lemma: string;            // base word / infinitive
    hint?: string;            // "tener · yo · pretérito"
    distractors?: string[];   // for multiple choice
  }[];
  grammar?: ('presente' | 'progresivo' | 'preterito' | 'ser-estar' | 'gender' | 'articles')[];
}

interface Topic { id: string; sk: string; es: string; icon: string; }

// Stored in IndexedDB (Dexie)
interface CustomWord { id: string; es: string; sk: string; note?: string; topic?: string; createdAt: number; }
interface SavedItem  { itemId: string; itemType: 'word' | 'verb' | 'custom' | 'sentence'; savedAt: number; }
interface ReviewCard { itemId: string; itemType: 'word' | 'custom' | 'sentence'; fsrs: Card /* ts-fsrs */; }
interface Attempt    { id?: number; exercise: string; itemId: string; correct: boolean; at: number; }
interface Mistake    { exercise: string; itemId: string; firstWrongAt: number; lastWrongAt: number; wrongCount: number; }
// exercise + itemId identify a lesson task: "s001#0" (cloze/choice), "tener:preterito:yo", "s004" (builder/translation);
// lesson.taskFromItem() rebuilds the task from them.
```

Spaced repetition (`src/lib/srs.ts`, `src/features/review/`):
- Every ⭐ word/sentence and every custom word has exactly one ReviewCard (created on save/add,
  removed on unsave/delete; `syncReviewCards()` repairs this at startup and after a backup restore).
- A card is "due today" when `due` ≤ end of the local day. Cards still due after rating
  (short relearning steps) come back later in the same session.
- Always read cards through `cardOf()` (ts-fsrs `TypeConvert`): JSON backups store dates as strings.
- Every review is also an Attempt with `exercise: 'review'`; streak, daily goal and stats count all attempts.

A validation script (`npm run validate:data`) must check: unique ids, every `verbId`
exists, every topic exists, cloze `tokenIndex` in range and `tokens[tokenIndex] === answer`,
no `vosotros` forms, all 5 persons present.

Content conventions (types in `src/data/types.ts`, all enforced by `validate:data`):
- Word `id` = slug of `es` (lowercase, accents/¿?¡! stripped, spaces → `-`); collisions get `-2`: `papa` (zemiak), `papa-2` (papá).
- Every verb has exactly one Word (`pos: 'verb'`, `id` = `es` = `verbId` = infinitive).
- `irregularForms` lists exactly the forms that differ from the regular -ar/-er/-ir pattern
  (spelling changes count: `llegué` → `preterito.yo`); `regular` is true only when there are none;
  `gerundIrregular` likewise. Use `tense.*` when all 5 persons differ.
- Reflexive verbs: forms include the pronoun (`me llamo`), `gerund` does not (`llamando`).
- Cloze hint for verbs: `"tener · yo · pretérito"`, `"hablar · gerundio"`, or `"ser/estar · él · presente"`
  (person labels yo/tú/él/ella/usted/nosotros/ellos/ellas/ustedes). The validator conjugates and checks the answer.
  Non-verb hints are short Slovak (`"člen"`, `"zajtra"`). Blanking a sentence-initial word keeps its capital.
- Sentence tokens must rebuild `es` exactly (no space before `.,?!`, none after `¿¡`); ids `s001`…
- Spain-only vocabulary (coche, ordenador, móvil, zumo, patata, conducir, coger, billete…) is rejected in Spanish text; Slovak notes may mention it.

---

## 4. Answer checking

Normalize: trim, lowercase, collapse spaces, strip ¿?¡!.,
- Exact match → ✅ correct
- Differs only in accents → ✅ correct with warning ("Pozor na prízvuk: **está**"),
  **except** when the accent changes the meaning → ❌ wrong with explanation.
  Meaning-changing pairs: esta/está, el/él, tu/tú, si/sí, mas/más, se/sé, te/té, de/dé,
  mi/mí, que/qué, como/cómo, donde/dónde, cuando/cuándo, hablo/habló (and other -o/-ó verb forms).
- Levenshtein distance 1 on words ≥ 5 letters → 🟡 "takmer" (typo), counted as correct once.
- Otherwise ❌, show correct answer + hint.

Implementation (`src/lib/checkAnswer.ts`, unit-tested in `checkAnswer.test.ts`):
- Words are compared one by one; a different word count is ❌.
- A missing ñ is treated like a missing accent (Slovak keyboards), except año/ano.
- "Different real word" is decided by `lookupForm` (`src/lib/knownForms.ts`, every form in the dataset):
  an accent-only difference to another known form is ❌ with both meanings shown (hablo/habló, papa/papá),
  and a known form is never a typo (hablas for hablan is ❌, not 🟡).
- "Counted as correct once" = the typo answer counts as correct, but at most one typo per answer.
- Translation SK → ES also accepts an extra leading subject pronoun (Yo hablo… for Hablo…) and offers
  "Moja odpoveď bola tiež správna" on ❌, since free translation has many valid answers.

---

## 5. Screens & navigation

Bottom tab bar (4 tabs): **Domov · Hľadať · Cvičiť · Archív**

- **Domov** — "Na zopakovanie dnes: N" CTA, streak, daily goal ring, quick search field, slovo dňa.
- **Hľadať** — search input autofocused, results list (ES bold serif + SK muted), filter chips
  (všetko / slovesá / podstatné mená / frázy). Browse by topic below when input empty.
- **Detail slova** (`/word/:id`) — big serif Spanish word + 🔊, gender badge, translations,
  examples, note, conjugation table for verbs (tabs: presente · progresivo · pretérito), ⭐ save.
  Opened from a list (topic, search, archive) it swipes / pages (‹ n/N ›, ← →) to neighbouring words.
- **Cvičiť** — pick exercise type (cards), topic, level → lesson player → result screen.
  Lessons prefer items answered least often. "Precvičiť chyby" card when mistakes exist.
- **Lekcia** — progress bar, one task per screen, big input / tiles, bottom "Skontrolovať" button,
  feedback sheet slides up (green / amber / red) with ⭐ (verb for conjugation, sentence otherwise).
  Wrong answers go to Chyby. Result: repeat mistakes / whole lesson / new lesson.
  `?mistakes=1` practises the mistakes list; a right answer asks "Nechať / Odstrániť".
- **Archív** — tabs Uložené / Moje slová / Chyby, search + topic filter, "Zopakovať" (SRS session),
  "+" add custom word, settings: export/import backup, theme, daily goal, TTS voice.

Mobile first (375px), max content width ~480px centered on desktop. Large tap targets (≥44px).

---

## 6. Design system — "industrial loft café"

Inspiration: converted factory café — raw concrete, exposed brick, black steel beams,
hanging plants, floral tapestry armchairs, warm amber lamps, a small neon sign.
Clean and calm, but with character. Not childish.

```css
:root {
  --bg:        #F4F1EC;  /* warm concrete */
  --surface:   #FFFFFF;
  --surface-2: #ECE7DF;
  --ink:       #1E1E1C;  /* steel beams */
  --ink-muted: #6B665E;
  --line:      #DDD6CB;
  --brick:     #B5553C;  /* primary accent, buttons */
  --leaf:      #4F6B45;  /* success */
  --amber:     #E3A64B;  /* highlights, streak, irregular forms */
  --error:     #A33A2B;
}
[data-theme="dark"] {     /* "neon lounge" */
  --bg:        #161614;
  --surface:   #1F1E1B;
  --surface-2: #292723;
  --ink:       #F1ECE3;
  --ink-muted: #A39C90;
  --line:      #34312C;
  --brick:     #D06A4E;
  --leaf:      #7F9E72;
  --amber:     #F2B866;  /* subtle glow on active elements */
}
```

- Fonts (Google Fonts): **Fraunces** for headings and Spanish words, **Inter** for UI text.
- Radius 14–18px on cards, 999px on chips. Soft shadows only, 1px `--line` borders.
- "Character" moments (use sparingly): a subtle floral tapestry pattern (SVG, low opacity)
  in the Home header, the lesson-complete card and the empty archive state; thin steel-line
  dividers; amber glow on the streak.
- Icons: lucide-react, 1.75px stroke.
- Motion: short (150–250ms), feedback sheet slides up, correct answer gets a small pop.
- Respect `prefers-color-scheme` + manual toggle; respect `prefers-reduced-motion`.

---

## 7. Project structure

```
src/
  data/            words.json, verbs.json, sentences.json, topics.json
  lib/             db.ts (Dexie), search.ts, checkAnswer.ts, conjugate.ts, srs.ts, tts.ts
  features/
    search/  word/  exercises/  archive/  home/
  components/      ui primitives (Button, Card, Chip, Sheet, TabBar…)
  styles/          tokens.css
scripts/
  validate-data.ts
```

---

## 8. Build phases

- [x] **0. Setup** — Vite/React/TS, Tailwind, tokens, fonts, router, tab bar shell, PWA manifest + icons, deploy to Vercel.
- [x] **1. Data foundation** — types, seed dataset (~60 words, 20 verbs incl. ser/estar/tener/ir/hacer, 60 sentences, 8 topics), validation script.
- [x] **2. Search + word detail + conjugation tables + TTS.**
- [x] **3. Archive** — save/unsave, custom words, export/import.
- [x] **4. Exercises** — cloze → multiple choice → conjugation drill → sentence builder → translation. Shared lesson player + checkAnswer.
- [x] **5. SRS + Home** — ts-fsrs review sessions, due counter, streak, daily goal, attempts stats.
- [ ] **6. Content expansion** — target A1–A2: ~800 words, ~100 verbs, ~400 sentences, 15–20 topics. Generate in batches per topic, run validation after each batch, Adam spot-checks.
- [ ] **7. Optional** — DeepL fallback lookup via serverless function, more tenses (imperfecto, futuro), B1 content.

---

## 9. Working rules for Claude Code

- Work one phase at a time; at the end of a phase, summarize what changed and what to test on the phone.
- Keep components small and typed; no `any` in data code.
- All user-facing strings in Slovak, all Spanish content Mexican.
- Content quality matters more than quantity: natural everyday sentences, correct accents,
  Slovak translations that sound natural (not word-for-word).
- Run `npm run validate:data` after any data change, `npm test` after changing `src/lib` logic,
  and `npm run build` before finishing a phase.
- Test UI at 375px width first.

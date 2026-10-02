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
   - `imperfecto` (hablaba, era) and `futuro` (futuro simple: hablaré, tendré), added in phase 7
   Irregular forms highlighted (amber). Conjugation drill exercise.
3. **Vocabulary groups** — thematic topics (jídlo, cestovanie, práca, dom, telo, rodina,
   čas, počasie, oblečenie, mesto, škola, emócie, zdravie, nakupovanie, príroda…)
   plus grammar groups (false friends, verbs with prepositions, common phrases).
4. **Exercises** (lesson = ~10 tasks, filtered by type + topic + level):
   - **Cloze** — fill the missing word in the correct form (typed input)
   - **Multiple choice** — pick the correct word/form
   - **Sentence builder** — arrange shuffled word tiles into a correct sentence
   - **Translation SK → ES** — free typing, tolerant checking
   - **Conjugation drill** — "tener · yo · pretérito → ___"; the numbered lessons of one tense rotate the persons
     (10 verbs, every person twice; after 5 rounds each verb has had all persons)
   - **Slovná zásoba** — translate a word; each word is asked once, every other one towards Spanish
     (the opposite direction comes later in review, not in the next lesson)
   - **Diktát** — hear a sentence (🔊, 🐢 slower), type it; checked like translation
   - **Vyslovovanie** — read a sentence aloud; Chrome speech recognition (es-MX, online), word by word,
     ≤1 missed word in 5+ words = 🟡; 3 tries; "Teraz nemôžem hovoriť" drops the speaking tasks ahead (`speechMatch.ts`, `speech.ts`)
5. **Archive** — ⭐ saved words and sentences (star on word detail or in exercise feedback),
   user's **own custom words** (ES, SK, note, topic), and **Chyby** — exercises answered wrong,
   kept until the learner removes them. ⭐ + custom words are reviewed via spaced repetition; words practised in Slovná zásoba / Časovanie join too (auto review, daily limit in Nastavenia);
   mistakes are practised as a lesson. Export / import JSON backup (IndexedDB data + the numbered lessons'
   progress from localStorage, merged on import by `mergeProgression()`; settings are not backed up).
6. **Levels** — every word/verb/sentence tagged `A1 | A2 | B1…`. Content A1–A2, plus B1 since phase 7 (Cvičiť level filter: A1 / A2 / B1).

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
| PWA / offline | vite-plugin-pwa (precache app + all JSON data); `src/lib/pwa.ts` reloads into a new deploy by itself (waits while a lesson, review or form is open) and re-checks when the app returns to the foreground; Nastavenia show the build's commit |
| Local storage | Dexie (IndexedDB) — archive, custom words, SRS state, stats |
| Search | MiniSearch (or Fuse.js) with accent-folding normalization |
| Spaced repetition | ts-fsrs (FSRS algorithm) |
| Pronunciation | Web Speech API `speechSynthesis` (free, built into browser); `SpeechRecognition` (es-MX) for Vyslovovanie |
| Hosting | Vercel (free) |
| Online lookup | DeepL API Free via the Vercel function `api/translate.ts` (key only in the `DEEPL_API_KEY` env var, same-origin requests, ≤120 chars, ES-419 with ES fallback); `src/lib/translate.ts` caches results in Dexie `lookups`. Files in `api/` starting with `_` are not deployed (tests) |
| Reminders | Web Push: `api/reminder.ts` (Vercel function, `web-push`) keeps state in Upstash Redis and is called every 15 min by cron-job.org (`Authorization: Bearer CRON_SECRET`); env `VAPID_PRIVATE_KEY`, `CRON_SECRET`, Upstash `KV_REST_API_URL`/`KV_REST_API_TOKEN`. `public/push-sw.js` is imported into the service worker. One reminder a day, at most 2 h after the chosen time (never past 23:59), only while the daily goal is not met. A reminder that stops is silent, so it is made visible: each tick stores when it came and what it decided, `POST {type: "status"}` returns what the server knows (never the subscription), Nastavenia show it as "Stav pripomienky" (`reminderStatus.ts`), and Domov shows "Pripomienka nefunguje" (`reminderProblem()`) when Android took the permission back (e.g. the PWA was reinstalled → `lost`) or the device could not register. `keepReminderSynced()` re-registers at start and on return to the foreground |

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
  imperfecto: Record<Person, string>;
  futuro: Record<Person, string>;     // infinitive + é/ás/á/emos/án
  irregularForms?: string[];  // "presente.yo", "preterito.*", "futuro.*" → highlighted in UI
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
  grammar?: ('presente' | 'progresivo' | 'preterito' | 'imperfecto' | 'futuro' | 'ser-estar' | 'gender' | 'articles')[];
}

interface Topic { id: string; sk: string; es: string; icon: string; }

// Stored in IndexedDB (Dexie)
interface CustomWord { id: string; es: string; sk: string; note?: string; topic?: string; createdAt: number; }
interface SavedItem  { itemId: string; itemType: 'word' | 'verb' | 'custom' | 'sentence'; savedAt: number; }
interface ReviewCard { itemId: string; itemType: 'word' | 'custom' | 'sentence'; fsrs: Card /* ts-fsrs */; practised?: true; }
interface Attempt    { id?: number; exercise: string; itemId: string; correct: boolean; at: number; }
interface Mistake    { exercise: string; itemId: string; firstWrongAt: number; lastWrongAt: number; wrongCount: number; }
interface Lookup     { key: string; text: string; from: 'sk' | 'es'; translation: string; at: number; } // DeepL cache, not backed up
// exercise + itemId identify a lesson task: "s001#0" (cloze/choice), "tener:preterito:yo", "s004" (builder/translation);
// lesson.taskFromItem() rebuilds the task from them.
```

Spaced repetition (`src/lib/srs.ts`, `src/features/review/`):
- Every ⭐ word/sentence and every custom word has exactly one ReviewCard (created on save/add,
  removed on unsave/delete; `syncReviewCards()` repairs this at startup and after a backup restore).
- A card is "due today" when `due` ≤ end of the local day. Cards still due after rating
  (short relearning steps) come back later in the same session.
- Always read cards through `cardOf()` (ts-fsrs `TypeConvert`): JSON backups store dates as strings.
- Word and custom-word cards alternate the side shown first (`slovakFirst()` in `reviewQueue.ts`, odd `reps` =
  Slovak first, "Ako sa to povie po španielsky?"); decided when the session loads. Sentences are always Spanish first.
- A word card can be typed instead of revealed (`ReviewEntry.answers`, checked like Slovná zásoba, wrong tries can be
  fixed). A typed answer rates itself (`typedRating()`): right at once = Good, fixed after a hint = Hard, "Vzdať sa" =
  Again (the card returns in the session). "Ukázať preklad" keeps the four manual ratings; sentences are reveal-only.
- Words practised in Slovná zásoba / Časovanie get a card with `practised: true` (`src/lib/practice.ts`): the lesson
  answer is a review (Good / Again, no short-term steps, first answer per local day); `syncPracticeCards()` builds
  missing ones from past attempts after `syncReviewCards()`. Un-starring keeps a practised card.
- "Due today" always goes through `selectDue()`: practised-only words (not ⭐) are capped per day
  (`autoReview.ts`, default 20, switch in Nastavenia); review, Domov, Archív and the reminder share it.
- Every review is also an Attempt with `exercise: 'review'`; streak, daily goal and stats count all attempts.

A validation script (`npm run validate:data`) must check: unique ids, every `verbId`
exists, every topic exists, cloze `tokenIndex` in range and `tokens[tokenIndex] === answer`,
no `vosotros` forms, all 5 persons present.

Content conventions (types in `src/data/types.ts`, all enforced by `validate:data`):
- Word `id` = slug of `es` (lowercase, accents/¿?¡! stripped, spaces → `-`); collisions get `-2`: `papa` (zemiak), `papa-2` (papá).
- Every verb has exactly one Word (`pos: 'verb'`, `es` = `verbId` = infinitive, `id` = its slug: `extranar`); `wordIdByVerb` maps them.
- Homographs: the unaccented word gets the plain id (`el` article, `el-2` = él; `tu` / `tu-2` = tú; `que` / `que-2` = qué).
- Nouns ending in a consonant need `plural`, unless marked `uncountable: true` (el fútbol, la salud); plural-only nouns (ganas, lentes, papás, vacaciones) are listed in `PLURAL_ONLY` in `grammar.ts`.
- `irregularForms` lists exactly the forms that differ from the regular -ar/-er/-ir pattern
  (spelling changes count: `llegué` → `preterito.yo`); `regular` is true only when there are none;
  `gerundIrregular` likewise. Use `tense.*` when all 5 persons differ. Irregular imperfecto: only ser, ir, ver;
  irregular futuro stems: tendr-, podr-, saldr-, vendr-, dir-, har-, querr-, sabr-, pondr- (+ habr-, cabr-, valdr-).
- Reflexive verbs: forms include the pronoun (`me llamo`), `gerund` does not (`llamando`).
- Cloze hint for verbs: `"tener · yo · pretérito"` (tenses: presente, pretérito, imperfecto, futuro), `"hablar · gerundio"`, or `"ser/estar · él · presente"`
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
- A missing or an extra space ("nieje" for "nie je", "porfavor") is that one typo (`spacing`), unless the joined
  word is another known form ("porque" for "por qué").
- `diffWords()` aligns a wrong answer with the expected one word by word (ok / wrong / extra / missing) for the
  second-try hint (red / struck through / gap); a forgiven accent is ok, a meaning-changing one is wrong with `accent`.
  A one-word answer comes back as one wrong part; with several accepted answers (vocab, review) there is nothing to
  align, so the whole text is one wrong part (`wrongAsWhole()`).
- Translation SK → ES also accepts an extra leading subject pronoun (Yo hablo… for Hablo…) and offers
  "Moja odpoveď bola tiež správna" on ❌, since free translation has many valid answers.

---

## 5. Screens & navigation

Bottom tab bar (4 tabs): **Domov · Hľadať · Cvičiť · Archív**

- **Domov** — "¡Hola!" + date, hero "Na zopakovanie dnes" (big light serif N, words · sentences · minutes, round
  brick → button); with nothing due the hero becomes "Pokračuj v lekcii" (first unpassed lesson of the last played
  exercise/topic/level, `continueLesson.ts`). Streak | daily goal strip (goal as a leaf bar, taps into that lesson;
  streak turns amber "v ohrození" after 18:00 without practice), slovo dňa, "Precvičiť chyby" card,
  7-day chart with the daily goal as a dashed line.
  Quick search = round search button in the top bar (Home only; it focuses the Hľadať field).
- **Hľadať** — search input autofocused, results list (ES bold serif + SK muted), filter chips
  (všetko / slovesá / podstatné mená / frázy). Browse by topic below when input empty.
  Below the results: "Preložiť online" (DeepL, direction SK → ES / ES → SK guessed from the query) → "Pridať do Moje slová".
- **Detail slova** (`/word/:id`) — big serif Spanish word + 🔊, gender badge, translations,
  examples, note, conjugation table for verbs (scrollable tabs: presente · progresivo · pretérito · imperfecto · futuro;
  `TABLE_TENSES` in `conjugate.ts` is the single list for tabs, drill filter and task ids), ⭐ save.
  Opened from a list (topic, search, archive) it swipes / pages (‹ n/N ›, ← →) to neighbouring words. The swipe works
  anywhere in `main` (also in the empty space under a short word), but not when it starts on a bar that scrolls
  sideways (the tense tabs).
- **Cvičiť** — pick exercise type (cards), topic, level → lesson player → result screen.
  Each choice is a row of numbered lessons with fixed tasks (`getStablePool()`, 10 per lesson); the next lesson
  unlocks at 80 %. "Precvičiť chyby" card when mistakes exist.
- **Lekcia** — progress bar, one task per screen, big input / tiles, bottom "Skontrolovať" button,
  feedback sheet slides up (green / amber / red) with ⭐ (verb for conjugation, sentence otherwise).
  A wrong typed answer (cloze, conjugation, translation, vocab, dictation; `canRetry()`) is not final: `RetryHint`
  under the field repeats the checked answer with its wrong words and gaps marked, the learner fixes and checks again
  as often as needed, and the fixed answer counts as correct. "Vzdať sa" shows the answer and counts as wrong. After a
  wrong try "Vzdať sa" and "Skontrolovať" sit inside the hint (the open phone keyboard covers the bottom bar, which is
  hidden then). Every check must be visible: the hint shakes each time, since the same mistake leaves it unchanged.
  The accent keys under the field (á é í ó ú ñ ü ¿ ¡) are one row at any width.
  Wrong answers go to Chyby. Result: repeat mistakes / whole lesson / new lesson.
  A passed numbered lesson opens on `LessonOverview` (its tasks with the correct answers, those in Chyby marked)
  with "Zopakovať lekciu".
  `?mistakes=1` practises the mistakes list; a right answer asks "Nechať / Odstrániť".
- **Archív** — tabs Uložené / Moje slová / Chyby, search + topic filter, "Zopakovať" (SRS session),
  "+" add custom word, settings: export/import backup, theme, daily goal, automatic review (on/off, daily limit), practice reminder (push, time), TTS voice.

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
  data/            topics.json, types.ts, index.ts (merges the folders below via import.meta.glob)
    words/         one file per topic (food.json…) + verbs.json (the verb Words)
    sentences/     one file per topic
    verbs/         core.json (first 20), a1-a2.json, b1.json
  lib/             db.ts (Dexie), search.ts, checkAnswer.ts, conjugate.ts, srs.ts, tts.ts, reminder.ts (push reminder)
  features/
    search/  word/  exercises/  archive/  home/
  components/      ui primitives (Button, Card, Chip, Sheet, TabBar…)
  styles/          tokens.css
e2e/               browser tests of the screens (Playwright): lesson retry, review typing, word swipe
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
- [x] **6. Content expansion** — target A1–A2: ~800 words, ~100 verbs, ~400 sentences, 15–20 topics. Generate in batches per topic, run validation after each batch, Adam spot-checks.
  Result: 19 topics (incl. Základné slová, Čísla), 878 words, 100 verbs, 406 sentences (413 clozes).
- [x] **7. Optional** — DeepL fallback lookup via serverless function, more tenses (imperfecto, futuro), B1 content.
  7a imperfecto + futuro (all verbs, table, drill, search, 40 A2 sentences); 7b DeepL online lookup;
  7c B1: 37 verbs, 138 words, 68 sentences, topic "Technológie a médiá". Totals: 20 topics, 1053 words, 137 verbs, 514 sentences.
  Level rebalance: ~260 words, 13 verbs and 25 sentences re-tagged A1 → A2 (A1 = survival vocabulary, pretérito is A2);
  +69 B1 words, +84 B1 sentences (s515–s598), +20 verbs (10 A2, 10 B1) with their Words.
  Totals: 1142 words, 157 verbs (A1 63 · A2 47 · B1 47), 598 sentences (266 · 180 · 152).

---

## 9. Working rules for Claude Code

- Work one phase at a time; at the end of a phase, summarize what changed and what to test on the phone.
- Keep components small and typed; no `any` in data code.
- All user-facing strings in Slovak, all Spanish content Mexican.
- Content quality matters more than quantity: natural everyday sentences, correct accents,
  Slovak translations that sound natural (not word-for-word).
- Run `npm run validate:data` after any data change, `npm test` after changing `src/lib` logic,
  and `npm run build` before finishing a phase.
- Run `npm run test:e2e` after changing a screen (`src/features`, `src/components`) and before every push. It drives
  the installed Chrome at phone size with touch against its own dev server on port 5199 (`playwright.config.ts`);
  tests tap, they never click with a mouse. A bug found on the phone gets a test there before it is fixed.
  Vercel does not run these tests: nothing stops a push that skipped them.
- Test UI at 375px width first.

# Grammar tips ("Prečo?") — design

Date: 2026-10-02 · Status: approved in chat (scope B), awaiting spec review

## Goal

A wrong answer today shows the right one, but not the rule behind it. Adam typed "estamos de
Eslovaquia" and had nobody to ask why it is "somos". After a wrong answer the feedback gets a
**"Prečo?"** link that opens a short Slovak explanation of the rule with examples; for ser/estar
it also names the reason that applies in this very sentence. The same tips can be read on their
own as a small grammar handbook.

Non-goals: tips in review sessions, tips before the answer is settled (in the retry hint), a
per-sentence reason for anything but ser/estar, "practise this rule" drills, tips for vocabulary
tasks, a native-speaker review of the texts (Adam reads them after the deploy).

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| Scope | B: a general tip per grammar topic + a specific reason for the 60 ser/estar clozes |
| When the link shows | Only when the answer was wrong (also after "Vzdať sa"), and a tip exists for the task |
| Where the handbook lives | A "Gramatika" card on Cvičiť |
| Who writes the tips | Claude, in Slovak, with Mexican Spanish examples; checked by the data validator, read by Adam |

## What the learner sees

- **Feedback sheet, wrong answer.** A link with a lightbulb icon above "Pokračovať":
  "Prečo?" when the tip is about the very thing that was asked (cloze, choice, conjugation, an
  accent that changes the meaning), "Gramatika: pretérito" when it is only the sentence's grammar
  topic (builder, translation, dictation, speaking). No tip → no link (vocabulary, clozes with a
  vocabulary hint such as "oči").
- **The tip** opens over the lesson as a full-screen page with ✕. The lesson underneath is
  untouched: closing the tip (✕, Esc, or the phone's back button) returns to the same feedback
  sheet. Content, top to bottom:
  1. title ("ser a estar"),
  2. for a ser/estar cloze, a box **"V tejto vete"**: the Spanish sentence with the answer in
     bold and the rule's reason ("Ide o pôvod, preto ser."),
  3. a one- or two-sentence intro,
  4. the rules, each with a title, an optional line of text and 1–3 examples (ES in serif + 🔊,
     SK muted). ser/estar rules are grouped under "ser" and "estar"; the rule from the box is
     highlighted (amber left border) and scrolled into view,
  5. "Pozri aj": links to related tips (they open in the same overlay).
- **Handbook.** Cvičiť gets a card "Gramatika — krátke pravidlá s príkladmi" (under "Precvičiť
  chyby", above "Typ cvičenia") → `/practice/grammar`, a list of all tips (title + intro) →
  `/practice/grammar/:id`, the same tip content as a normal page with a back button. Both live
  inside the app layout, with the Cvičiť tab active.

## Content

Twelve tips in `src/data/tips.json`. Ids match the existing `Grammar` tags where one exists.

| id | Title (SK) | Covers |
|---|---|---|
| `ser-estar` | ser a estar | the rules below |
| `presente` | Prítomný čas | endings -ar/-er/-ir, stem changes (e→ie, o→ue, e→i), irregular yo (tengo, hago, salgo) |
| `preterito` | Pretérito (minulý čas dokonavý) | endings, common irregular stems (tuv-, hic-, fu-), spelling changes (llegué, busqué) |
| `imperfecto` | Imperfecto (minulý čas priebehový) | endings, the three irregular verbs (ser, ir, ver) |
| `preterito-imperfecto` | Pretérito alebo imperfecto? | one finished event vs. background, habit, description; signal words (ayer / siempre, de niño) |
| `futuro` | Budúci čas | infinitive + é/ás/á/emos/án, irregular stems; ir a + infinitive as the everyday alternative |
| `progresivo` | Priebehový čas | estar + gerundio, -ando / -iendo, irregular gerunds |
| `gender` | Rod podstatných mien | -o / -a, -ción / -dad feminine, exceptions (el día, la mano, el problema) |
| `articles` | Členy | el/la/los/las, un/una, al and del, when Spanish uses the article and Slovak has none |
| `adjectives` | Zhoda prídavných mien | gender and number agreement, position after the noun |
| `reflexive` | Zvratné slovesá | me/te/se/nos/se, where the pronoun goes |
| `accents` | Prízvuk, ktorý mení význam | el/él, tu/tú, si/sí, question words, hablo/habló |

`related`: preterito ↔ imperfecto ↔ preterito-imperfecto; presente → reflexive, progresivo;
gender ↔ articles ↔ adjectives; ser-estar → progresivo, adjectives.

**ser/estar rules** (rule ids; each has `verb` and a hand-written `because` sentence):

- ser: `identity` (kto alebo čo to je), `origin` (pôvod), `profession` (povolanie), `trait`
  (vlastnosť, opis), `time` (čas a dátum), `possession` (komu patrí, z čoho je), `event` (kde a
  kedy sa niečo koná)
- estar: `place` (poloha), `state` (stav, nálada, zdravie), `result` (výsledok deja: está
  abierto), `progressive` (estar + gerundio)

Every cloze with a `ser/estar · …` hint (60 today) gets `why: "<rule id>"`. If a sentence fits
none of the rules, a rule is added rather than a sentence forced into a wrong one.

## Code

### Data (`src/data/types.ts`, `src/data/index.ts`)

```ts
export interface TipRule {
  id: string // unique within its tip; a ser/estar cloze points at one with `why`
  title: string // Slovak: "Pôvod"
  text?: string // Slovak, one or two sentences
  examples: Example[] // 1–3
  verb?: 'ser' | 'estar' // ser-estar only: groups the rules, checked against the cloze's lemma
  because?: string // ser-estar only: "Ide o pôvod, preto ser."
}

export interface Tip {
  id: string
  title: string
  intro: string
  rules: TipRule[]
  related?: string[] // tip ids
}
```

`Cloze` gains `why?: string` (rule id in the `ser-estar` tip). `index.ts` exports `tips` and
`tipById`.

### New `src/lib/tips.ts` (pure, unit-tested)

```ts
export interface TaskTip {
  tip: Tip
  rule?: TipRule // ser/estar: the reason that applies in this sentence
  targeted: boolean // true → "Prečo?", false → "Gramatika: <title>"
}
export function tipFor(task: Task, grade: Grade): TaskTip | undefined
```

In this order:
1. `grade.check?.meanings` (an accent changed the meaning) → `accents`, targeted.
2. `cloze` / `choice`, by `cloze.hint`:
   `ser/estar · …` → `ser-estar` with `rule = cloze.why`;
   `<verb> · <person> · <tense>` → that tense's tip; `<verb> · gerundio` → `progresivo`;
   `člen`, `neurčitý člen` → `articles`; a hint starting with `prídavné meno` → `adjectives`;
   anything else → none. All targeted.
3. `conjugation` → the tip of `task.tense` (the five `TABLE_TENSES`), targeted.
4. `builder`, `translation`, `dictation`, `speaking` → the first of the sentence's `grammar`
   tags in the order ser-estar, imperfecto, preterito, futuro, progresivo, gender, articles,
   presente; not targeted, no rule. No tags → none.
5. `vocab` → none.

### UI

- `src/features/grammar/TipContent.tsx` — renders one tip (optional `rule` + `sentence` for the
  "V tejto vete" box, `onOpenTip(id)` for "Pozri aj"). Used by the overlay and the page.
- `src/features/grammar/TipSheet.tsx` — the overlay: `fixed inset-0`, scrollable, `role="dialog"`,
  `aria-modal`, ✕ focused on open, Esc closes.
- `src/features/grammar/GrammarPage.tsx` (list) and `TipPage.tsx` (one tip, `NotFound` for an
  unknown id); routes `practice/grammar` and `practice/grammar/:id` in `App.tsx`.
- `FeedbackSheet` gets `why?: { label: string; onOpen: () => void }` and shows the link when
  `grade.verdict === 'wrong'`.
- `LessonPage` computes `tipFor(task, grade)` and owns the overlay. **Back button:** opening the
  tip pushes a history entry with the same URL and `state: { tip: <id> }`; the overlay shows
  while `location.state.tip` is set, closing is `navigate(-1)`. The URL's search string does not
  change, so the lesson is not rebuilt (its filter is memoised on the search params). "Pozri aj"
  inside the overlay replaces the state instead of pushing, so one back press closes the tip.
- `PracticePage` gets the "Gramatika" card.

### Validator (`scripts/validate-data.ts`)

- tips: unique ids; non-empty `title`, `intro`; at least one rule; rule ids unique within a tip;
  1–3 examples per rule, each with `es` and `sk`; examples pass the existing Spanish checks (no
  vosotros, no Spain-only vocabulary); `related` ids exist and are not the tip itself.
- every `Grammar` tag has a tip with the same id.
- every rule of `ser-estar` has `verb` and `because`; no other tip's rule has them.
- a cloze whose hint starts with `ser/estar ·` must have `why` naming a `ser-estar` rule whose
  `verb` equals the cloze's `lemma`; `why` on any other cloze is an error.

## Testing

- `tips.test.ts`: each branch of `tipFor` (ser/estar cloze with its rule, tense hint, gerundio,
  člen, prídavné meno, vocabulary hint → none, conjugation per tense, sentence tasks by tag
  priority, no tags → none, vocab → none, accent meaning wins); over the whole dataset: every
  ser/estar cloze resolves to a rule, every tip id used by `tipFor` exists.
- `npm run validate:data` with the new checks (and a deliberately broken `why` while developing,
  to see the check fail).
- `e2e/grammar.spec.ts`: (1) a ser/estar cloze given up → "Prečo?" → the dialog shows
  "V tejto vete" with the rule's reason; the browser's back closes it and the same task's
  feedback sheet is still there, the lesson counter unchanged; (2) a right answer shows no
  link; (3) Cvičiť → Gramatika lists 12 tips, one opens, "Pozri aj" leads to another.
- `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`.
- Phone: the link's tap target above "Pokračovať", the overlay's scroll, the back gesture, 🔊 on
  the examples, dark and light theme; Adam reads the twelve tips.

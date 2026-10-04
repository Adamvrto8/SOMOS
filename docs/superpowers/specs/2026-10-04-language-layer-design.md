# Language layer (Slovak / English) — design

Date: 2026-10-04 · Status: design approved by Adam in chat, spec awaiting his review

## Goal

SOMOS is Adam's personal app and teaches Spanish from Slovak only. He wants to expand it and keep
the door open to publishing it later, most likely on Google Play. Someone who does not read Slovak
needs both the interface and the teaching content in English. This project builds the mechanism:
one "Jazyk" setting that switches the interface and the content between Slovak and English, with
Slovak shown wherever English content does not exist yet.

The English content itself is the next project. Making the server side fit for many users
(reminders keep a single subscription, the DeepL key is shared) and the publication work
(onboarding, privacy policy, store listing; Vercel's free plan is non-commercial) come after that.
Each gets its own spec.

Non-goals here: translating the vocabulary, sentences and grammar tips (one topic is translated as
a sample only), more than two languages, separate settings for interface and content language,
progress kept per language, a native-speaker review, anything store-related.

## Decisions (from the brainstorm)

| Question | Decision |
|---|---|
| What "publication" means | Not decided; nothing for a store now, nothing that would rule one out. Leaning to Google Play, which takes this PWA in a wrapper |
| One setting or two | One: "Jazyk" switches interface and content together |
| Progress | Shared: lessons, mistakes, review cards and the streak measure Spanish, not the language it is taught in |
| English content incomplete | The switch is visible from the start; a word or sentence without English shows its Slovak |
| Interface texts | Own typed dictionaries, no library |
| Content | English in separate files next to the data, matched by id; today's files stay untouched |
| English variety | American, to go with Mexican Spanish |
| Default language | From the phone: Slovak for a Slovak or Czech system, English for anything else. Adam's phone stays Slovak |

## 1. The setting

`src/lib/language.ts`, built like `dailyGoal.ts`: a value `'sk' | 'en'` in localStorage
(`somos-language`), `getLanguage()` for code outside React, `useLanguage()` through
`useSyncExternalStore`, `setLanguage()`. With nothing stored the language comes from
`navigator.languages`: Slovak when its first entry starts with `sk` or `cs`, English otherwise. The default is not written to storage, so a phone whose system language changes follows it
until the learner chooses.

Nastavenia get a "Jazyk" row (Slovenčina / English). The change applies at once, without a reload.
`<html lang>` follows the setting. The language is part of the settings backup
(`settingsBackup.ts`) and is restored with the rest.

## 2. Interface texts

- `src/i18n/sk.ts` is the model: one object, keys grouped by screen (`home`, `search`, `word`,
  `lesson`, `review`, `archive`, `settings`, `grammar`, `common`). `src/i18n/en.ts` is typed as
  the same shape, so a key missing in English does not compile.
- `useT()` returns the dictionary of the current language for components; `t()` does the same
  outside React (the generated reasons in `tips.ts`, error texts in `reminder.ts`).
- Texts with a number are functions in the dictionary (`days(n)`, `words(n)`): Slovak has three
  plural forms, English two. `pluralSk` stays as the Slovak helper; English gets its own.
- Dates and weekday names are formatted with the locale of the language (`sk-SK` / `en-US`).
- Text that is content, not interface, stays out of the dictionaries: Spanish is never translated,
  topic names and grammar tips come from the data layer (section 3).

Screens are converted one part of the app at a time: shared components and Domov, Hľadať and word
detail, the exercises, review, Archív and Nastavenia, grammar. After each part the app works and
the Slovak version looks exactly as before; the existing browser tests guard that.

## 3. Content: the English overlay

Today's files in `src/data/` do not change. English lives in `src/data/en/` with the same layout:

```
src/data/en/
  words/       one file per topic, same names as src/data/words/
  sentences/   one file per topic
  verbs/       core.json, a1-a2.json, b1.json
  topics.json
  tips.json    the whole handbook, rewritten for an English speaker
```

An overlay entry is matched by `id` and carries only what is language:

```ts
interface WordEn     { id: string; en: string[]; examples?: string[]; note?: string } // examples in the word's order
interface VerbEn     { id: string; en: string[] }
interface SentenceEn { id: string; en: string; hints?: (string | null)[] }           // one per cloze, null = keep
interface TopicEn    { id: string; en: string }
```

`tips.json` in English is a full `Tip[]` with the same tip ids and rule ids as the Slovak one, so
`tipFor()` picks a rule once and it exists in both languages. It is all-or-nothing per tip: a tip
missing in English shows in Slovak.

`src/lib/localized.ts` is the only place that knows there are two languages. It answers in the
current language and falls back to Slovak per field:

- `wordTranslations(word)`, `wordExamples(word)`, `wordNote(word)`
- `verbTranslations(verb)`
- `sentenceTranslation(sentence)`, `clozeHint(sentence, index)`
- `topicName(topic)`, `localizedTip(id)`

The 25 files that read `.sk` today go through these functions. The base field keeps its name `sk`.
Custom words (Moje slová) are untouched: the learner writes the translation in whatever language
they want.

Both languages are bundled and precached: the overlay is text of roughly the size of the Slovak
strings, and the app has to switch offline.

## 4. What depends on the language

- **Vocabulary and review, Spanish → the learner's language.** The accepted answers are the
  translations in the current language. English answers get their own tolerance: a leading "to"
  on verbs and a leading "the" / "a" / "an" on nouns may be given or left out. Task ids stay as
  they are (`de-nada:es-sk`): the id names a direction, not a language, and renaming it would
  orphan stored progress.
- **Cloze hints.** Shown in the current language; `tipFor()` keeps reading the base hint from the
  data (`"člen"`, `"prídavné meno: …"`, `"tener · yo · pretérito"`), so a translated hint cannot
  break the choice of the tip.
- **Reasons in "Prečo?".** The sentences built in `tips.ts` move to the dictionaries as functions
  (`regularVerb(verb, group)`, …). The logic that picks the rule stays single. A ser/estar rule's
  `because` comes from the localized tip.
- **Search.** The index is built from the translations of the current language (with the Slovak
  fallback) and rebuilt when the language changes.
- **Online lookup.** In English the direction is EN ↔ ES. `api/translate.ts` accepts
  `from: 'sk' | 'en' | 'es'` and a target language; the cache key in Dexie `lookups` already
  starts with the source language and gets the target added so the two pairs do not mix.
- **Reminder.** The subscribe request carries the language; `api/reminder.ts` stores it with the
  subscription and composes the notification in it. Both sets of texts live in that file, which
  has to stay a single file for Vercel. A stored subscription without a language is Slovak.
- **Speech.** TTS, speech recognition and the checking of Spanish answers do not change.

## 5. Validation and tests

- **Compiler:** `en.ts` must have the shape of `sk.ts`.
- **`validate:data`:** every overlay id exists in the base data, no id twice, `examples` has the
  length of the word's examples, `hints` the length of the sentence's clozes, the English tips
  have the same tip and rule ids as the Slovak ones and 1–3 examples per rule. It prints how much
  is translated per topic. Missing English is not an error.
- **Unit tests:** `localized.ts` (English entry, fallback per field), the default language from
  `navigator.languages`, the tolerance for English answers, the reminder's message in both
  languages, the settings backup carrying the language.
- **Browser tests:** the existing ones run in Slovak and none of them changes. New ones in English:
  switching the language in Nastavenia changes the tab bar and Domov at once; a lesson and a
  "Prečo?" in English; a word without English shows its Slovak translation.

## 6. Order of work

1. The setting, the dictionaries, and the first screens (shared components, Domov, Nastavenia).
   From here on the switch works on the phone.
2. The remaining screens, part by part.
3. The overlay, `localized.ts`, the validator, and one topic translated as a sample to prove the
   chain from file to screen.
4. Everything in section 4.

Each step ends with the unit tests, the build, the browser tests, a push, and Adam's test on the
phone. Step 2 touches nearly every screen; it is mechanical, but it is most of the work.

## Risks

- **The Slovak app changing by accident.** Moving 670 strings invites typos. The existing browser
  tests assert Slovak texts and stay untouched; the conversion goes part by part so a difference
  is found close to its cause.
- **English shown half-translated.** Accepted by decision: until the content project is done, an
  English screen can show Slovak translations.
- **The English tips.** They explain Spanish to an English speaker, which is a different text from
  the Slovak one (articles exist in English, the false friends differ). Written in the content
  project, not here; this project only makes room for them.

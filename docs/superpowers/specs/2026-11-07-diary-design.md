# Denník: a daily diary in Spanish (design)

Written 2026-11-07 with Adam (roadmap `docs/superpowers/plans/2026-11-03-after-part-c-roadmap.md` §4a.3).

## 1. Goal

A place to write every day: what I learned today, and a few sentences in Spanish about what I did. Writing is one
more way to practise; the app marks Spanish words it does not know, offline and free. For the learner only, not shared.

Decided by Adam:
- A diary: one entry per day. Free notes beside it come later, not in this version.
- Checking: unknown words underlined, offline (no DeepL, no grammar check).
- Where: a card on Domov; the whole diary opens from it.
- Two fields per day: "Čo som sa dnes naučil" (any language, not checked) and "Po španielsky" (checked).
- The diary does not count toward the daily goal or the streak.
- Stored on the device, synced record by record with the account, carried by the JSON backup.

Out of scope: free notes, a diary streak, DeepL translation of an entry, grammar checking, counting toward the goal.

## 2. Screens

### Domov card "Denník"
Below the main card (path step or lesson).
- No entry today: title "Dnešný zápis", the day's prompt in Spanish with its translation (e.g. *¿Qué hiciste hoy?* ·
  Čo si dnes robil?), button "Napísať" → `/diary/<today>`.
- An entry today: "Dnešný zápis ✓" and the first line of the Spanish field (or of the other field when Spanish is
  empty); the card opens the entry. A link "Všetky zápisy" → `/diary`.

### Entry (`/diary/:date`, date `YYYY-MM-DD`)
- Header: back arrow, the date in words ("Sobota 7. novembra"), a quiet "Uložené" after a save.
- Field "Čo som sa dnes naučil": textarea, the UI language, no check.
- Field "Po španielsky": textarea, `lang="es"`, `spellcheck={false}` (the phone's Slovak spellchecker would mark
  everything), auto-capitalised sentences.
- Below it, "Kontrola": the Spanish text again with unknown words underlined in amber, refreshed when typing pauses
  (~600 ms). A textarea cannot underline its own text, so the check is a separate block.
  - Tap an underlined word: a small sheet "Toto slovo nepoznám", with up to two suggestions when the word matches a
    known form apart from accents and ñ ("manana → mañana").
  - Tap a known word that has a page: its word detail (a verb form opens the verb: *tengo* → *tener*).
- Saving is automatic: debounced ~800 ms after typing and on leaving the page; no save button. While an entry is open
  the app does not reload itself into a new deploy (`src/lib/pwa.ts` busy state, as lessons and forms).
- Both fields empty after editing → the day is removed.
- An invalid or future date in the URL → back to `/diary`.

### Diary (`/diary`)
- "Dnes" first (written or not), then the days with an entry, newest first: the date and the first line.
- Every day opens and can be edited.

## 3. Data

```ts
interface DiaryEntry {
  date: string      // local day "2026-11-07", primary key
  learned: string   // Čo som sa dnes naučil, ≤ 5000 characters
  es: string        // Po španielsky, ≤ 5000 characters
  createdAt: number
  updatedAt: number
}
```
- Dexie version 5: table `diary: 'date, updatedAt'`.
- "Today" is the device's local date, as for the daily goal (`src/lib/dates.ts`).
- Fields are cut to 5000 characters on save (the textareas also carry `maxLength`).

### Sync
- New table kind `diary` (`src/lib/sync/kinds.ts`), key = date. Every save goes to the outbox; a removed day goes out
  as a deletion. The newer `changedAt` wins, as for custom words.
- Sign-out and account deletion take the entries off the device with the other learner data; the first sign-in adopts
  the entries already there.
- Server (`supabase/schema.sql`): `'diary'` added to the `records_kind` constraint (drop and re-create it: the
  `if not exists` guard would keep the old one) and to the kind filter in `push_records`.
  **Adam runs this SQL before the push**: today the server skips an unknown kind silently and the app would treat
  the entries as sent, so entries written in between would never reach the server.

### Backup
- `Backup.diary?: DiaryEntry[]` (missing in backups made before 2026-11-07). Import merges by date; the newer
  `updatedAt` wins. Invalid rows are skipped and counted like other skipped rows.

### Privacy
- The privacy policy gets one sentence: diary entries are stored on the server with the account, readable only by
  the account holder (row level security, as all records).

## 4. Word check (`src/lib/diaryCheck.ts`)

A pure module with unit tests, no UI.
- Split the Spanish text into segments: words (Unicode letters, with an inner apostrophe or hyphen) and everything
  else, so the check renders the text exactly as written.
- A word is known when `lookupForm(word)` finds it (every form in the dataset, all levels, the learner's variant:
  Spain adds vosotros) or it is one of the learner's custom words (Moje slová, Spanish side).
- Never underlined: numbers; a capitalised word that is not the first of a sentence (names: Juan, Monterrey).
- Suggestions: an index of known forms by their folded spelling (lowercase, accents and ñ stripped); an unknown word
  whose folded spelling matches gets up to two of them.
- Not caught, by design: a real word in the wrong place (*esta* for *está*). Only grammar could tell them apart.
- Link: a word whose spelling is a dictionary word's `es` opens `/word/<id>`; a verb form opens its verb's word
  (the infinitive from the form's description, through `wordIdByVerb`). Other known words have no link.

## 5. Prompts

About 30 short questions in Spanish with Slovak and English translations (*¿Qué comiste hoy?*, *¿Con quién
platicaste?*, *¿Qué palabra nueva aprendiste?*…), in `src/data/diaryPrompts.json`. The day's prompt is picked by the
day of the year. `validate:data` checks them like sentences: Mexican vocabulary (no Spain-only words), no `vosotros`,
unique ids, both translations present.

## 6. Code

- `src/lib/db.ts`: `DiaryEntry`, version 5.
- `src/lib/diary.ts`: `useDiaryEntry(date)`, `useDiaryEntries()`, `saveDiaryEntry()`, `todayKey()`, outbox calls.
- `src/lib/diaryCheck.ts` (+ test).
- `src/lib/sync/kinds.ts`, `stores`/table plumbing for the new kind; `src/lib/backup.ts` export, import, merge.
- `src/features/diary/`: `DiaryCard.tsx` (Domov), `DiaryPage.tsx` (list), `DiaryEntryPage.tsx` (editor),
  `DiaryCheck.tsx` (the rendered check and the word sheet).
- Routes `/diary` and `/diary/:date`; texts in `sk.ts` and `en.ts` (section `diary`).
- `supabase/schema.sql`, the privacy policy text.

## 7. Tests

- Unit: `diaryCheck` (unknown word, a name, the mañana suggestion, a verb form linking to its verb, a custom word,
  Spain vosotros known only in the Spain variant); backup merge (newer wins, invalid row skipped, old backup without
  `diary`); the `diary` sync kind (key, deletion).
- E2E at 375 px: Domov card → write both fields → reload → text kept → card shows ✓ and the first line; `/diary` lists
  the day; clearing both fields removes it; an unknown word is underlined and its sheet shows the suggestion; a backup
  carries an entry to a fresh device.
- `validate:data`, `npm test`, `npm run build`, `E2E_PORT=5299 npm run test:e2e` before the merge.

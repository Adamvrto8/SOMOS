# Reporting wrong content ("Nahlásiť chybu") — design

Date: 2026-10-25 · Status: approved by Adam in chat (every learner may report; a list in the app; fixes go through Claude)
Builds on: [2026-10-25-usage-stats-design.md](2026-10-25-usage-stats-design.md) (Vercel function + Supabase, `usage_admins`,
the dev-tools page pattern).

## Goal

All content (words, verbs, sentences, translations) was written by Claude and never checked by a native speaker
(CLAUDE.md §8: the most important check before a public release). Learners — Adam, a native speaker he asks, and later
the public — flag a sentence, word or verb form as wrong right where they see it. Adam reads the reports in the app,
copies the open ones into a Claude session, Claude fixes the JSON data, and Adam marks the reports as handled.

Non-goals: a systematic review mode (topic by topic, "checked" marks), answering the reporter, e-mail notifications,
reports on grammar tips, tests or duels (they show the same sentences as lessons), editing content in the app.

## Decisions

1. **Every learner can report**, with or without an account. Anonymous like the usage statistics: no account, e-mail
   or IP stored.
2. **Two places**: the lesson's feedback sheet (after "Skontrolovať", every exercise type) and Detail slova, each a
   flag button next to ⭐.
3. **Through a Vercel function `api/report.ts`** (same-origin, rate limit per hashed IP via `push_rate_hit`, strict
   validation), into Supabase `content_reports`. Sent at once; offline the sheet says it failed and keeps the note.
4. **The report keeps a snapshot** of what the learner saw (Spanish text and translation), so it still makes sense after
   the content changes.
5. **Read and handled by the accounts in `usage_admins`** (the same admin list as the statistics) through `security
   definer` functions; nobody reads the table directly.
6. **To Claude by copy-paste**: "Kopírovať pre Clauda" puts the open reports on the clipboard as text. Claude has no
   access to Supabase.

## What is reported

The target, from the task or the page:

| where | `target` | `detail` |
|---|---|---|
| cloze, choice | `sentence:<id>` | the cloze index (`0`) |
| builder, translation, dictation, speaking | `sentence:<id>` | — |
| vocab | `word:<id>` | direction (`sk-es` / `es-sk`) |
| conjugation | `verb:<id>` | `<tense>:<person>` (`preterito:yo`) |
| Detail slova | `word:<id>` | — |

Plus:
- `exercise`: the exercise type, or `word` for Detail slova;
- `reason`: `spanish` (Chyba v španielčine) · `translation` (Zlý alebo neprirodzený preklad) · `answer` (Moja odpoveď mala
  byť uznaná) · `other` (Iné); `answer` is offered only in a lesson, after an answer;
- `note`: optional, ≤ 500 characters, trimmed;
- `answer`: the learner's answer, only with reason `answer` (≤ 200 characters; builder tiles joined with spaces);
- `shown`: `{ es, translation }` as on screen (≤ 300 characters each): the sentence and its translation, the word with
  its translations, or the verb form with `tener · yo · pretérito`;
- `version` (build commit) and `language` (sk / en). The server adds `created_at`.

## Client

- `src/lib/contentReport.ts`: `reportTarget(task)` / `wordTarget(word)` build target, detail, exercise and shown;
  `sendReport(report)` posts to `/api/report` and resolves `'sent' | 'failed' | 'too-many'`.
- `ReportButton` (flag icon, `aria-label` "Nahlásiť chybu") opens `ReportSheet`: the question "Čo je zle?", the reasons
  as a radio list, the note field, "Odoslať" (disabled until a reason is picked) and "Zrušiť". While sending the
  button is busy; then "Ďakujeme, pozrieme sa na to." and the sheet closes after a moment; on failure "Nepodarilo sa
  odoslať. Skús to znova." with the choices kept; 429 says "Priveľa hlásení, skús to neskôr."
- The sheet sits above the lesson's feedback sheet and does not change the lesson: reporting is not an answer, and the
  lesson goes on with "Pokračovať" as before.
- A device remembers which targets it reported today (localStorage, per day) and shows the flag as filled: a second
  report of the same item the same day is still possible, the filled flag just says it was sent.

## Server — `api/report.ts`

- `POST` only, same-origin, body ≤ 8 KB. Validation: target `^(sentence|word|verb):[a-z0-9-]{1,60}$` (sentence ids
  `s001`…, word ids slugs, verb ids infinitives — all match), detail `^[a-z0-9:#-]{0,40}$`, exercise one of the types
  or `word`, reason one of the four, `answer` only with reason `answer`, lengths as above, language sk | en, version
  1–40 characters. Anything else → 400.
- Rate limit `push_rate_hit('report:' + hash(ip), 20)` per hour → 429.
- Insert with the service role key → 204. No local imports; tests in `api/_report.test.ts`.

## Database — `supabase/schema.sql`

```sql
content_reports (id bigint identity, target text, detail text, exercise text, reason text, note text, answer text,
                 shown jsonb, version text, language text, created_at timestamptz default now(),
                 status text default 'open' check (open | fixed | rejected), handled_at timestamptz)
  index on (status, target)
```

RLS on, no policies; `service_role` inserts. Functions, `security definer`, only for `usage_admins` (else `forbidden`),
granted to `authenticated`:
- `content_reports_list(p_status text)` → jsonb array of the reports with that status (`open`, or `handled` = fixed and
  rejected), newest first, at most 500;
- `content_reports_handle(p_target text, p_status text)` → sets `status`, `handled_at` on every report of the target
  that is `open` (for `fixed` / `rejected`), or back to `open` for handled ones (`p_status = 'open'`).

`push_cleanup()` also deletes handled reports older than 12 months.

## The page — Profil → Nástroje pre vývoj → Nahlásený obsah

- Tabs **Otvorené (N)** / **Vybavené**. Reports grouped by `target`, groups ordered by count, then newest report.
- A group: the target in words ("Veta s123", "Slovo casa", "Sloveso tener"), the snapshot of the newest report, and the
  current content when it differs (looked up in the bundled data; "už neexistuje" when the id is gone); a link to
  Detail slova for words. Under it every report: reason, detail (cloze index, verb form, direction), note, the
  learner's answer, date.
- Buttons **Opravené** and **Nie je chyba** (open tab) or **Vrátiť medzi otvorené** (handled tab) for the whole group.
- **Kopírovať pre Clauda** (open tab): a plain-text list, one block per group: target, detail, snapshot, current text,
  and each report's reason, note and answer.
- Not signed in → "Hlásenia vidí iba prihlásený správca."; not an admin → "Tento účet nemá prístup."; failed → retry.

## Privacy policy

"Hlásenia chýb v obsahu": what a report contains (the item, what you chose and wrote, your answer when you send it,
app version and language), not linked to an account, kept until handled and then at most 12 months. Legal basis:
legitimate interest in correct content. The English twin too.

## Setup for Adam

Run `supabase/schema.sql` again in the SQL Editor (docs/content-reports-setup.md). Nothing else: the admin list and the
Vercel keys are already there.

## Testing

- Unit: `contentReport.test.ts` (targets for every task kind and the word page, snapshot text, answer only with its
  reason, lengths cut); `api/_report.test.ts` (validation, same-origin, rate limit, rows written); the copy-text
  builder.
- E2E: report from the lesson's feedback sheet (fake `/api/report` via `page.route`, the body has the right target
  and reason; the lesson goes on); report from Detail slova; the failure message keeps the note; the admin page with a
  fake Supabase lists a group, "Opravené" calls the handle function, a non-admin sees "Tento účet nemá prístup.".
- The SQL checked in PGlite as for the statistics.

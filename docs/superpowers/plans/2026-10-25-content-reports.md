# Reporting Wrong Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any learner flags a sentence, word or verb form as wrong from a lesson's feedback sheet or Detail slova; Adam reads, copies and handles the reports on a dev-tools page.

**Architecture:** `src/lib/contentReport.ts` turns a task or a word into a report subject (target, detail, snapshot) and posts the report to `api/report.ts`, which validates it and inserts it into Supabase `content_reports`. Admin-only `security definer` functions list and handle reports; `src/features/settings/ContentReports.tsx` groups them by target, shows current content from the bundled data and copies the open ones as text for Claude.

**Tech Stack:** React + TypeScript (Vite), Vercel functions, Supabase Postgres via PostgREST, Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-10-25-content-reports-design.md](../specs/2026-10-25-content-reports-design.md)

## Global Constraints

- UI strings in Slovak (`src/i18n/sk.ts`) with the English twin (`src/i18n/en.ts`, `Dictionary = typeof sk`); code and comments in English.
- No account, e-mail or IP in a report; the request to `/api/report` carries no Authorization header.
- Reasons exactly `spanish` · `translation` · `answer` · `other`; `answer` only offered in a lesson after an answer, and the learner's answer is sent only with that reason.
- Limits: note ≤ 500, answer ≤ 200, each snapshot field ≤ 300 characters, body ≤ 8 KB, 20 reports per IP per hour.
- Target `^(sentence|word|verb):[a-z0-9-]{1,60}$`, detail `^[a-z0-9:-]{0,40}$`.
- Admin = an account in `usage_admins`; everyone else gets `forbidden`.
- Handled reports deleted after 12 months by `push_cleanup()`; open ones stay.
- `api/*.ts` without local imports; tests `api/_*.test.ts`.
- Stage explicit paths only; never `CLAUDE.md`, `.gitignore`, `docs/accounts-setup.md`, `poznaky.txt`.
- Before pushing: `npm run lint`, `npm run validate:data`, `npm test`, `npm run build`, `npm run test:e2e -- --workers=2`.

## Review Focus

- A word, verb or sentence id the server's target pattern rejects would make every report on it fail → a unit test checks every id in the dataset against the pattern (Task 2).
- Reporting must not disturb the lesson: the feedback sheet's "Pokračovať", the lesson's answer and the mistakes list stay as they were → the e2e test continues the lesson after reporting (Task 3).
- Offline / server error must not lose what the learner typed → e2e: a failed send keeps the reason and the note (Task 3).
- A report on content that has since changed or been removed must still be readable → `currentContent` test for a missing id and the page shows "už neexistuje" (Task 4).
- The flag on Detail slova must not crowd the title at 375 px (long words already shrink for two buttons) → the word page gets the report as a text button at the end of the page, not a third header button (Task 3; deviation from the spec's "next to ⭐", told to Adam).

---

### Task 1: Server — table, admin functions, `api/report.ts`

**Files:**
- Modify: `supabase/schema.sql` (new section before "Practice reminders", one line in `push_cleanup`)
- Create: `api/report.ts`, `api/_report.test.ts`

**Interfaces:**
- Produces: `POST /api/report` body `ReportBody` → 204 · 400 · 403 · 405 · 413 · 429 · 500 · 503.
- Produces (SQL): `content_reports_list(p_status text) returns jsonb` (array of `StoredReport`, Task 4), `content_reports_handle(p_target text, p_status text) returns integer`.

- [ ] **Step 1: Schema.** Before `-- Practice reminders, one row per device` (after the usage section) add:

```sql
-- ---------------------------------------------------------------------------------------------------------
-- Reports of wrong content ("Nahlásiť chybu", docs/superpowers/specs/2026-10-25-content-reports-design.md).
-- Anonymous; only api/report.ts writes (service role); only accounts in usage_admins read and handle them.

create table if not exists public.content_reports (
  id bigint generated always as identity primary key,
  target text not null,                    -- sentence:s001, word:casa, verb:tener
  detail text not null default '',         -- cloze index, verb form (preterito:yo), vocab direction
  exercise text not null,                  -- the exercise type, or word (Detail slova)
  reason text not null,                    -- spanish, translation, answer, other
  note text not null default '',
  answer text,                             -- the learner's answer, only with reason answer
  shown jsonb not null,                    -- { es, translation } as the learner saw it
  version text not null,
  language text not null,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'fixed', 'rejected')),
  handled_at timestamptz
);
create index if not exists content_reports_status_target on public.content_reports (status, target);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant select, insert, update, delete on public.content_reports to service_role;

-- 'open', or 'handled' (fixed and rejected): newest first, at most 500.
create or replace function public.content_reports_list(p_status text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.usage_admins where user_id = (select auth.uid())) then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.created_at desc) from (
      select id, target, detail, exercise, reason, note, answer, shown, version, language, created_at, status, handled_at
      from public.content_reports
      where case when p_status = 'open' then status = 'open' else status <> 'open' end
      order by created_at desc limit 500) r), '[]'::jsonb);
end $$;

-- Every open report of a target becomes fixed / rejected, or every handled one open again ('open').
create or replace function public.content_reports_handle(p_target text, p_status text) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not exists (select 1 from public.usage_admins where user_id = (select auth.uid())) then
    raise exception 'forbidden';
  end if;
  if p_status is null or p_status not in ('open', 'fixed', 'rejected') then raise exception 'invalid'; end if;
  update public.content_reports
    set status = p_status, handled_at = case when p_status = 'open' then null else now() end
    where target = p_target and case when p_status = 'open' then status <> 'open' else status = 'open' end;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.content_reports_list(text), public.content_reports_handle(text, text) from public, anon;
grant execute on function public.content_reports_list(text), public.content_reports_handle(text, text) to authenticated;
```

In `push_cleanup()` after the usage line: `  delete from public.content_reports where status <> 'open' and handled_at < now() - interval '12 months';` and extend its comment ("…, handled content reports after 12 months").

- [ ] **Step 2: Failing tests** `api/_report.test.ts`:

```ts
// Underscore prefix: Vercel does not deploy this file as a function.
import { describe, expect, it, vi } from 'vitest'
import { handleReport, parseReport, REPORTS_PER_HOUR, type ReportDeps, type ReportRow } from './report.ts'

const REPORT = {
  target: 'sentence:s001',
  detail: '0',
  exercise: 'cloze',
  reason: 'spanish',
  note: 'Chýba prízvuk.',
  answer: null,
  shown: { es: 'Mi hermana está en casa.', translation: 'Moja sestra je doma.' },
  version: 'abc1234',
  language: 'sk',
}
const SAME_SITE = { origin: 'https://somos.app', host: 'somos.app' }
const post = (body: unknown, headers: Record<string, string> = SAME_SITE) =>
  new Request('https://somos.app/api/report', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })

function deps(over: Partial<ReportDeps> = {}) {
  const rows: ReportRow[] = []
  const d: ReportDeps = { insert: vi.fn(async (r: ReportRow) => void rows.push(r)), rateHit: vi.fn(async () => true), ipKey: () => 'report:x', ...over }
  return { d, rows }
}

describe('parseReport', () => {
  it('takes a report from a lesson, a word page and a verb form', () => {
    expect(parseReport(REPORT)).toEqual(REPORT)
    expect(parseReport({ ...REPORT, target: 'word:papa-2', detail: '', exercise: 'word', reason: 'translation', note: '' })).not.toBeNull()
    expect(parseReport({ ...REPORT, target: 'verb:levantarse', detail: 'preterito:yo', exercise: 'conjugation', reason: 'answer', answer: 'me levante' })).not.toBeNull()
    expect(parseReport({ ...REPORT, target: 'word:casa', detail: 'sk-es', exercise: 'vocab', reason: 'other' })).not.toBeNull()
  })

  it.each([
    ['an unknown kind of target', { target: 'tip:ser-estar' }],
    ['a target with spaces', { target: 'word:la casa' }],
    ['a bad detail', { detail: 'x y' }],
    ['an unknown exercise', { exercise: 'duel' }],
    ['an unknown reason', { reason: 'rude' }],
    ['an answer without its reason', { answer: 'hablo' }],
    ['a note over 500 characters', { note: 'x'.repeat(501) }],
    ['an answer over 200 characters', { reason: 'answer', answer: 'x'.repeat(201) }],
    ['a snapshot over 300 characters', { shown: { es: 'x'.repeat(301), translation: '' } }],
    ['a snapshot with more fields', { shown: { es: 'a', translation: 'b', user: 'c' } }],
    ['an extra field', { email: 'a@b.c' }],
    ['a bad language', { language: 'de' }],
    ['an empty version', { version: '' }],
  ])('refuses %s', (_, change) => {
    expect(parseReport({ ...REPORT, ...change })).toBeNull()
  })
})

describe('handleReport', () => {
  it('stores the report and answers 204', async () => {
    const { d, rows } = deps()
    expect((await handleReport(post(REPORT), d)).status).toBe(204)
    expect(rows).toEqual([REPORT])
  })

  it('refuses other sites, other methods, bad and big bodies', async () => {
    const { d } = deps()
    expect((await handleReport(post(REPORT, { origin: 'https://evil.example', host: 'somos.app' }), d)).status).toBe(403)
    expect((await handleReport(new Request('https://somos.app/api/report'), d)).status).toBe(405)
    expect((await handleReport(post('{'), d)).status).toBe(400)
    expect((await handleReport(post({ ...REPORT, reason: 'rude' }), d)).status).toBe(400)
    expect((await handleReport(post('x'.repeat(9000)), d)).status).toBe(413)
    expect(d.insert).not.toHaveBeenCalled()
  })

  it('stops at the hourly limit', async () => {
    const { d } = deps({ rateHit: vi.fn(async () => false) })
    expect((await handleReport(post(REPORT), d)).status).toBe(429)
    expect(d.rateHit).toHaveBeenCalledWith('report:x', REPORTS_PER_HOUR)
  })

  it('answers 500 when Supabase fails, and 503 without configuration', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { d } = deps({ insert: vi.fn(async () => Promise.reject(new Error('down'))) })
    expect((await handleReport(post(REPORT), d)).status).toBe(500)
    expect((await handleReport(post(REPORT), undefined)).status).toBe(503)
  })
})
```

- [ ] **Step 3:** `npx vitest run api/_report.test.ts` — FAIL (module not found).

- [ ] **Step 4: Implement** `api/report.ts` (same shape as `api/usage.ts`):

```ts
// Vercel function: reports of wrong content (docs/superpowers/specs/2026-10-25-content-reports-design.md).
//   POST /api/report from the app (same-origin): one report, see ReportBody.
// Stored in Supabase content_reports with the service role key. No account, no IP: the IP only counts the hourly
// limit, as a keyed hash in push_rate. Kept free of local imports so Vercel can deploy it as a single file.
import { createHmac } from 'node:crypto'

export const MAX_BODY = 8_000
export const REPORTS_PER_HOUR = 20
const REQUEST_TIMEOUT_MS = 8000

/** What the app sends; also the row of content_reports (the database adds id, created_at, status). */
export interface ReportBody {
  target: string
  detail: string
  exercise: string
  reason: 'spanish' | 'translation' | 'answer' | 'other'
  note: string
  answer: string | null
  shown: { es: string; translation: string }
  version: string
  language: 'sk' | 'en'
}
export type ReportRow = ReportBody

export interface ReportDeps {
  insert(row: ReportRow): Promise<void>
  rateHit(key: string, limit: number): Promise<boolean>
  ipKey(request: Request): string
}

// Mirrors src/lib/contentReport.ts.
const EXERCISES = ['cloze', 'choice', 'conjugation', 'builder', 'translation', 'vocab', 'dictation', 'speaking', 'word']
const REASONS = ['spanish', 'translation', 'answer', 'other']
const KEYS = ['target', 'detail', 'exercise', 'reason', 'note', 'answer', 'shown', 'version', 'language']

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max

/** The report, or null when anything in it is not as the app sends it. */
export function parseReport(body: unknown): ReportBody | null {
  if (!isRecord(body) || Object.keys(body).length !== KEYS.length || !KEYS.every((k) => Object.hasOwn(body, k))) return null
  const { target, detail, exercise, reason, note, answer, shown, version, language } = body
  if (typeof target !== 'string' || !/^(sentence|word|verb):[a-z0-9-]{1,60}$/.test(target)) return null
  if (typeof detail !== 'string' || !/^[a-z0-9:-]{0,40}$/.test(detail)) return null
  if (typeof exercise !== 'string' || !EXERCISES.includes(exercise)) return null
  if (typeof reason !== 'string' || !REASONS.includes(reason)) return null
  if (!text(note, 500)) return null
  if (reason === 'answer' ? !text(answer, 200, 1) : answer !== null) return null
  if (!isRecord(shown) || Object.keys(shown).length !== 2 || !text(shown.es, 300) || !text(shown.translation, 300)) return null
  if (!text(version, 40, 1) || (language !== 'sk' && language !== 'en')) return null
  return { target, detail, exercise, reason: reason as ReportBody['reason'], note, answer: answer as string | null, shown: { es: shown.es, translation: shown.translation }, version, language }
}

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

/** Browsers send Origin on POST: only pages of this same deployment may send reports. */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

export async function handleReport(request: Request, deps: ReportDeps | undefined): Promise<Response> {
  if (!deps) return json({ error: 'not-configured' }, 503)
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403)
  try {
    const body = await request.text()
    if (body.length > MAX_BODY) return json({ error: 'too-big' }, 413)
    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      return json({ error: 'bad-request' }, 400)
    }
    const report = parseReport(parsed)
    if (!report) return json({ error: 'bad-request' }, 400)
    if (!(await deps.rateHit(deps.ipKey(request), REPORTS_PER_HOUR))) return json({ error: 'too-many' }, 429)
    await deps.insert(report)
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('report failed', error)
    return json({ error: 'failed' }, 500)
  }
}

/** SUPABASE_URL, or the app's own VITE_SUPABASE_URL (Vercel gives functions every variable). */
export function depsFromEnv(env: Record<string, string | undefined>): ReportDeps | undefined {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.replace(/\/+$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY
  if (!url || !key) return undefined
  const call = async (path: string, body: unknown, prefer?: string) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`Supabase ${path} failed: ${res.status}`)
    return res
  }
  return {
    insert: async (row) => {
      await call('content_reports', row, 'return=minimal')
    },
    rateHit: async (rateKey, limit) => (await (await call('rpc/push_rate_hit', { p_key: rateKey, p_limit: limit })).json()) === true,
    // A keyed hash: the address cannot be got back from push_rate by trying every address.
    ipKey: (request) => {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
      return `report:${createHmac('sha256', `somos-report:${key}`).update(ip).digest('hex').slice(0, 32)}`
    },
  }
}

export function POST(request: Request): Promise<Response> {
  return handleReport(request, depsFromEnv(process.env))
}

export function GET(request: Request): Promise<Response> {
  return handleReport(request, depsFromEnv(process.env))
}
```

- [ ] **Step 5:** `npx vitest run api/_report.test.ts` — PASS; `npm run lint`.

- [ ] **Step 6: SQL check** in PGlite (scratchpad `pg/`, the stub script from the usage-stats work, extended): run schema.sql twice; as admin insert two reports for `sentence:s001` and one for `word:casa`, `content_reports_list('open')` returns 3, `content_reports_handle('sentence:s001','fixed')` returns 2, `list('open')` 1, `list('handled')` 2, `handle('sentence:s001','open')` returns 2; another account → `forbidden`; `handle(…,'bogus')` → `invalid`; a handled report with `handled_at` 13 months ago is deleted by `push_cleanup()`.

- [ ] **Step 7: Commit** `git add supabase/schema.sql api/report.ts api/_report.test.ts` — `feat(reports): content_reports table, admin functions and /api/report`.

---

### Task 2: Report subjects and sending — `src/lib/contentReport.ts`

**Files:**
- Create: `src/lib/contentReport.ts`, `src/lib/contentReport.test.ts`

**Interfaces:**
- Consumes: `POST /api/report` (Task 1).
- Produces: types `ReportReason`, `REPORT_REASONS`, `ReportSubject`, `ContentReport`; `taskSubject(task: Task): ReportSubject`; `wordSubject(word: Word): ReportSubject`; `answerText(answer: string | string[]): string`; `buildReport(subject, reason, note, answer: string | null): ContentReport`; `sendReport(report): Promise<'sent' | 'too-many' | 'failed'>`; `markReported(target)`, `reportedToday(target): boolean`; `TARGET_PATTERN`.

- [ ] **Step 1: Failing tests** `src/lib/contentReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sentences, verbById, verbs, wordById, words } from '../data'
import { answerText, buildReport, taskSubject, TARGET_PATTERN, wordSubject } from './contentReport'
import { createLesson, type Task } from './lesson'

const tasksOf = (type: Task['kind']) => createLesson({ type, topic: 'all', level: 'A1' }, 3, () => 0.5, new Map())

describe('report subjects', () => {
  it('names the sentence and the blank of a cloze task, with the sentence as seen', () => {
    const task = tasksOf('cloze')[0]
    if (task.kind !== 'cloze') throw new Error('cloze expected')
    const subject = taskSubject(task)
    expect(subject.target).toBe(`sentence:${task.sentence.id}`)
    expect(subject.detail).toBe(task.itemId.split('#')[1])
    expect(subject.exercise).toBe('cloze')
    expect(subject.shown.es).toBe(task.sentence.es)
    expect(subject.shown.translation).not.toBe('')
  })

  it('names the verb form of a conjugation task', () => {
    const task = tasksOf('conjugation')[0]
    if (task.kind !== 'conjugation') throw new Error('conjugation expected')
    expect(taskSubject(task)).toMatchObject({ target: `verb:${task.verb.id}`, detail: `${task.tense}:${task.person}`, exercise: 'conjugation', shown: { es: task.answer } })
  })

  it('names the word and direction of a vocab task, and the word of Detail slova', () => {
    const task = tasksOf('vocab')[0]
    if (task.kind !== 'vocab') throw new Error('vocab expected')
    expect(taskSubject(task)).toMatchObject({ target: `word:${task.word.id}`, detail: task.direction, exercise: 'vocab' })
    const casa = wordById.get('casa')!
    expect(wordSubject(casa)).toEqual({ target: 'word:casa', detail: '', exercise: 'word', shown: { es: 'la casa', translation: expect.stringContaining('dom') } })
  })

  it('every sentence, word and verb id fits the server pattern', () => {
    const targets = [...sentences.map((s) => `sentence:${s.id}`), ...words.map((w) => `word:${w.id}`), ...verbs.map((v) => `verb:${v.id}`)]
    expect(targets.filter((t) => !TARGET_PATTERN.test(t))).toEqual([])
    expect(verbById.size).toBeGreaterThan(0)
  })
})

describe('buildReport', () => {
  const subject = wordSubject(wordById.get('casa')!)

  it('sends the answer only with its reason, and trims the note', () => {
    expect(buildReport(subject, 'spanish', '  zlý rod  ', 'casa')).toMatchObject({ reason: 'spanish', note: 'zlý rod', answer: null })
    expect(buildReport(subject, 'answer', '', 'la casa')).toMatchObject({ reason: 'answer', answer: 'la casa' })
  })

  it('cuts the note, the answer and the snapshot to what the server takes', () => {
    const long = buildReport({ ...subject, shown: { es: 'x'.repeat(400), translation: 'y'.repeat(400) } }, 'answer', 'n'.repeat(600), 'a'.repeat(300))
    expect(long.note).toHaveLength(500)
    expect(long.answer).toHaveLength(200)
    expect(long.shown.es).toHaveLength(300)
    expect(long.shown.translation).toHaveLength(300)
  })

  it('joins builder tiles', () => {
    expect(answerText(['Yo', 'hablo', 'español', '.'])).toBe('Yo hablo español .')
    expect(answerText(' hablo ')).toBe('hablo')
  })
})
```

Check while writing: the real `createLesson` signature in `src/lib/lesson.ts` (`createLesson(filter, size, random, seen)`), the article helper used by Detail slova for `la casa` (if `wordSubject` should show the article, build it as `WordPage` does: `word.gender === 'm' ? 'el' : 'la'` for nouns), and `casa`'s Slovak translation (`dom`).

- [ ] **Step 2:** `npx vitest run src/lib/contentReport.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/contentReport.ts`:

```ts
import type { Sentence, Word } from '../data/types'
import { PERSON_LABELS, TENSE_LABELS } from './conjugate'
import { dayKey } from './dates'
import { getLanguage } from './language'
import type { ExerciseType, Task } from './lesson'
import { sentenceTranslation, wordTranslations } from './localized'

// "Nahlásiť chybu" (docs/superpowers/specs/2026-10-25-content-reports-design.md): what a report names, and sending
// it to api/report.ts. Anonymous: no account, nothing about the learner but what they chose and wrote.

export type ReportReason = 'spanish' | 'translation' | 'answer' | 'other'
export const REPORT_REASONS: ReportReason[] = ['spanish', 'translation', 'answer', 'other']

/** The server's pattern for a target (api/report.ts). */
export const TARGET_PATTERN = /^(sentence|word|verb):[a-z0-9-]{1,60}$/

export interface ReportSubject {
  target: string // sentence:s001, word:casa, verb:tener
  detail: string // cloze index, verb form, vocab direction
  exercise: ExerciseType | 'word'
  shown: { es: string; translation: string } // as on screen
}

export interface ContentReport extends ReportSubject {
  reason: ReportReason
  note: string
  answer: string | null
  version: string
  language: 'sk' | 'en'
}

const NOTE_MAX = 500
const ANSWER_MAX = 200
const SHOWN_MAX = 300

const sentenceShown = (sentence: Sentence) => ({ es: sentence.es, translation: sentenceTranslation(sentence) })
const wordShown = (word: Word) => ({
  es: word.gender ? `${word.gender === 'm' ? 'el' : 'la'} ${word.es}` : word.es,
  translation: wordTranslations(word).join(', '),
})

export function taskSubject(task: Task): ReportSubject {
  switch (task.kind) {
    case 'cloze':
    case 'choice':
      return { target: `sentence:${task.sentence.id}`, detail: task.itemId.split('#')[1] ?? '', exercise: task.kind, shown: sentenceShown(task.sentence) }
    case 'builder':
    case 'translation':
    case 'dictation':
    case 'speaking':
      return { target: `sentence:${task.sentence.id}`, detail: '', exercise: task.kind, shown: sentenceShown(task.sentence) }
    case 'vocab':
      return { target: `word:${task.word.id}`, detail: task.direction, exercise: 'vocab', shown: wordShown(task.word) }
    case 'conjugation':
      return {
        target: `verb:${task.verb.id}`,
        detail: `${task.tense}:${task.person}`,
        exercise: 'conjugation',
        shown: { es: task.answer, translation: `${task.verb.id} · ${PERSON_LABELS[task.person]} · ${TENSE_LABELS[task.tense]}` },
      }
  }
}

export function wordSubject(word: Word): ReportSubject {
  return { target: `word:${word.id}`, detail: '', exercise: 'word', shown: wordShown(word) }
}

/** The learner's answer as text: builder tiles joined with spaces. */
export function answerText(answer: string | string[]): string {
  return (Array.isArray(answer) ? answer.join(' ') : answer).trim()
}

export function buildReport(subject: ReportSubject, reason: ReportReason, note: string, answer: string | null): ContentReport {
  return {
    ...subject,
    shown: { es: subject.shown.es.slice(0, SHOWN_MAX), translation: subject.shown.translation.slice(0, SHOWN_MAX) },
    reason,
    note: note.trim().slice(0, NOTE_MAX),
    answer: reason === 'answer' && answer ? answer.slice(0, ANSWER_MAX) : null,
    version: __APP_VERSION__,
    language: getLanguage(),
  }
}

export async function sendReport(report: ContentReport): Promise<'sent' | 'too-many' | 'failed'> {
  try {
    const res = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) })
    if (res.ok) return 'sent'
    return res.status === 429 ? 'too-many' : 'failed'
  } catch {
    return 'failed'
  }
}

// Which targets this device reported today: the flag shows filled (a second report is still possible).
const REPORTED_KEY = 'somos-reported'

function readReported(): { day: string; targets: string[] } {
  try {
    const parsed = JSON.parse(localStorage.getItem(REPORTED_KEY) ?? 'null') as { day?: unknown; targets?: unknown } | null
    if (parsed && parsed.day === dayKey(new Date()) && Array.isArray(parsed.targets)) return { day: parsed.day, targets: parsed.targets.filter((t) => typeof t === 'string') }
  } catch {
    // Unreadable: nothing reported.
  }
  return { day: dayKey(new Date()), targets: [] }
}

export const reportedToday = (target: string) => readReported().targets.includes(target)

export function markReported(target: string) {
  const reported = readReported()
  try {
    localStorage.setItem(REPORTED_KEY, JSON.stringify({ day: reported.day, targets: [...new Set([...reported.targets, target])] }))
  } catch {
    // The flag just won't stay filled.
  }
}
```

`buildReport` reads `__APP_VERSION__` inside the function (Vitest has no such global at module load — but it also has none at call time). If the test fails on `__APP_VERSION__ is not defined`, make it `typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'` and ledger the ruling.

- [ ] **Step 4:** `npx vitest run src/lib/contentReport.test.ts` — PASS; `npm run lint && npx tsc -b`.

- [ ] **Step 5: Commit** `git add src/lib/contentReport.ts src/lib/contentReport.test.ts` — `feat(reports): what a report names, and sending it`.

---

### Task 3: The flag, the report sheet, lesson and Detail slova

**Files:**
- Create: `src/features/report/ReportSheet.tsx` (the sheet), `src/features/report/ReportButton.tsx` (flag + sheet state)
- Modify: `src/features/exercises/FeedbackSheet.tsx` (flag next to ⭐, new prop `learnerAnswer?: string`), `src/features/exercises/LessonPage.tsx` (pass `learnerAnswer={answerText(answer)}`), `src/features/word/WordPage.tsx` (text button at the end of the article), `src/i18n/sk.ts`, `src/i18n/en.ts`
- Test: `e2e/report.spec.ts`

**Interfaces:**
- Consumes: Task 2 (`taskSubject`, `wordSubject`, `buildReport`, `sendReport`, `markReported`, `reportedToday`, `answerText`, `REPORT_REASONS`).
- Produces: `<ReportButton subject={ReportSubject} answer?: string | null variant?: 'icon' | 'text' />`.

- [ ] **Step 1: Texts** — top-level `report` block in `sk.ts`:

```ts
  /** "Nahlásiť chybu" (src/features/report). */
  report: {
    button: 'Nahlásiť chybu',
    reported: 'Nahlásené',
    title: 'Čo je zle?',
    reasons: {
      spanish: 'Chyba v španielčine',
      translation: 'Zlý alebo neprirodzený preklad',
      answer: 'Moja odpoveď mala byť uznaná',
      other: 'Iné',
    },
    noteLabel: 'Poznámka (nepovinná)',
    notePlaceholder: 'Čo presne nesedí?',
    send: 'Odoslať',
    sending: 'Odosielam…',
    cancel: 'Zrušiť',
    thanks: 'Ďakujeme, pozrieme sa na to.',
    failed: 'Nepodarilo sa odoslať. Skús to znova.',
    tooMany: 'Priveľa hlásení, skús to neskôr.',
    privacy: 'Hlásenie je anonymné.',
  },
```

and in `en.ts`: `button: 'Report a mistake'`, `reported: 'Reported'`, `title: 'What is wrong?'`, reasons `Mistake in the Spanish` / `Wrong or unnatural translation` / `My answer should have been accepted` / `Other`, `noteLabel: 'Note (optional)'`, `notePlaceholder: 'What exactly is off?'`, `send: 'Send'`, `sending: 'Sending…'`, `cancel: 'Cancel'`, `thanks: 'Thank you, we will look at it.'`, `failed: 'Could not send. Try again.'`, `tooMany: 'Too many reports, try again later.'`, `privacy: 'The report is anonymous.'`.

- [ ] **Step 2: Failing e2e** `e2e/report.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { askedSentence, button, field, status } from './helpers.ts'

/** Answers /api/report like the server; returns the bodies it got. */
async function fakeReports(page: Page, statusCode = 204) {
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/report', async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ status: statusCode })
  })
  return bodies
}

test('a sentence is reported from the feedback sheet, and the lesson goes on', async ({ page }) => {
  const bodies = await fakeReports(page)
  await page.goto('/practice/lesson?type=cloze&topic=all&level=A1&lesson=1')
  const sentence = await askedSentence(page)
  await field(page).fill(sentence.cloze![0].answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne!')

  await button(page, 'Nahlásiť chybu').tap()
  // Only a lesson after an answer offers "my answer should have been accepted".
  await page.getByRole('radio', { name: 'Zlý alebo neprirodzený preklad' }).check()
  await page.getByLabel('Poznámka (nepovinná)').fill('Znie to strojovo.')
  await button(page, 'Odoslať').tap()
  await expect(page.getByText('Ďakujeme, pozrieme sa na to.')).toBeVisible()
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({ target: `sentence:${sentence.id}`, detail: '0', exercise: 'cloze', reason: 'translation', note: 'Znie to strojovo.', answer: null, shown: { es: sentence.es } })

  // The flag stays filled today, and the lesson is where it was.
  await expect(button(page, 'Nahlásené')).toBeVisible()
  await button(page, 'Pokračovať').tap()
  await expect(page.getByText('2/10')).toBeVisible()
})

test('"my answer should have been accepted" sends the answer', async ({ page }) => {
  const bodies = await fakeReports(page)
  await page.goto('/practice/lesson?type=cloze&topic=all&level=A1&lesson=1')
  await askedSentence(page)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Nahlásiť chybu').tap()
  await page.getByRole('radio', { name: 'Moja odpoveď mala byť uznaná' }).check()
  await button(page, 'Odoslať').tap()
  await expect(page.getByText('Ďakujeme, pozrieme sa na to.')).toBeVisible()
  expect(bodies[0]).toMatchObject({ reason: 'answer', answer: 'zzzz' })
})

test('a failed send keeps what was chosen and written', async ({ page }) => {
  await fakeReports(page, 500)
  await page.goto('/word/casa')
  await button(page, 'Nahlásiť chybu').tap()
  // Detail slova has no answer to accept.
  await expect(page.getByRole('radio', { name: 'Moja odpoveď mala byť uznaná' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Chyba v španielčine' }).check()
  await page.getByLabel('Poznámka (nepovinná)').fill('Rod?')
  await button(page, 'Odoslať').tap()
  await expect(page.getByText('Nepodarilo sa odoslať. Skús to znova.')).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Chyba v španielčine' })).toBeChecked()
  await expect(page.getByLabel('Poznámka (nepovinná)')).toHaveValue('Rod?')
})
```

Check against the real lesson: the "Vzdať sa" button name, the counter text after one task (`2/10` vs the L1 prefix `L1 · 2/10` — use `toContainText` on the header if needed), and that the cloze lesson L1's first task has cloze index 0.

- [ ] **Step 3:** `npx playwright test e2e/report.spec.ts --workers=1` — FAIL (no "Nahlásiť chybu" button).

- [ ] **Step 4: `ReportSheet.tsx`** — a fixed overlay above everything (`fixed inset-0 z-40`), a dimmed backdrop (tap = cancel), and a bottom sheet in the app's style (`animate-sheet-up rounded-t-3xl border-t border-line bg-surface px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]`, `max-w-[480px] mx-auto`), `role="dialog"`, `aria-modal`, `aria-labelledby` the title:

```tsx
import { useState } from 'react'
import { Button } from '../../components/Button'
import { useT } from '../../i18n'
import { buildReport, markReported, REPORT_REASONS, sendReport, type ReportReason, type ReportSubject } from '../../lib/contentReport'

interface ReportSheetProps {
  subject: ReportSubject
  /** The learner's answer in a lesson: offers "Moja odpoveď mala byť uznaná". */
  answer: string | null
  onClose: (sent: boolean) => void
}

/** "Čo je zle?": a reason, an optional note, Odoslať. A failure keeps both for another try. */
export function ReportSheet({ subject, answer, onClose }: ReportSheetProps) {
  const text = useT().report
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed' | 'too-many'>('idle')
  const reasons = REPORT_REASONS.filter((r) => r !== 'answer' || answer)

  const send = async () => {
    if (!reason) return
    setState('sending')
    const result = await sendReport(buildReport(subject, reason, note, answer))
    if (result !== 'sent') return setState(result)
    markReported(subject.target)
    setState('sent')
    setTimeout(() => onClose(true), 1200)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end">
      <button type="button" aria-label={text.cancel} className="absolute inset-0 bg-ink/30" onClick={() => onClose(false)} />
      <div role="dialog" aria-modal="true" aria-labelledby="report-title" className="relative mx-auto w-full max-w-[480px] animate-sheet-up rounded-t-3xl border-t border-line bg-surface px-5 pt-5 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(0_0_0/0.08)]">
        {state === 'sent' ? (
          <p role="status" className="py-6 text-center text-lg font-semibold">{text.thanks}</p>
        ) : (
          <>
            <h2 id="report-title" className="text-lg font-semibold">{text.title}</h2>
            <p lang="es" className="mt-1 truncate text-sm text-ink-muted">{subject.shown.es}</p>
            <fieldset className="mt-3 space-y-1">
              <legend className="sr-only">{text.title}</legend>
              {reasons.map((r) => (
                <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-surface-2">
                  <input type="radio" name="report-reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-brick" />
                  <span>{text.reasons[r]}</span>
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm text-ink-muted" htmlFor="report-note">{text.noteLabel}</label>
            <textarea id="report-note" value={note} maxLength={500} rows={2} placeholder={text.notePlaceholder} onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-bg px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-brick" />
            {(state === 'failed' || state === 'too-many') && (
              <p role="alert" className="mt-2 text-sm text-error">{state === 'failed' ? text.failed : text.tooMany}</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">{text.privacy}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => onClose(false)}>{text.cancel}</Button>
              <Button onClick={() => void send()} disabled={!reason || state === 'sending'}>{state === 'sending' ? text.sending : text.send}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

Check `Button`'s props (`disabled`, `variant`) and the token names (`bg-ink/30`, `text-error`, `accent-brick`) against `src/components/Button.tsx` and `src/styles/tokens.css`; use what exists.

- [ ] **Step 5: `ReportButton.tsx`**:

```tsx
import { Flag } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../i18n'
import { reportedToday, type ReportSubject } from '../../lib/contentReport'
import { ReportSheet } from './ReportSheet'

interface ReportButtonProps {
  subject: ReportSubject
  answer?: string | null
  /** icon: round, next to ⭐ in the feedback sheet; text: a quiet line at the end of Detail slova. */
  variant?: 'icon' | 'text'
}

/** 🏳 Nahlásiť chybu: opens the report sheet; filled once this device reported the target today. */
export function ReportButton({ subject, answer = null, variant = 'icon' }: ReportButtonProps) {
  const text = useT().report
  const [open, setOpen] = useState(false)
  const [reported, setReported] = useState(() => reportedToday(subject.target))
  const label = reported ? text.reported : text.button
  return (
    <>
      {variant === 'icon' ? (
        <button type="button" onClick={() => setOpen(true)} aria-label={label} title={label}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brick">
          <Flag size={18} strokeWidth={1.75} className={reported ? 'fill-current text-brick' : ''} aria-hidden />
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)}
          className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-ink-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brick">
          <Flag size={16} strokeWidth={1.75} className={reported ? 'fill-current text-brick' : ''} aria-hidden />
          {label}
        </button>
      )}
      {open && (
        <ReportSheet subject={subject} answer={answer} onClose={(sent) => {
          setOpen(false)
          if (sent) setReported(true)
        }} />
      )}
    </>
  )
}
```

The subject's target changes with the task, but `FeedbackSheet` mounts anew for every graded task, so the initial `reportedToday` read is enough; on Detail slova key the button by `word.id` (pages swipe).

- [ ] **Step 6: Wire.**
  - `FeedbackSheet.tsx`: prop `learnerAnswer?: string`; in the header replace the lone `<SaveButton … size="pill" />` with `<div className="flex items-center gap-2"><ReportButton subject={taskSubject(task)} answer={learnerAnswer || null} /><SaveButton … /></div>`.
  - `LessonPage.tsx`: `<FeedbackSheet … learnerAnswer={answerText(answer)} />` (import `answerText` from `../../lib/contentReport`).
  - `WordPage.tsx`: the last child of `<article>`: `<div className="flex justify-center"><ReportButton key={word.id} subject={wordSubject(word)} variant="text" /></div>`.

- [ ] **Step 7:** `npx playwright test e2e/report.spec.ts --workers=1` — PASS; then `npx playwright test e2e/lesson.spec.ts e2e/word.spec.ts --workers=2` — PASS; `npm run lint && npx tsc -b`. Screenshot the feedback sheet with the flag and the open report sheet at 375 px (Playwright `page.screenshot` into the scratchpad) and look at both.

- [ ] **Step 8: Commit** — `git add src/features/report/ src/features/exercises/FeedbackSheet.tsx src/features/exercises/LessonPage.tsx src/features/word/WordPage.tsx src/i18n/sk.ts src/i18n/en.ts e2e/report.spec.ts` — `feat(reports): Nahlásiť chybu in lessons and on Detail slova`.

---

### Task 4: Nahlásený obsah (dev tools page)

**Files:**
- Create: `src/lib/contentReportsAdmin.ts`, `src/lib/contentReportsAdmin.test.ts`, `src/features/settings/ContentReports.tsx`
- Modify: `src/features/settings/SettingsSectionPage.tsx` (`content-reports`, dev mode only like `usage-stats`), `src/features/settings/DevSettings.tsx` (button), `src/i18n/sk.ts`, `src/i18n/en.ts`, `e2e/account.spec.ts` (fake RPCs + tests)

**Interfaces:**
- Consumes: `content_reports_list`, `content_reports_handle` (Task 1); `ReportReason` (Task 2); `getClient`, `useAccount` from `src/lib/account.ts`.
- Produces: `StoredReport`, `ReportGroup`, `groupReports(reports): ReportGroup[]`, `currentContent(target, detail): { es: string; translation: string } | null`, `copyText(groups, labels): string`.

- [ ] **Step 1: Failing tests** `src/lib/contentReportsAdmin.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { wordById } from '../data'
import { copyText, currentContent, groupReports, type StoredReport } from './contentReportsAdmin'

const report = (over: Partial<StoredReport>): StoredReport => ({
  id: 1, target: 'word:casa', detail: '', exercise: 'word', reason: 'spanish', note: '', answer: null,
  shown: { es: 'la casa', translation: 'dom' }, version: 'abc1234', language: 'sk',
  created_at: '2026-10-25T10:00:00Z', status: 'open', handled_at: null, ...over,
})

describe('content reports admin', () => {
  it('groups by target: most reported first, then the newest', () => {
    const groups = groupReports([
      report({ id: 1, target: 'word:casa', created_at: '2026-10-20T10:00:00Z' }),
      report({ id: 2, target: 'sentence:s001', created_at: '2026-10-25T10:00:00Z' }),
      report({ id: 3, target: 'word:casa', created_at: '2026-10-21T10:00:00Z' }),
      report({ id: 4, target: 'verb:tener', created_at: '2026-10-24T10:00:00Z' }),
    ])
    expect(groups.map((g) => g.target)).toEqual(['word:casa', 'sentence:s001', 'verb:tener'])
    expect(groups[0].reports.map((r) => r.id)).toEqual([3, 1])
  })

  it('looks up what the content says now, and null when it is gone', () => {
    expect(currentContent('word:casa', '')).toEqual({ es: 'la casa', translation: expect.stringContaining('dom') })
    expect(currentContent('verb:tener', 'preterito:yo')).toMatchObject({ es: 'tuve' })
    expect(currentContent('sentence:s001', '0')?.es).toBeTruthy()
    expect(currentContent('word:no-such-word', '')).toBeNull()
    expect(wordById.has('no-such-word')).toBe(false)
  })

  it('copies the open reports as text for Claude', () => {
    const text = copyText(groupReports([report({ note: 'Rod?', reason: 'spanish' }), report({ id: 2, reason: 'answer', answer: 'el casa' })]), {
      spanish: 'Chyba v španielčine', translation: 'Zlý preklad', answer: 'Moja odpoveď mala byť uznaná', other: 'Iné',
    })
    expect(text).toContain('word:casa (2×)')
    expect(text).toContain('Videné: la casa — dom')
    expect(text).toContain('Chyba v španielčine: Rod?')
    expect(text).toContain('Moja odpoveď mala byť uznaná · odpoveď: el casa')
  })
})
```

- [ ] **Step 2:** `npx vitest run src/lib/contentReportsAdmin.test.ts` — FAIL (module not found).

- [ ] **Step 3: Implement** `src/lib/contentReportsAdmin.ts`:

```ts
import { sentenceById, verbById, wordById } from '../data'
import { conjugate, formText, PERSON_LABELS, TENSE_LABELS, type TableTense } from './conjugate'
import type { ReportReason } from './contentReport'
import { sentenceTranslation, wordTranslations } from './localized'
import type { Person } from '../data/types'

// Nástroje pre vývoj → Nahlásený obsah: the reports of content_reports_list() grouped, the content as it is now,
// and the text for Claude. Pure: the page (ContentReports.tsx) loads and handles them.

export interface StoredReport {
  id: number
  target: string
  detail: string
  exercise: string
  reason: ReportReason
  note: string
  answer: string | null
  shown: { es: string; translation: string }
  version: string
  language: string
  created_at: string
  status: 'open' | 'fixed' | 'rejected'
  handled_at: string | null
}

export interface ReportGroup {
  target: string
  reports: StoredReport[] // newest first
}

export function groupReports(reports: StoredReport[]): ReportGroup[] {
  const groups = new Map<string, StoredReport[]>()
  for (const r of reports) groups.set(r.target, [...(groups.get(r.target) ?? []), r])
  return [...groups]
    .map(([target, list]) => ({ target, reports: list.sort((a, b) => b.created_at.localeCompare(a.created_at)) }))
    .sort((a, b) => b.reports.length - a.reports.length || b.reports[0].created_at.localeCompare(a.reports[0].created_at))
}

/** The content as the app has it now; null when the id no longer exists. */
export function currentContent(target: string, detail: string): { es: string; translation: string } | null {
  const [kind, id] = target.split(':')
  if (kind === 'sentence') {
    const sentence = sentenceById.get(id)
    return sentence ? { es: sentence.es, translation: sentenceTranslation(sentence) } : null
  }
  if (kind === 'word') {
    const word = wordById.get(id)
    return word ? { es: word.gender ? `${word.gender === 'm' ? 'el' : 'la'} ${word.es}` : word.es, translation: wordTranslations(word).join(', ') } : null
  }
  if (kind === 'verb') {
    const verb = verbById.get(id)
    const estar = verbById.get('estar')
    if (!verb || !estar) return null
    const [tense, person] = detail.split(':') as [TableTense, Person]
    if (!TENSE_LABELS[tense] || !PERSON_LABELS[person]) return { es: verb.id, translation: verb.sk.join(', ') }
    return { es: formText(conjugate(verb, tense, person, estar)), translation: `${verb.id} · ${PERSON_LABELS[person]} · ${TENSE_LABELS[tense]}` }
  }
  return null
}

/** The open reports as plain text, one block per target, for pasting into a Claude session. */
export function copyText(groups: ReportGroup[], reasons: Record<ReportReason, string>): string {
  return groups
    .map(({ target, reports }) => {
      const first = reports[0]
      const now = currentContent(target, first.detail)
      const lines = [
        `${target} (${reports.length}×)${first.detail ? ` · ${first.detail}` : ''} · ${first.exercise}`,
        `Videné: ${first.shown.es} — ${first.shown.translation}`,
        now ? `Teraz: ${now.es} — ${now.translation}` : 'Teraz: už neexistuje',
        ...reports.map((r) => `- ${reasons[r.reason]}${r.answer ? ` · odpoveď: ${r.answer}` : ''}${r.note ? `: ${r.note}` : ''} (${r.created_at.slice(0, 10)}${r.detail && r.detail !== first.detail ? `, ${r.detail}` : ''})`),
      ]
      return lines.join('\n')
    })
    .join('\n\n')
}
```

Check the real types: `Person` export location (`src/data/types.ts` or `conjugate.ts`), `verb.sk`, and that `tener` preterito yo is `tuve` (the dataset).

- [ ] **Step 4:** run the test — PASS.

- [ ] **Step 5: Texts** under `settings.dev` in `sk.ts` (and English twins in `en.ts`):

```ts
      contentReports: 'Nahlásený obsah',
      contentReportsHint: 'Hlásenia chýb v obsahu od učiacich. Vidí ich iba účet zapísaný v usage_admins.',
      reports: {
        open: 'Otvorené',
        handled: 'Vybavené',
        empty: 'Žiadne hlásenia.',
        kinds: { sentence: 'Veta', word: 'Slovo', verb: 'Sloveso' } as Record<string, string>,
        seen: 'Videné',
        now: 'Teraz',
        gone: 'už neexistuje',
        answer: 'odpoveď',
        fixed: 'Opravené',
        rejected: 'Nie je chyba',
        reopen: 'Vrátiť medzi otvorené',
        statusFixed: 'opravené',
        statusRejected: 'nie je chyba',
        copy: 'Kopírovať pre Clauda',
        copied: 'Skopírované. Vlož to do rozhovoru s Claudom.',
        openWord: 'Otvoriť slovo',
        signIn: 'Hlásenia vidí iba prihlásený správca.',
        forbidden: 'Tento účet nemá prístup.',
        failed: 'Hlásenia sa nepodarilo načítať.',
        retry: 'Skúsiť znova',
      },
```

English: `contentReports: 'Reported content'`, hint `'Reports of wrong content from learners. Only an account listed in usage_admins sees them.'`, open `Open`, handled `Handled`, empty `No reports.`, kinds `Sentence / Word / Verb`, seen `Seen`, now `Now`, gone `no longer exists`, answer `answer`, fixed `Fixed`, rejected `Not a mistake`, reopen `Back to open`, statusFixed `fixed`, statusRejected `not a mistake`, copy `Copy for Claude`, copied `Copied. Paste it into a chat with Claude.`, openWord `Open the word`, signIn/forbidden/failed/retry as in the usage page.

- [ ] **Step 6: Page** `src/features/settings/ContentReports.tsx`, built like `UsageStats.tsx` (results keyed by request `${tab}:${attempt}` and derived, no setState inside the effect):
  - `Segmented` tabs `open` / `handled` (label "Otvorené (N)" once the open list is loaded).
  - Loads `client.rpc('content_reports_list', { p_status: tab })`; errors through `parseReportError` from `src/lib/usageReport.ts` (`forbidden` / `offline`).
  - For each `ReportGroup`: a card (`rounded-card border border-line bg-surface p-4`) with `kinds[kind] id` (+ count), `Videné: es — translation`, `Teraz: …` when `currentContent` differs (or `už neexistuje`), a `Link` "Otvoriť slovo" to `/word/<id>` for `word:` targets, then a list of the reports: reason label, detail, answer, note, `created_at` date (and, in the handled tab, its status).
  - Buttons: open tab → **Opravené** (`content_reports_handle(target, 'fixed')`) and **Nie je chyba** (`'rejected'`); handled tab → **Vrátiť medzi otvorené** (`'open'`). After a handle call, bump `attempt` to reload.
  - Open tab with reports → **Kopírovať pre Clauda**: `navigator.clipboard.writeText(copyText(groups, text.reasons))` from `useT().report.reasons`, then shows `copied`.
  - Not signed in → `signIn`; `forbidden` → `forbidden`; offline → `failed` + `retry`; empty → `empty`.

- [ ] **Step 7: Wire** `SettingsSectionPage.tsx`: `'content-reports': () => <ContentReports />`, redirect outside dev mode like `usage-stats`. `DevSettings.tsx`: a `SettingsPart id="dev-reports"` with a `Flag` icon button to `/profile/content-reports` and the hint.

- [ ] **Step 8: E2E** in `e2e/account.spec.ts`: extend `fakeSupabase` options with `contentReports?: { open: object[]; handled: object[] } | 'forbidden'`, answering `/rest/v1/rpc/content_reports_list` by `p_status` and recording `/rest/v1/rpc/content_reports_handle` bodies into `calls.handled` (answer `2`). Tests:

```ts
test('Nahlásený obsah lists the reports by target, and Opravené handles the whole group', async ({ page }) => {
  const calls = await fakeSupabase(page, { contentReports: { open: [REPORT_A, REPORT_B, REPORT_C], handled: [] } })
  await signInWithCode(page)
  await expect(page.getByText(EMAIL)).toBeVisible()
  await page.goto('/profile/dev')
  await button(page, 'Nahlásený obsah').tap()
  await expect(page.getByText('Slovo casa (2×)')).toBeVisible()
  await expect(page.getByText('Rod?')).toBeVisible()
  await page.getByRole('button', { name: 'Opravené' }).first().tap()
  expect(calls.handled).toContainEqual({ p_target: 'word:casa', p_status: 'fixed' })
})

test('Nahlásený obsah: an account not in usage_admins has no access', async ({ page }) => {
  await fakeSupabase(page, { contentReports: 'forbidden' })
  await signInWithCode(page)
  await expect(page.getByText(EMAIL)).toBeVisible()
  await page.goto('/profile/content-reports')
  await expect(page.getByText('Tento účet nemá prístup.')).toBeVisible()
})
```

with `REPORT_A`/`REPORT_B` two reports on `word:casa` (one with note `Rod?`) and `REPORT_C` one on `sentence:s001`, shaped like `StoredReport`. Add `handled: [] as unknown[]` to `Calls`. Take a 375 px screenshot of the page into the scratchpad and look at it.

- [ ] **Step 9:** `npm run lint && npx tsc -b && npm test`; `npx playwright test e2e/account.spec.ts --workers=2` — PASS.

- [ ] **Step 10: Commit** — `git add src/lib/contentReportsAdmin.ts src/lib/contentReportsAdmin.test.ts src/features/settings/ContentReports.tsx src/features/settings/SettingsSectionPage.tsx src/features/settings/DevSettings.tsx src/i18n/sk.ts src/i18n/en.ts e2e/account.spec.ts` — `feat(reports): Nahlásený obsah in Nástroje pre vývoj`.

---

### Task 5: Privacy policy, setup guide, checks, push

**Files:**
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts` (`privacy`)
- Create: `docs/content-reports-setup.md`

- [ ] **Step 1: Policy.** After "Anonymné štatistiky" a section **Hlásenia chýb v obsahu**: "Keď nahlásiš chybu, pošle sa, ktorú vetu, slovo alebo tvar slovesa hlásiš a ako vyzerali, čo si zvolil a napísal, pri voľbe „Moja odpoveď mala byť uznaná“ aj tvoja odpoveď, a verzia a jazyk aplikácie. Nie je spojené s tvojím účtom ani IP adresou. Hlásenie ostáva, kým ho nevybavíme, a potom najviac 12 mesiacov." In "Právny základ" add hlásenia chýb v obsahu to the legitimate-interest sentence ("…na správnom obsahu…"). "Kto údaje spracúva": "…anonymné štatistiky a hlásenia chýb uchováva Supabase…". `updated` stays 25. 10. 2026. English twins. The e2e test that opens the policy still finds "S účtom".

- [ ] **Step 2: Setup guide** `docs/content-reports-setup.md` (Slovak): run `supabase/schema.sql` again in the SQL Editor ("Success. No rows returned"); nothing else (admin list from the statistics, Vercel keys from the reminders); where the page is; the workflow: Kopírovať pre Clauda → paste into a Claude session → Claude proposes and makes the data fixes → after the deploy mark the groups Opravené.

- [ ] **Step 3: Full check** — `npm run lint && npm run validate:data && npm test && npm run build && npm run test:e2e -- --workers=2`, all green (a lone duel timing failure under load: re-run `e2e/duel.spec.ts` alone before calling it a failure).

- [ ] **Step 4: Commit** `git add src/i18n/sk.ts src/i18n/en.ts docs/content-reports-setup.md` — `docs(privacy): content reports`. Push after the final review (Adam runs the SQL; until then `/api/report` answers 500 and the sheet says it failed, nothing else breaks).

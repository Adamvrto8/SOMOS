# Denník ako poznámky – plán implementácie

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Denník = jeden voľný text na deň (bez polí, kontroly a otázky dňa) a „Uložiť do Denníka“ pod odpoveďou SOMO.

**Architecture:** `DiaryEntry` dostane pole `text` namiesto `learned` + `es`; jediná funkcia `toDiaryEntry` prevádza
starý tvar pre Dexie upgrade, synchronizáciu aj zálohu. UI Denníka sa zjednoduší na jedno pole. SOMO dostane čistú
funkciu `turnAsNote` (odpoveď → čistý text, karty z dát appky) a tlačidlo, ktoré volá `appendToDiary`.

**Tech Stack:** React + TypeScript, Dexie, Vitest (+ fake-indexeddb), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-diary-notes-design.md`

## Global Constraints
- Texty pre používateľa po slovensky (sk.ts) aj po anglicky (en.ts); kód, komentáre a commity po anglicky.
- `DIARY_MAX = 20_000` znakov; prázdny text (len medzery) = deň sa zmaže.
- Názov ostáva **Denník**; nový placeholder „Čo si chceš zapamätať?“; výzva na Domove „Zapíš si, čo si chceš zapamätať“.
- Starý tvar: `text = [learned, es]` po `trim`, bez prázdnych, spojené `\n\n`.
- Blok zo SOMO sa pridá na koniec zápisu oddelený prázdnym riadkom; rovnaký blok druhýkrát nie (`'unchanged'`);
  nad limit nie (`'full'`).
- Karty v bloku: slovo `el carro – auto`, časovanie `tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron`, tip `Tip: <názov>`.
- Unit testy spúšťať z `C:\CODE\SOMOS-somo` v PowerShelli (`npx vitest run …`); e2e s `$env:E2E_PORT='5299'`.
- Typecheck (`npx tsc -b --noEmit`) je zelený až po úlohe 2 (úloha 1 mení tvar, ktorý UI ešte používa).

## Review Focus
- Zápis z inej, staršej verzie appky (sync alebo záloha so `learned`/`es`) sa prevedie, nezahodí → test v úlohe 1 (sync aj záloha).
- Dexie upgrade na zariadení so starými zápismi nezmaže ani nezdvojí text → test v úlohe 1 (`toDiaryEntry` na upgrade dátach).
- Uloženie odpovede, keď dnešný zápis ešte neexistuje, a dvojité ťuknutie → test v úlohe 1 (`appendToDiary`) a e2e v úlohe 3.
- Odpoveď s kartou, ktorú appka nemá, alebo so zástupnou adresou neprejde do Denníka ako značka → test v úlohe 3 (`turnAsNote`).
- Písanie a hneď odchod / appka na pozadí uloží posledný text → existujúce e2e testy v úlohe 2 upravené na jedno pole.

---

### Task 1: Dáta Denníka – jeden text, prevod starého tvaru, pridanie bloku

**Files:**
- Modify: `src/lib/db.ts` (interface `DiaryEntry`, nová `version(7)` s upgrade)
- Modify: `src/lib/diary.ts`
- Modify: `src/lib/backup.ts:166` (diár cez `diaryEntriesOf`)
- Modify: `src/lib/sync/kinds.ts` (`writeRow` pre `diary`)
- Modify: `src/lib/assistant/context.ts:65`, `src/lib/assistant/learner.ts:32,117`, `src/lib/assistant/records.ts:36`
- Test: `src/lib/diary.test.ts`, `src/lib/sync/engine.test.ts`, `src/lib/assistant/records.test.ts`, `src/lib/assistant/learner.test.ts`

**Interfaces:**
- Produces:
  - `interface DiaryEntry { date: string; text: string; createdAt: number; updatedAt: number }`
  - `DIARY_MAX = 20_000`
  - `toDiaryEntry(x: unknown): DiaryEntry | null`
  - `diaryEntriesOf(list: unknown): { entries: DiaryEntry[]; skipped: number }`
  - `saveDiaryEntry(date: string, text: string, now?: number): Promise<'saved' | 'removed' | 'unchanged'>`
  - `appendToDiary(date: string, block: string, now?: number): Promise<'saved' | 'unchanged' | 'full'>`
  - `newerDiaryEntries`, `isDiaryDate`, `todayKey`, `useDiaryEntry`, `useDiaryEntries` bez zmeny podpisu
  - `promptOfDay` a `isDiaryEntry` **zmiznú** (úloha 2 odstráni ich použitie v UI)

- [ ] **Step 1: Prepísať testy v `src/lib/diary.test.ts`**

Nahradiť bloky `saveDiaryEntry`, `newerDiaryEntries`, `isDiaryEntry` a `promptOfDay` (import `diaryPrompts` preč):

```ts
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { appendToDiary, DIARY_MAX, diaryEntriesOf, isDiaryDate, newerDiaryEntries, saveDiaryEntry, toDiaryEntry } from './diary'

beforeEach(() => db.diary.clear())

// (describe('isDiaryDate') ostáva bez zmeny)

describe('saveDiaryEntry', () => {
  it('creates, then updates keeping createdAt', async () => {
    expect(await saveDiaryEntry('2026-11-07', 'el pretérito', 100)).toBe('saved')
    expect(await saveDiaryEntry('2026-11-07', 'el pretérito de ir', 200)).toBe('saved')
    expect(await db.diary.get('2026-11-07')).toEqual({ date: '2026-11-07', text: 'el pretérito de ir', createdAt: 100, updatedAt: 200 })
  })
  it('does not write the same text again', async () => {
    await saveDiaryEntry('2026-11-07', 'Hola', 100)
    expect(await saveDiaryEntry('2026-11-07', 'Hola', 200)).toBe('unchanged')
    expect((await db.diary.get('2026-11-07'))?.updatedAt).toBe(100)
  })
  it('removes the day when the text is empty or only spaces', async () => {
    await saveDiaryEntry('2026-11-07', 'x', 100)
    expect(await saveDiaryEntry('2026-11-07', '  \n', 200)).toBe('removed')
    expect(await db.diary.get('2026-11-07')).toBeUndefined()
  })
  it('cuts the text to the limit', async () => {
    await saveDiaryEntry('2026-11-07', 'a'.repeat(DIARY_MAX + 10), 100)
    expect((await db.diary.get('2026-11-07'))?.text).toHaveLength(DIARY_MAX)
  })
})

describe('appendToDiary', () => {
  it('starts a day that has no entry', async () => {
    expect(await appendToDiary('2026-11-07', 'Čo je fue?\nFue je ser aj ir.', 100)).toBe('saved')
    expect(await db.diary.get('2026-11-07')).toEqual({ date: '2026-11-07', text: 'Čo je fue?\nFue je ser aj ir.', createdAt: 100, updatedAt: 100 })
  })
  it('adds after a blank line, once', async () => {
    await saveDiaryEntry('2026-11-07', 'moja poznámka\n', 100)
    expect(await appendToDiary('2026-11-07', 'blok', 200)).toBe('saved')
    expect(await appendToDiary('2026-11-07', 'blok', 300)).toBe('unchanged')
    expect(await db.diary.get('2026-11-07')).toMatchObject({ text: 'moja poznámka\n\nblok', createdAt: 100, updatedAt: 200 })
  })
  it('does not go over the limit', async () => {
    await saveDiaryEntry('2026-11-07', 'a'.repeat(DIARY_MAX - 3), 100)
    expect(await appendToDiary('2026-11-07', 'blok', 200)).toBe('full')
    expect((await db.diary.get('2026-11-07'))?.updatedAt).toBe(100)
  })
})

describe('toDiaryEntry', () => {
  it('takes the new shape', () => {
    expect(toDiaryEntry({ date: '2026-11-07', text: 'Hola', createdAt: 1, updatedAt: 2 })).toEqual({ date: '2026-11-07', text: 'Hola', createdAt: 1, updatedAt: 2 })
  })
  it('joins the two fields of the old shape, leaving out empty ones', () => {
    expect(toDiaryEntry({ date: '2026-11-07', learned: ' el pretérito ', es: 'Hoy fui al cine.', createdAt: 1, updatedAt: 2 })?.text).toBe('el pretérito\n\nHoy fui al cine.')
    expect(toDiaryEntry({ date: '2026-11-07', learned: '', es: 'Hola', createdAt: 1, updatedAt: 2 })?.text).toBe('Hola')
  })
  it('refuses a broken row', () => {
    expect(toDiaryEntry({ date: 'nope', text: 'x', createdAt: 1, updatedAt: 2 })).toBeNull()
    expect(toDiaryEntry({ date: '2026-11-07', es: 'Hola', createdAt: 1, updatedAt: 2 })).toBeNull()
    expect(toDiaryEntry(null)).toBeNull()
  })
  it('lists rows of a backup and counts the broken ones', () => {
    expect(diaryEntriesOf([{ date: '2026-11-07', learned: 'a', es: '', createdAt: 1, updatedAt: 2 }, { date: 'x' }])).toEqual({
      entries: [{ date: '2026-11-07', text: 'a', createdAt: 1, updatedAt: 2 }],
      skipped: 1,
    })
    expect(diaryEntriesOf(undefined)).toEqual({ entries: [], skipped: 0 })
  })
})

describe('newerDiaryEntries', () => {
  const entry = (date: string, updatedAt: number, text = 'x') => ({ date, text, createdAt: 1, updatedAt })
  it('keeps the newer edit of a day and every day not here', () => {
    const local = [entry('2026-11-06', 50), entry('2026-11-07', 300)]
    const incoming = [entry('2026-11-06', 80, 'newer'), entry('2026-11-07', 200, 'older'), entry('2026-11-05', 10)]
    expect(newerDiaryEntries(local, incoming).map((e) => e.date)).toEqual(['2026-11-06', '2026-11-05'])
  })
})
```

- [ ] **Step 2: Spustiť a overiť, že padajú**

Run: `npx vitest run src/lib/diary.test.ts`
Expected: FAIL (`appendToDiary`, `toDiaryEntry`, `diaryEntriesOf` neexistujú).

- [ ] **Step 3: Model a Dexie upgrade v `src/lib/db.ts`**

```ts
/** One day of the diary (Denník), keyed by the local date: one free text (since 2026-11-19, was two fields). */
export interface DiaryEntry {
  date: string // "2026-11-07", local time
  text: string
  createdAt: number
  updatedAt: number
}
```

Za `this.version(6)…`:

```ts
    // The diary's two fields (learned, es) became one text (docs/superpowers/specs/2026-11-19-diary-notes-design.md).
    this.version(7)
      .stores({ diary: 'date, updatedAt' })
      .upgrade((tx) =>
        tx
          .table('diary')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            const learned = typeof row.learned === 'string' ? row.learned.trim() : ''
            const es = typeof row.es === 'string' ? row.es.trim() : ''
            if (typeof row.text !== 'string') row.text = [learned, es].filter(Boolean).join('\n\n')
            delete row.learned
            delete row.es
          }),
      )
```

(Upgrade je zámerne samostatný od `toDiaryEntry`: `db.ts` nemá importovať `diary.ts`, ktoré importuje `db`.)

- [ ] **Step 4: `src/lib/diary.ts`**

Hlavička komentára: `// Denník: one free text per local day. Saved while typing; an empty text removes the day.`
Odstrániť importy `diaryPrompts`, `DiaryPrompt`, funkcie `isDiaryEntry` a `promptOfDay`. Doplniť / zmeniť:

```ts
export const DIARY_MAX = 20_000

/** A diary row in the current shape, also from the old one (learned + es, before 2026-11-19); null when broken. */
export function toDiaryEntry(x: unknown): DiaryEntry | null {
  if (typeof x !== 'object' || x === null) return null
  const e = x as Record<string, unknown>
  if (!isStr(e.date) || !DATE.test(e.date) || !isNum(e.createdAt) || !isNum(e.updatedAt)) return null
  let text: string
  if (isStr(e.text)) text = e.text
  else if (isStr(e.learned) && isStr(e.es)) text = [e.learned.trim(), e.es.trim()].filter(Boolean).join('\n\n')
  else return null
  return { date: e.date, text: text.slice(0, DIARY_MAX), createdAt: e.createdAt, updatedAt: e.updatedAt }
}

/** The diary rows of a backup, old shape converted; `skipped` counts the broken ones. */
export function diaryEntriesOf(list: unknown): { entries: DiaryEntry[]; skipped: number } {
  if (!Array.isArray(list)) return { entries: [], skipped: 0 }
  const entries = list.map(toDiaryEntry).filter((e): e is DiaryEntry => e !== null)
  return { entries, skipped: list.length - entries.length }
}

/** Stores a day's text (cut to DIARY_MAX); an empty one removes the day. */
export async function saveDiaryEntry(date: string, value: string, now = Date.now()): Promise<'saved' | 'removed' | 'unchanged'> {
  const text = value.slice(0, DIARY_MAX)
  return db.transaction('rw', db.diary, async () => {
    const existing = await db.diary.get(date)
    if (!text.trim()) {
      if (!existing) return 'unchanged'
      await db.diary.delete(date)
      return 'removed'
    }
    if (existing && existing.text === text) return 'unchanged'
    await db.diary.put({ date, text, createdAt: existing?.createdAt ?? now, updatedAt: now })
    return 'saved'
  })
}

/** Adds a block (an answer of SOMO) at the end of a day, after a blank line; once, and never over DIARY_MAX. */
export async function appendToDiary(date: string, block: string, now = Date.now()): Promise<'saved' | 'unchanged' | 'full'> {
  const add = block.trim()
  return db.transaction('rw', db.diary, async () => {
    const existing = await db.diary.get(date)
    const before = existing?.text.trimEnd() ?? ''
    if (before.includes(add)) return 'unchanged'
    const text = before ? `${before}\n\n${add}` : add
    if (text.length > DIARY_MAX) return 'full'
    await db.diary.put({ date, text, createdAt: existing?.createdAt ?? now, updatedAt: now })
    return 'saved'
  })
}
```

- [ ] **Step 5: Záloha – `src/lib/backup.ts`**

Import `isDiaryEntry` nahradiť `diaryEntriesOf`. Pred zostavením `backup` (vedľa `lessons` / `tests`):

```ts
  const diary = diaryEntriesOf(data.diary)
  skipped += diary.skipped
```

a v objekte `diary: diary.entries,` namiesto `diary: pick(data.diary, isDiaryEntry),`.

- [ ] **Step 6: Synchronizácia – `src/lib/sync/kinds.ts` `writeRow`**

```ts
export async function writeRow(kind: TableKind, key: string, data: unknown): Promise<void> {
  if (kind === 'diary') {
    // A device on an older app still sends learned + es.
    const entry = toDiaryEntry(data)
    if (entry) await db.diary.put(entry)
    return
  }
  if (kind !== 'attempt') {
```

(import `toDiaryEntry` z `../diary`; ak by vznikol cyklický import, `diary.ts` z `sync` nič neimportuje, takže je bezpečný.)

Do `src/lib/sync/engine.test.ts` v `describe('diary')` prepísať existujúci test na nový tvar a pridať starý tvar:

```ts
  it('an entry goes to the account, an edit and a removal from another device come back', async () => {
    await saveDiaryEntry('2026-11-07', 'Hoy fui al mercado.', 100)
    await settle()
    await syncOnce(server)
    expect(server.get('diary', '2026-11-07')?.data).toMatchObject({ text: 'Hoy fui al mercado.' })

    const edited = { date: '2026-11-07', text: 'Hoy fui al mercado con Ana.', createdAt: 100, updatedAt: 500 }
    await fromOtherDevice(server, 'diary', '2026-11-07', edited, Date.now() + 1000)
    await syncOnce(server)
    expect((await db.diary.get('2026-11-07'))?.text).toBe('Hoy fui al mercado con Ana.')

    await fromOtherDevice(server, 'diary', '2026-11-07', null, Date.now() + 2000, true)
    await syncOnce(server)
    expect(await db.diary.get('2026-11-07')).toBeUndefined()
  })

  it('an entry of an older app (two fields) arrives as one text', async () => {
    const old = { date: '2026-11-06', learned: 'pretérito', es: 'Ayer fui al cine.', createdAt: 1, updatedAt: 2 }
    await fromOtherDevice(server, 'diary', '2026-11-06', old, Date.now() + 1000)
    await syncOnce(server)
    expect(await db.diary.get('2026-11-06')).toEqual({ date: '2026-11-06', text: 'pretérito\n\nAyer fui al cine.', createdAt: 1, updatedAt: 2 })
  })
```

- [ ] **Step 7: SOMO kontext – `context.ts`, `learner.ts`, `records.ts`**

`src/lib/assistant/context.ts:65`: `diary: diary.map(({ date, text }) => ({ date, text })),`

`src/lib/assistant/learner.ts`: typ `diary: Pick<DiaryEntry, 'date' | 'text'>[]`, riadok 117:

```ts
      ? `Denník: ${s.diaryCount} zápisov; posledné: ${s.diary.slice(0, 3).map((e) => `${e.date}: ${clip(e.text, 160) || '–'}`).join(' | ')}`
```

`src/lib/assistant/records.ts:36`: `.map((e) => ({ date: e.date, text: clip(e.text, 600) }))`

Testy: v `records.test.ts` vstup `diary` na `{ date, text: 'pretérito\n\nAyer fui al cine.', … }` a `{ date, text: 'x'.repeat(900), … }`,
očakávanie `expect(String(newest.text).length).toBeLessThanOrEqual(600)`. V `learner.test.ts` `{ date, text: 'a'.repeat(5000) }`.

- [ ] **Step 8: Spustiť testy**

Run: `npx vitest run src/lib/diary.test.ts src/lib/sync src/lib/assistant`
Expected: PASS. (`tsc` ešte padne na súboroch v `src/features/diary/` – rieši úloha 2.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/db.ts src/lib/diary.ts src/lib/diary.test.ts src/lib/backup.ts src/lib/sync/kinds.ts src/lib/sync/engine.test.ts src/lib/assistant/context.ts src/lib/assistant/learner.ts src/lib/assistant/learner.test.ts src/lib/assistant/records.ts src/lib/assistant/records.test.ts
git commit -m "feat(diary): one text per day, older entries converted on upgrade, sync and backup"
```

---

### Task 2: Obrazovky Denníka – jedno pole, zoznam, karta na Domove; preč kontrola a otázka dňa

**Files:**
- Modify: `src/features/diary/DiaryEntryPage.tsx`, `DiaryPage.tsx` (len cez `entryLine`), `DiaryCard.tsx`, `diaryDate.ts`
- Delete: `src/features/diary/DiaryCheck.tsx`, `src/lib/diaryCheck.ts`, `src/lib/diaryCheck.test.ts`, `src/data/diaryPrompts.json`
- Modify: `src/data/index.ts` (preč `diaryPrompts`), `src/data/types.ts` (preč `DiaryPrompt`), `scripts/validate-data.ts` (preč blok „diary prompts“ a import typu)
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts` (sekcia `diary`), `src/lib/assistant/appGuide.ts` (sekcia `dennik`)
- Test: `e2e/diary.spec.ts`

**Interfaces:**
- Consumes: `saveDiaryEntry(date, text)`, `useDiaryEntry`, `useDiaryEntries`, `DIARY_MAX`, `DiaryEntry.text` (úloha 1)
- Produces: i18n `diary.title|today|todayEntry|write|all|label|hint|saved|empty|emptyHint|nothingToday|cardHint` (úloha 3 používa `diary.title`)

- [ ] **Step 1: Prepísať e2e `e2e/diary.spec.ts`**

```ts
// e2e/diary.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

const note = (page: Page) => page.getByLabel('Čo si chceš zapamätať?')
const today = (page: Page) => page.getByRole('link', { name: /^Dnes/ })

test('a diary day: kept after a reload, listed, removed when the text is cleared', async ({ page }) => {
  await page.goto('/diary')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
  await today(page).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)

  await note(page).fill('el pretérito de ir: fui, fuiste, fue\nHoy fui al mercado.')
  await expect(page.getByText('Uložené')).toBeVisible()
  await page.reload()
  await expect(note(page)).toHaveValue('el pretérito de ir: fui, fuiste, fue\nHoy fui al mercado.')

  await page.goto('/diary')
  await expect(today(page)).toContainText('el pretérito de ir: fui, fuiste, fue')
  await expect(today(page)).not.toContainText('Hoy fui al mercado.')

  // Typed and left at once: the last text is still saved.
  await today(page).tap()
  await note(page).fill('')
  await button(page, 'Späť').tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(today(page)).toContainText('Dnes ešte nič')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
})

test('a wrong or future date goes back to the diary', async ({ page }) => {
  await page.goto('/diary/2026-13-45')
  await expect(page).toHaveURL(/\/diary$/)
  await page.goto('/diary/2999-01-01')
  await expect(page).toHaveURL(/\/diary$/)
})

test('the Domov card: a hint and "Napísať", then ✓ and the first line of the entry', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Dnešný zápis' })
  await expect(card).toContainText('Zapíš si, čo si chceš zapamätať')
  await card.getByRole('link', { name: 'Napísať' }).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)
  await note(page).fill('ser vs estar\nestar = kde a ako')
  await expect(page.getByText('Uložené')).toBeVisible()

  await page.goto('/')
  await expect(card).toContainText('ser vs estar')
  await expect(card).not.toContainText('estar = kde a ako')
  await expect(card.getByRole('link', { name: 'Napísať' })).toHaveCount(0)
  await card.getByRole('link', { name: 'Všetky zápisy' }).tap()
  await expect(page).toHaveURL(/\/diary$/)
})

test('going from one day to another in the history shows that day’s own text', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await note(page).fill('Hoy comí tacos.')
  await expect(page.getByText('Uložené')).toBeVisible()
  await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    window.history.pushState({}, '', `/diary/${key}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(note(page)).toHaveValue('')
})

test('the app going to the background saves what was typed at once', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await note(page).fill('Hoy fui al parque.')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(250)
  const stored = await page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('somos')
        open.onsuccess = () => {
          const rows = open.result.transaction('diary').objectStore('diary').getAll()
          rows.onsuccess = () => resolve((rows.result as { text: string }[])[0]?.text)
        }
      }),
  )
  expect(stored).toBe('Hoy fui al parque.')
})
```

- [ ] **Step 2: i18n – sekcia `diary` v `src/i18n/sk.ts`**

```ts
  diary: {
    title: 'Denník',
    today: 'Dnes',
    todayEntry: 'Dnešný zápis',
    write: 'Napísať',
    all: 'Všetky zápisy',
    label: 'Čo si chceš zapamätať?',
    hint: 'Slovíčka, pravidlá, vysvetlenia od SOMO, čokoľvek',
    cardHint: 'Zapíš si, čo si chceš zapamätať',
    saved: 'Uložené',
    empty: 'Zatiaľ nemáš žiadny zápis.',
    emptyHint: 'Každý deň má jeden zápis: slovíčka, pravidlá alebo odpovede od SOMO, ktoré si chceš zapamätať.',
    nothingToday: 'Dnes ešte nič',
  },
```

a v `src/i18n/en.ts`:

```ts
  diary: {
    title: 'Diary',
    today: 'Today',
    todayEntry: "Today's entry",
    write: 'Write',
    all: 'All entries',
    label: 'What do you want to remember?',
    hint: 'Words, rules, explanations from SOMO, anything',
    cardHint: 'Write down what you want to remember',
    saved: 'Saved',
    empty: 'No entries yet.',
    emptyHint: 'Every day has one entry: words, rules or answers from SOMO you want to remember.',
    nothingToday: 'Nothing yet today',
  },
```

- [ ] **Step 3: `src/features/diary/diaryDate.ts`**

```ts
/** What a day shows in a list or on the card: the first line with text. */
export const entryLine = (entry: DiaryEntry) => firstLine(entry.text)
```

(`firstLine` už vracia prvý neprázdny riadok, ostáva bez zmeny.)
V `DiaryPage.tsx` zmeniť `lang={todays ? 'es' : undefined}` a `lang="es"` na bez `lang` (text je zmiešaný).

- [ ] **Step 4: `src/features/diary/DiaryEntryPage.tsx` – jedno pole**

V `EntryForm` nahradiť stav dvoch polí jedným a odstrániť kontrolu:

```tsx
function EntryForm({ date, entry }: { date: string; entry: DiaryEntry | null }) {
  const dictionary = useT()
  const t = dictionary.diary
  const language = useLanguage()
  const [text, setText] = useState(entry?.text ?? '')
  const [saved, setSaved] = useState(false)

  const latest = useRef(text)
  const dirty = useRef(false)
  const timer = useRef<number>(undefined)
  const savedTimer = useRef<number>(undefined)

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    void saveDiaryEntry(date, latest.current).then((result) => {
      if (result === 'unchanged') return
      setSaved(true)
      window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000)
    })
  }, [date])

  // (useEffect s pagehide / visibilitychange ostáva bez zmeny; useEffect s CHECK_AFTER preč)

  const change = (value: string) => {
    setText(value)
    latest.current = value
    dirty.current = true
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_AFTER)
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallback="/diary" />
        <span aria-live="polite" className="text-sm text-ink-muted">
          {saved ? t.saved : ''}
        </span>
      </div>
      <h1 className="font-serif text-3xl font-semibold tracking-tight first-letter:uppercase">{diaryDate(date, dictionary.dateLocale)}</h1>
      <label className="flex flex-1 flex-col gap-2">
        <span className="sr-only">{t.label}</span>
        <textarea
          value={text}
          onChange={(e) => change(e.target.value)}
          lang={language}
          maxLength={DIARY_MAX}
          placeholder={`${t.label} ${t.hint}`}
          className={`${FIELD} min-h-64 flex-1`}
        />
      </label>
    </div>
  )
}
```

Odstrániť konštantu `CHECK_AFTER`, importy `DiaryCheck`, `useCustomWords`, `useMemo` (ak už nie sú použité).
`aria-label` poľa je text `<span className="sr-only">` cez `<label>`, preto e2e `getByLabel('Čo si chceš zapamätať?')`.

- [ ] **Step 5: `src/features/diary/DiaryCard.tsx` – bez otázky dňa**

Odstrániť `promptOfDay`, `prompt`, `language`/`useLanguage`. Odkaz s textom:

```tsx
          <Link
            to={href}
            tabIndex={entry ? undefined : -1}
            className="block truncate font-serif text-lg leading-snug font-semibold after:absolute after:inset-0 after:rounded-card focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brick"
          >
            {entry ? entryLine(entry) : t.cardHint}
          </Link>
```

a riadok `{!entry && <p …>{language === 'en' ? prompt.en : prompt.sk}</p>}` zmazať. Komentár komponentu:
`Domov: today's diary entry, compact — a hint and "Napísať", or ✓ and the first line of what was written.`

- [ ] **Step 6: Zmazať kontrolu a otázky dňa**

```bash
git rm src/features/diary/DiaryCheck.tsx src/lib/diaryCheck.ts src/lib/diaryCheck.test.ts src/data/diaryPrompts.json
```

V `src/data/index.ts` zmazať `import diaryPromptsJson …`, `export const diaryPrompts …` a `DiaryPrompt` z importu typov;
v `src/data/types.ts` zmazať `interface DiaryPrompt` s komentárom; v `scripts/validate-data.ts` zmazať `diaryPromptsUrl`,
`diaryPrompts`, blok `// ---------- diary prompts …` a `DiaryPrompt` z importu. Overiť: `grep -rn "diaryPrompt\|diaryCheck\|DiaryCheck" src scripts e2e` nič nenájde.

- [ ] **Step 7: Mapa appky pre SOMO – `src/lib/assistant/appGuide.ts`, sekcia `dennik`**

```ts
    text: 'Karta na Domove („Dnešný zápis“). Na každý deň jeden zápis: voľný text, kam si učiaci zapisuje, čo si chce zapamätať (slovíčka, pravidlá, vysvetlenia). Pod každou odpoveďou SOMO je „Uložiť do Denníka“, ktoré otázku aj odpoveď pridá na koniec dnešného zápisu. Text appka nekontroluje; vetu po španielsky skontroluje SOMO, keď ju sem učiaci pošle. „Všetky zápisy“ ukáže staršie dni. Nepočíta sa do cieľa ani série.',
```

- [ ] **Step 8: Overiť**

Run (PowerShell, `C:\CODE\SOMOS-somo`): `npx tsc -b --noEmit; npx vitest run; npm run validate:data; $env:E2E_PORT='5299'; npx playwright test e2e/diary.spec.ts`
Expected: typecheck bez chýb, všetky unit testy PASS, validácia OK, e2e PASS. (Iný e2e test polia Denníka nepoužíva:
`grep -rn "Po španielsky\|dnes naučil" e2e` nájde len `diary.spec.ts`.)

- [ ] **Step 9: Commit**

```bash
git add -A src/features/diary src/lib/diaryCheck.ts src/lib/diaryCheck.test.ts src/data scripts/validate-data.ts src/i18n/sk.ts src/i18n/en.ts src/lib/assistant/appGuide.ts e2e/diary.spec.ts
git commit -m "feat(diary): one note field per day, no check and no daily prompt"
```

---

### Task 3: „Uložiť do Denníka“ pod odpoveďou SOMO

**Files:**
- Create: `src/lib/assistant/note.ts`, `src/lib/assistant/note.test.ts`
- Modify: `src/features/assistant/AssistantChat.tsx` (nový `SaveToDiary`, umiestnenie vedľa `Rating`)
- Modify: `src/i18n/sk.ts`, `src/i18n/en.ts` (sekcia `assistant`)
- Test: `e2e/assistant.spec.ts`

**Interfaces:**
- Consumes: `appendToDiary(date, block): Promise<'saved' | 'unchanged' | 'full'>`, `todayKey()` (úloha 1);
  `answerBlocks(text): AnswerBlock[]`, typy `AnswerBlock`, `AnswerPart`, `AnswerCard` (`src/lib/assistant/answerText.ts`);
  `conjugationRows(verb, tense, estar)`, `formText(parts)`, `TENSE_LABELS` (`src/lib/conjugate.ts`); `wordTranslations`,
  `localizedTip` (`src/lib/localized.ts`); `articleFor` (`src/lib/grammar.ts`); `verbById`, `wordById`, `tipById` (`src/data`).
- Produces: `turnAsNote(turn: { question: string; answer: string }): string`, `cardAsText(card: AnswerCard): string`

- [ ] **Step 1: Test `src/lib/assistant/note.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { cardAsText, turnAsNote } from './note'

describe('cardAsText', () => {
  it('writes a word, a conjugation and a tip from the app data', () => {
    expect(cardAsText({ type: 'word', id: 'carro' })).toBe('el carro – auto')
    expect(cardAsText({ type: 'conj', verbId: 'tener', tense: 'preterito' })).toBe('tener · pretérito: tuve, tuviste, tuvo, tuvimos, tuvieron')
    expect(cardAsText({ type: 'tip', id: 'ser-estar' })).toMatch(/^Tip: /)
  })
})

describe('turnAsNote', () => {
  it('keeps the question, the text without marks, links as words, examples and cards; drops follow-ups', () => {
    const answer = [
      '**Ser** hovorí, čo niečo je, *estar* kde to je. Viac v [gramatike](/practice/grammar).',
      '- Ella es mi hermana. – Ona je moja sestra.',
      '{{word:carro}}',
      '{{word:flarpo}}',
      'Detail slova (/word/<id>) má príklady.',
      '{{dalej:Daj mi ďalší príklad}}',
    ].join('\n')
    expect(turnAsNote({ question: 'Aký je rozdiel medzi ser a estar?', answer })).toBe(
      [
        'Aký je rozdiel medzi ser a estar?',
        'Ser hovorí, čo niečo je, estar kde to je. Viac v gramatike.',
        '- Ella es mi hermana. – Ona je moja sestra.',
        'el carro – auto',
        'Detail slova má príklady.',
      ].join('\n'),
    )
  })

  it('keeps every line of a task question', () => {
    const question = 'Prečo je moja odpoveď zlá?\nCvičenie: Časovanie\nÚloha: tener · yo · pretérito\nMoja odpoveď: tenía\nSprávne: tuve'
    expect(turnAsNote({ question, answer: 'Treba **tuve**.' })).toBe(`${question}\nTreba tuve.`)
  })
})
```

Pozn.: ak `wordTranslations(carro)` vráti viac prekladov (`auto, …`), upraviť očakávanie podľa dát
(`grep -n '"id": "carro"' -A3 src/data/words/city.json`) – formát je `${člen} ${es} – ${preklady.join(', ')}`.

- [ ] **Step 2: Spustiť a overiť, že padá**

Run: `npx vitest run src/lib/assistant/note.test.ts`
Expected: FAIL (modul `./note` neexistuje).

- [ ] **Step 3: `src/lib/assistant/note.ts`**

```ts
import { tipById, verbById, wordById } from '../../data'
import { conjugationRows, formText, TENSE_LABELS } from '../conjugate'
import { articleFor } from '../grammar'
import { localizedTip, wordTranslations } from '../localized'
import { answerBlocks, type AnswerCard, type AnswerPart, type ListItem } from './answerText'

// An answer of SOMO as plain text for the diary (docs/superpowers/specs/2026-11-19-diary-notes-design.md §3):
// the cards written out from the app's data, no marks, links as their words, no follow-up questions.

const partsText = (parts: AnswerPart[]) => parts.map((p) => (p.type === 'link' ? p.label : p.text)).join('')

const itemText = (item: ListItem) => (item.type === 'example' ? `- ${item.es} – ${item.text}` : `- ${partsText(item.parts)}`)

/** A card as one line; '' for a card whose data is gone. */
export function cardAsText(card: AnswerCard): string {
  if (card.type === 'word') {
    const word = wordById.get(card.id)
    if (!word) return ''
    const article = articleFor(word)
    return `${article ? `${article} ` : ''}${word.es} – ${wordTranslations(word).join(', ')}`
  }
  if (card.type === 'tip') {
    const tip = tipById.get(card.id)
    return tip ? `Tip: ${localizedTip(tip).title}` : ''
  }
  const verb = verbById.get(card.verbId)
  const estar = verbById.get('estar')
  if (!verb || !estar) return ''
  const forms = conjugationRows(verb, card.tense, estar).map((row) => formText(row.parts))
  return `${verb.id} · ${TENSE_LABELS[card.tense]}: ${forms.join(', ')}`
}

/** The question and the answer of a chat turn as one block of the diary. */
export function turnAsNote(turn: { question: string; answer: string }): string {
  const lines = answerBlocks(turn.answer).flatMap((block) => {
    if (block.type === 'text') return [partsText(block.parts).trim()]
    if (block.type === 'list') return block.items.map(itemText)
    return [cardAsText(block.card)]
  })
  return [turn.question.trim(), ...lines].filter(Boolean).join('\n')
}
```

Ak `ListItem` nie je exportovaný z `answerText.ts`, pridať `export` k jeho typu (už je: `export type ListItem`).
Ak text blok obsahuje viac riadkov s prázdnym riadkom medzi odsekmi, `partsText(...).trim()` ich zachová; je to v poriadku.

- [ ] **Step 4: Spustiť test**

Run: `npx vitest run src/lib/assistant/note.test.ts`
Expected: PASS.

- [ ] **Step 5: i18n – `assistant` v `sk.ts` a `en.ts`**

sk.ts (vedľa `rateUp`):

```ts
    saveToDiary: 'Uložiť do Denníka',
    savedToDiary: 'Uložené do Denníka',
    openDiary: 'Otvoriť',
    diaryFull: 'Dnešný zápis je plný, odpoveď sa nezmestí.',
```

en.ts:

```ts
    saveToDiary: 'Save to the diary',
    savedToDiary: 'Saved to the diary',
    openDiary: 'Open',
    diaryFull: "Today's entry is full, the answer does not fit.",
```

- [ ] **Step 6: `SaveToDiary` v `src/features/assistant/AssistantChat.tsx`**

Importy: `NotebookPen` z `lucide-react`, `Link` z `react-router`, `appendToDiary, todayKey` z `../../lib/diary`,
`turnAsNote` z `../../lib/assistant/note`. Komponent (pod `Rating`):

```tsx
/** Adds the question and the answer to today's diary entry; a second tap adds nothing. */
function SaveToDiary({ turn }: { turn: ChatTurn }) {
  const text = useT().assistant
  const [state, setState] = useState<'idle' | 'saved' | 'full'>('idle')
  const today = todayKey()

  const save = async () => {
    const result = await appendToDiary(today, turnAsNote(turn))
    setState(result === 'full' ? 'full' : 'saved')
  }

  if (state === 'saved')
    return (
      <p className="mt-1 flex min-h-11 items-center gap-1.5 text-xs text-ink-muted">
        <NotebookPen size={14} strokeWidth={1.75} aria-hidden />
        {text.savedToDiary} ·{' '}
        <Link to={`/diary/${today}`} className="font-medium text-brick underline focus-visible:outline-2 focus-visible:outline-brick">
          {text.openDiary}
        </Link>
      </p>
    )
  return (
    <div className="mt-1">
      <button type="button" onClick={() => void save()} aria-label={text.saveToDiary} title={text.saveToDiary} className={RATE_BUTTON}>
        <NotebookPen size={18} strokeWidth={1.75} aria-hidden />
      </button>
      {state === 'full' && (
        <p role="alert" className="text-sm text-error">
          {text.diaryFull}
        </p>
      )}
    </div>
  )
}
```

Umiestnenie (riadok s `<Rating turn={turn} index={i} />`):

```tsx
              <div className="flex flex-wrap items-start gap-x-1">
                <Rating turn={turn} index={i} />
                <SaveToDiary turn={turn} />
              </div>
```

Odkaz „Otvoriť“ vedie na `/diary/<dnes>`; SOMO je sheet nad stránkou, navigácia ho zavrie tak ako ostatné odkazy
v odpovedi (over v e2e kroku nižšie, inak použiť rovnaký spôsob navigácie ako odkazy v `AnswerView`).

- [ ] **Step 7: E2E v `e2e/assistant.spec.ts`**

```ts
test('an answer is saved to today’s diary entry with its question, once', async ({ page }) => {
  const chat = await signedInDev(page)
  chat.release()
  chat.answer = 'Auto je po španielsky **el carro**.\n- Mi carro es rojo. – Moje auto je červené.\n{{word:carro}}\n{{dalej:Ako sa povie autobus?}}'
  await page.goto('/assistant')
  await askQuestion(page, 'Ako sa povie auto?')
  await expect(page.getByText('Mi carro es rojo.')).toBeVisible()

  await page.getByRole('button', { name: 'Uložiť do Denníka' }).tap()
  await expect(page.getByText('Uložené do Denníka')).toBeVisible()
  await page.getByRole('link', { name: 'Otvoriť' }).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)
  const note = page.getByLabel('Čo si chceš zapamätať?')
  await expect(note).toHaveValue(/^Ako sa povie auto\?\nAuto je po španielsky el carro\.\n- Mi carro es rojo\. – Moje auto je červené\.\nel carro – auto/)
  await expect(note).not.toHaveValue(/autobus/)
})
```

(Druhé ťuknutie pokrýva unit test `appendToDiary … once`; po prvom uložení tlačidlo zmizne.)

- [ ] **Step 8: Overiť**

Run: `npx tsc -b --noEmit; npx vitest run src/lib/assistant; $env:E2E_PORT='5299'; npx playwright test e2e/assistant.spec.ts e2e/diary.spec.ts`
Expected: všetko PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/assistant/note.ts src/lib/assistant/note.test.ts src/features/assistant/AssistantChat.tsx src/i18n/sk.ts src/i18n/en.ts e2e/assistant.spec.ts
git commit -m "feat(assistant): save an answer to today's diary entry"
```

---

### Task 4: Celkové overenie a dokumentácia

**Files:**
- Modify: `CLAUDE.md` iba ak Adam povie (je jeho; nestagovať bez pokynu)

- [ ] **Step 1: Celá sada**

Run (PowerShell, `C:\CODE\SOMOS-somo`): `npm run lint; npx tsc -b --noEmit; npx vitest run; npm run validate:data; npm run build; $env:E2E_PORT='5299'; npm run test:e2e`
Expected: všetko zelené (nestabilný duel test pri záťaži zopakovať samostatne).

- [ ] **Step 2: Ručná kontrola na 375 px**

Spustiť dev server (`npm run dev -- --port 5299`), otvoriť `/diary`, zápis dňa, Domov a SOMO v režime vývojára:
pole cez celú výšku, karta na Domove bez otázky dňa, ikona Denníka vedľa 👍 / 👎.

- [ ] **Step 3: Push na Preview**

```bash
git push origin diary-notes:diary-notes
```

Adam otestuje na telefóne; do `main` až na jeho pokyn.

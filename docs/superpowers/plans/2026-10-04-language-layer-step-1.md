# Language layer, step 1: the setting, the dictionaries, the first screens — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Adam's standing choice: inline, no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Jazyk" setting (Slovenčina / English) that switches the interface texts of the shared components, Domov and Nastavenia at once, with the Slovak app unchanged.

**Architecture:** `src/lib/language.ts` is a small store like `dailyGoal.ts` (`'sk' | 'en'`, localStorage, `useSyncExternalStore`). `src/i18n/sk.ts` is the model dictionary, `src/i18n/en.ts` is typed as the same shape, `src/i18n/index.ts` gives `useT()` to components and `t()` to code outside React. Screens swap their literals for dictionary entries; nothing else about them changes.

**Tech Stack:** React 19, TypeScript, vitest (node, no DOM), Playwright (installed Chrome, phone size, `locale: 'sk-SK'`).

**Spec:** `docs/superpowers/specs/2026-10-04-language-layer-design.md` (sections 1, 2 and step 1 of section 6). Steps 2–4 of the spec get their own plans when this one is on Adam's phone.

## Global Constraints

- Two languages only: `'sk' | 'en'`. Storage key `somos-language`.
- Default with nothing stored: Slovak when the first entry of `navigator.languages` starts with `sk` or `cs`, English otherwise. The default is never written to storage.
- English is American English.
- The Slovak app must look and read exactly as before. No existing test changes; no Slovak text changes while it moves to `sk.ts`.
- Spanish is never translated. Content from `src/data` (topic names, translations, tips) is not part of this step and stays Slovak in English mode.
- Texts with a number are functions in the dictionary; Slovak keeps `pluralSk` (1 / 2–4 / 5+), English uses singular for 1 and plural otherwise.
- Dates are formatted with `dateLocale` of the dictionary (`sk-SK` / `en-US`).
- Components read texts through `useT()`; functions outside React through `t()`, and are called from components that use `useT()` so they re-render on a switch.
- Code, comments, commit messages in English. No `any`.
- Before each push: `npm test`, `npm run build`, `npm run test:e2e`. Stage explicit paths (Adam's own edits to `.gitignore`, `CLAUDE.md`, `poznaky.txt` stay out).

## Review Focus

1. **Unit tests and the build run without a browser** (node: no `localStorage`, `navigator.languages` is `en-US`): the store must not throw there, and the lib tests that assert Slovak texts must keep running in Slovak → `src/test-setup.ts` sets Slovak; test in Task 1 covers the store without storage.
2. **A stored value that is not a language** (`somos-language = "de"`, or garbage from a backup): falls back to the phone's language, never crashes → Task 1 test, Task 3 backup test.
3. **A phone set to Czech** gets Slovak, **a phone set to `en-GB` or `de`** gets English, **an empty `navigator.languages`** gets English → Task 1 test.
4. **Switching the language while the tab bar and header stay mounted**: they must change at once, not after a navigation → Task 4 browser test.
5. **English plurals at 0, 1, 2** ("0 days", "1 day", "2 days") and Slovak at 1, 2, 5 → Task 2 test.

---

### Task 1: The language store

**Files:**
- Create: `src/lib/language.ts`, `src/lib/language.test.ts`, `src/test-setup.ts`
- Modify: `vitest.config.ts` (add `setupFiles`), `src/main.tsx` (apply `<html lang>` at start)

**Interfaces:**
- Produces: `type Language = 'sk' | 'en'`; `LANGUAGES: Language[]`; `detectLanguage(languages: readonly string[]): Language`; `parseLanguage(raw: unknown): Language | undefined`; `getLanguage(): Language`; `setLanguage(language: Language): void`; `useLanguage(): Language`; `subscribeLanguage(notify: () => void): () => void`.

- [ ] **Step 1: Write the failing test** — `src/lib/language.test.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { detectLanguage, getLanguage, parseLanguage, setLanguage } from './language'

describe('detectLanguage', () => {
  it.each([
    [['sk-SK', 'en'], 'sk'],
    [['sk'], 'sk'],
    [['cs-CZ'], 'sk'], // a Czech phone reads Slovak better than English
    [['en-US'], 'en'],
    [['en-GB', 'sk'], 'en'], // only the first choice counts
    [['de-DE'], 'en'],
    [[], 'en'],
  ] as const)('%j → %s', (languages, expected) => {
    expect(detectLanguage(languages)).toBe(expected)
  })
})

describe('parseLanguage', () => {
  it('accepts the two languages and nothing else', () => {
    expect(parseLanguage('sk')).toBe('sk')
    expect(parseLanguage('en')).toBe('en')
    for (const bad of ['de', '', 'SK', null, undefined, 1, {}]) expect(parseLanguage(bad)).toBeUndefined()
  })
})

describe('the store', () => {
  afterEach(() => setLanguage('sk'))

  it('works where there is no storage (unit tests, the build)', () => {
    expect(() => setLanguage('en')).not.toThrow()
    expect(getLanguage()).toBe('en')
  })
})
```

- [ ] **Step 2: Run it** — `npx vitest run src/lib/language.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement** — `src/lib/language.ts`

```ts
import { useSyncExternalStore } from 'react'

// The language of the interface and of the teaching content. Stored per device; until the learner
// chooses, it follows the phone.

export type Language = 'sk' | 'en'
export const LANGUAGES: Language[] = ['sk', 'en']

const STORAGE_KEY = 'somos-language'

export const parseLanguage = (raw: unknown): Language | undefined => (raw === 'sk' || raw === 'en' ? raw : undefined)

/** Slovak for a Slovak or Czech phone, English for everybody else. Only the first choice counts. */
export function detectLanguage(languages: readonly string[]): Language {
  return /^(sk|cs)\b/i.test(languages[0] ?? '') ? 'sk' : 'en'
}

function readLanguage(): Language {
  try {
    const stored = parseLanguage(localStorage.getItem(STORAGE_KEY))
    if (stored) return stored
  } catch {
    // No storage (private mode, unit tests): the phone's language.
  }
  return detectLanguage(typeof navigator === 'undefined' ? [] : (navigator.languages ?? []))
}

let language = readLanguage()
const listeners = new Set<() => void>()

function apply() {
  if (typeof document !== 'undefined') document.documentElement.lang = language
}
apply()

/** Current language outside React (texts built in src/lib, the backup). */
export const getLanguage = () => language

export function setLanguage(next: Language) {
  language = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // The choice just won't survive a reload.
  }
  apply()
  listeners.forEach((notify) => notify())
}

export function subscribeLanguage(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useLanguage(): Language {
  return useSyncExternalStore(subscribeLanguage, getLanguage)
}
```

`src/test-setup.ts`:

```ts
import { setLanguage } from './lib/language'

// Node reports en-US: the unit tests assert the Slovak texts, so they run in Slovak.
setLanguage('sk')
```

`vitest.config.ts`: add `setupFiles: ['src/test-setup.ts'],` under `test`.

`src/main.tsx`: add `import './lib/language'` (sets `<html lang>` before the first render).

- [ ] **Step 4: Run** — `npx vitest run src/lib/language.test.ts` → PASS; `npm test` → all pass.
- [ ] **Step 5: Commit** — `feat(language): the language setting's store`

### Task 2: The dictionaries

**Files:**
- Create: `src/i18n/sk.ts`, `src/i18n/en.ts`, `src/i18n/index.ts`, `src/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `getLanguage`, `subscribeLanguage`, `Language` (Task 1).
- Produces: `type Dictionary = typeof sk`; `t(): Dictionary`; `useT(): Dictionary`; `dictionaries: Record<Language, Dictionary>`; `pluralEn(count: number, one: string, many: string): string`. Dictionary groups filled by later tasks: `common`, `nav`, `settings`, `reminder`, `home`, `exercise`. Every dictionary has `dateLocale: string` and `languageName: string`.

- [ ] **Step 1: Write the failing test** — `src/i18n/i18n.test.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest'
import { setLanguage } from '../lib/language'
import { dictionaries, pluralEn, t } from './index'

afterEach(() => setLanguage('sk'))

describe('t', () => {
  it('follows the language', () => {
    expect(t().languageName).toBe('Slovenčina')
    setLanguage('en')
    expect(t().languageName).toBe('English')
  })

  it('has a date locale per language', () => {
    expect(dictionaries.sk.dateLocale).toBe('sk-SK')
    expect(dictionaries.en.dateLocale).toBe('en-US')
  })
})

describe('plurals', () => {
  it('English: one form for 1, another for everything else', () => {
    expect([0, 1, 2].map((n) => pluralEn(n, 'day', 'days'))).toEqual(['days', 'day', 'days'])
  })

  it('counts days in both languages', () => {
    expect([1, 2, 5].map((n) => dictionaries.sk.home.streakDays(n))).toEqual(['deň v rade', 'dni v rade', 'dní v rade'])
    expect([0, 1, 2].map((n) => dictionaries.en.home.streakDays(n))).toEqual(['days in a row', 'day in a row', 'days in a row'])
  })
})
```

- [ ] **Step 2: Run** → FAIL, module not found.
- [ ] **Step 3: Implement** `src/i18n/index.ts`:

```ts
import { useSyncExternalStore } from 'react'
import { getLanguage, subscribeLanguage, type Language } from '../lib/language'
import { en } from './en'
import { sk, type Dictionary } from './sk'

// Interface texts. sk.ts is the model; en.ts has to have its shape, or the build fails.

export type { Dictionary }
export const dictionaries: Record<Language, Dictionary> = { sk, en }

/** The texts in the current language, outside React. Call it from a component that uses useT(). */
export const t = (): Dictionary => dictionaries[getLanguage()]

/** The texts in the current language; the component re-renders when the language changes. */
export function useT(): Dictionary {
  return useSyncExternalStore(subscribeLanguage, t)
}

export { pluralEn } from './en'
```

`sk.ts` starts with `languageName`, `dateLocale` and the groups of Tasks 3–5; every Slovak text is copied character for character from the component it leaves. `en.ts` exports `pluralEn` and `en: Dictionary`.

- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** together with Task 3 (the dictionaries have no reader until then).

### Task 3: Nastavenia in two languages, with the switch

**Files:**
- Modify: `src/features/archive/SettingsPage.tsx`, `AutoReviewSettings.tsx`, `ReminderSettings.tsx`, `VoiceSettings.tsx`, `BackupSettings.tsx`, `src/lib/reminder.ts` (`REMINDER_ERRORS`, `reminderProblem()`), `src/lib/reminderStatus.ts` (`describeStatus`), `src/lib/settingsBackup.ts`, `src/lib/backup.ts` (where settings are collected and restored), `src/i18n/sk.ts`, `src/i18n/en.ts`
- Test: `src/lib/settingsBackup.test.ts`, `e2e/language.spec.ts` (new)

**Interfaces:**
- Consumes: `useT`, `t`, `setLanguage`, `useLanguage`, `parseLanguage`.
- Produces: `SettingsBackup.language?: Language`; dictionary groups `settings`, `reminder`.

- [ ] **Step 1: Failing tests.** In `settingsBackup.test.ts`:

```ts
it('carries the language, and drops one it does not know', () => {
  expect(parseSettingsBackup({ language: 'en' }).language).toBe('en')
  expect(parseSettingsBackup({ language: 'de' }).language).toBeUndefined()
})
```

`e2e/language.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('the language is switched in Nastavenia and applies at once, everywhere', async ({ page }) => {
  await page.goto('/archive/settings')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nastavenia')
  await page.getByRole('radio', { name: 'English' }).tap()

  // The page itself and the bars that stay mounted around it.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  // It survives a reload, and Domov greets in English.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await page.getByRole('navigation').getByRole('link', { name: 'Home' }).tap()
  await expect(page.getByRole('heading', { name: 'Last 7 days' })).toBeVisible()

  await page.goto('/archive/settings')
  await page.getByRole('radio', { name: 'Slovenčina' }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nastavenia')
})

test('a phone that is not Slovak or Czech starts in English', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' })
  const page = await context.newPage()
  await page.goto('/archive/settings')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await context.close()
})
```

- [ ] **Step 2: Run** → both fail.
- [ ] **Step 3: Implement.** The "Jazyk" section is the first one on the page:

```tsx
<section aria-labelledby="language-heading">
  <SectionTitle id="language-heading">{text.settings.language}</SectionTitle>
  <Segmented
    mode="radio"
    label={text.settings.language}
    idPrefix="language"
    value={language}
    onChange={setLanguage}
    options={LANGUAGES.map((id) => ({ id, label: dictionaries[id].languageName }))}
  />
</section>
```

Each language is named in itself ("Slovenčina", "English") whatever the current one is. Every literal of the five settings components, `REMINDER_ERRORS`, `reminderProblem()` and `describeStatus()` moves to the dictionary; `REMINDER_ERRORS` becomes `reminderErrors()` reading `t().reminder.errors`. The backup writes `language: getLanguage()` and a restore calls `setLanguage` when the file has one.

- [ ] **Step 4: Run** `npm test` and `npx playwright test e2e/language.spec.ts` → the settings assertions pass (the tab bar and Domov ones wait for Tasks 4 and 5).
- [ ] **Step 5: Commit** — `feat(language): Nastavenia in Slovak and English, with the switch`

### Task 4: Shared components

**Files:**
- Modify: `src/components/TabBar.tsx`, `AppLayout.tsx`, `BackButton.tsx`, `NotFound.tsx`, `SearchField.tsx`, `SpeakButton.tsx`, `ThemeToggle.tsx`, `src/i18n/sk.ts`, `src/i18n/en.ts`

**Interfaces:**
- Produces: dictionary groups `nav` (`home`, `search`, `practice`, `archive`, `main`, `searchWord`) and `common` (`back`, `clear`, `playPronunciation(text)`, `notFoundHint`, theme labels).

- [ ] **Step 1:** the failing assertion is already in `e2e/language.spec.ts` (the tab bar link "Home").
- [ ] **Step 2: Implement.** `TABS` keeps `to`, `icon`, `sections` and gets `key: 'home' | 'search' | 'practice' | 'archive'`; the label is `text.nav[tab.key]`. Both bars use `useT()`: they stay mounted while the language changes.
- [ ] **Step 3: Run** the language spec (tab bar assertion passes) and the whole e2e suite (Slovak unchanged).
- [ ] **Step 4: Commit** — `feat(language): shared components in both languages`

### Task 5: Domov

**Files:**
- Modify: `src/features/home/HomePage.tsx`, `ProgressTiles.tsx`, `ReviewCard.tsx`, `WeekChart.tsx`, `WordOfDayCard.tsx`, `continueLesson.ts`, `src/features/exercises/exercises.ts` (exercise names, descriptions, instructions), `src/i18n/sk.ts`, `src/i18n/en.ts`

**Interfaces:**
- Produces: dictionary groups `home` (incl. `streakDays(n)`, `words(n)`, `sentences(n)`, `answers(n)`, `mistakesWaiting(n)`, `weekdays: string[]` in `Date.getDay()` order) and `exercise` (`Record<ExerciseType, { label, description, instruction }>`, `allTopics`, `allTenses`, `noSpeech`).
- `EXERCISES` keeps `type`, `icon`, `unavailable: boolean`; `exerciseInfo(type)` returns the same object as today with `label`, `description`, `instruction` read from `t().exercise[type]`, so its callers do not change.

- [ ] **Step 1:** failing assertions: "Last 7 days" in `e2e/language.spec.ts`; the plural test of Task 2.
- [ ] **Step 2: Implement.** Dates use `text.dateLocale`. The topic name in `continueLesson` stays `topic.sk` (content, step 3 of the spec).
- [ ] **Step 3: Run** `npm test`, `npm run build`, `npm run test:e2e` → all pass, the existing 18 browser tests untouched.
- [ ] **Step 4: Commit** — `feat(language): Domov in both languages`, then push.

## What Adam tests on the phone

Nastavenia → Jazyk → English: the tab bar, the header, Domov and the whole of Nastavenia are in English at once; everything else is still Slovak (steps 2–4). Back to Slovenčina: the app is exactly as before. The backup carries the language.

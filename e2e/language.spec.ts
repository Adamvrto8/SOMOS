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
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Domov' })).toBeVisible()
})

test('a phone that is not Slovak or Czech starts in English', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'de-DE' })
  const page = await context.newPage()
  await page.goto('/archive/settings')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Settings')
  await context.close()
})

test('the screens are in English: search, a lesson with its feedback, review and the archive', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()

  await page.goto('/search')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search')
  await expect(page.getByRole('button', { name: 'Verbs' })).toBeVisible()

  await page.goto('/practice')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Practice')
  await expect(page.getByRole('radio', { name: /Fill in the blank/ })).toBeVisible()

  await page.goto('/practice/lesson?type=conjugation&tense=presente&level=A1&lesson=1')
  await expect(page.getByRole('textbox', { name: 'Verb form' })).toBeVisible()
  await page.getByRole('button', { name: 'Give up', exact: true }).tap()
  await expect(page.getByRole('status')).toContainText('Correct answer')
  await page.getByRole('button', { name: 'Why?', exact: true }).tap()
  await expect(page.getByRole('dialog').getByLabel('In this task')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).tap()
  await page.getByRole('button', { name: 'Continue', exact: true }).tap()

  await page.goto('/review')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing to review')

  await page.goto('/archive')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Archive')
  await expect(page.getByRole('tab', { name: /^Mistakes/ })).toBeVisible()
  await context.close()
})

test('English content shows where it exists, Slovak where it does not yet', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' })
  const page = await context.newPage()

  // The weather topic is translated: its name, the words, a word's example and note.
  await page.goto('/topic/weather')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Weather')
  await expect(page.getByRole('link', { name: /lluvia.*rain/ })).toBeVisible()
  await page.goto('/word/clima')
  await expect(page.getByText('weather, climate')).toBeVisible()
  await expect(page.getByText("What's the weather like today?")).toBeVisible()
  await expect(page.getByLabel('Note')).toContainText('masculine')

  // A word of a topic without English yet keeps its Slovak translation.
  await page.goto('/word/casa')
  await expect(page.getByText('dom, domov')).toBeVisible()

  // Search finds a word by its English translation, and offers the online lookup in the English direction.
  await page.goto('/search?q=rain')
  await expect(page.getByRole('link', { name: /lluvia.*rain/ })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'EN → ES' })).toBeVisible()

  // A verb asked in a lesson is explained in English.
  await page.goto('/practice/lesson?type=conjugation&tense=presente&level=A1&lesson=1')
  await page.getByRole('button', { name: 'Give up', exact: true }).tap()
  await page.getByRole('button', { name: 'Why?', exact: true }).tap()
  await expect(page.getByRole('dialog').getByLabel('In this task')).toContainText(/ (verb|form|stem)[ .]/)
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).tap()

  // A grammar tip that has an English version, and one that has not.
  await page.goto('/practice/grammar/futuro')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Future tense (futuro)')
  await expect(page.getByText('Tomorrow I will talk to the boss.')).toBeVisible()
  await page.goto('/practice/grammar/presente')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prítomný čas (presente)')
  await context.close()
})

import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

/** Answers /api/translate like the server would with a limit reached. */
async function fakeTranslate(page: Page, status: number, body: object) {
  await page.route('**/api/translate', (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }))
}

async function lookUp(page: Page, query: string) {
  await page.goto('/search')
  await page.getByRole('searchbox').fill(query)
  await button(page, 'Preložiť').tap()
}

test('a learner over the hourly limit is told to wait a while', async ({ page }) => {
  await fakeTranslate(page, 429, { error: 'too-many' })
  await lookUp(page, 'zmrzlinár')
  await expect(page.getByText('Hľadaní bolo priveľa, skús to o chvíľu.')).toBeVisible()
})

test('a used-up day says so, and the dictionary search goes on', async ({ page }) => {
  await fakeTranslate(page, 503, { error: 'daily-limit' })
  await lookUp(page, 'zmrzlinár')
  await expect(page.getByText('Online preklad je dnes vyčerpaný, skús to zajtra.')).toBeVisible()
  await page.getByRole('searchbox').fill('casa')
  await expect(page.getByRole('link', { name: /casa/ }).first()).toBeVisible()
})

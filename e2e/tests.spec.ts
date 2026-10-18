import { expect, test, type Page } from '@playwright/test'
import { button, field, status } from './helpers.ts'

const foodTest = '/practice/test?level=A1&topic=food'

/** Results as the app stores them (src/lib/testProgress.ts), before the page loads. */
async function seedResults(page: Page, results: Record<string, object>) {
  await page.addInitScript((data) => localStorage.setItem('somos-tests-v1', data), JSON.stringify(results))
}

test('Cvičiť leads to the tests, the exam of the level on top', async ({ page }) => {
  await page.goto('/practice')
  await page.getByRole('link', { name: /Testy/ }).tap()
  await expect(page).toHaveURL(/\/practice\/tests/)
  await expect(page.getByRole('link', { name: /Skúška A1/ })).toContainText('Témy: 0/19 zložených')
  await expect(page.getByRole('link', { name: /Jedlo a pitie/ })).toContainText('Ešte neskúšané')
})

test('a test shows no verdict while it runs and scores at the end', async ({ page }) => {
  await page.goto(foodTest)
  await expect(page.getByRole('heading', { name: 'Jedlo a pitie · A1' })).toBeVisible()
  await expect(page.getByText('aspoň 12 z 15')).toBeVisible()
  await button(page, 'Začať test').tap()
  await expect(page.locator('header')).toContainText('1/15')

  // The first tasks are vocabulary: a wrong word goes through without a word about it.
  await expect(button(page, 'Ďalej')).toBeDisabled()
  await field(page).fill('zzzz')
  await button(page, 'Ďalej').tap()
  await expect(page.locator('header')).toContainText('2/15')
  await expect(status(page)).toHaveCount(0)

  for (let i = 2; i <= 15; i++) {
    await expect(page.locator('header')).toContainText(`${i}/15`)
    await button(page, 'Neviem').tap()
  }

  await expect(page.getByText('Zatiaľ nezložený')).toBeVisible()
  await expect(page.getByText('Na zloženie treba 12/15, chýba ešte 12.')).toBeVisible()
  await expect(page.getByText('Tvoja odpoveď: zzzz')).toBeVisible()

  // A free answer may be accepted, as in a lesson: the score goes up.
  await button(page, 'Moja odpoveď bola tiež správna').tap()
  await expect(page.getByText('Uznané')).toBeVisible()
  await expect(page.getByText('Na zloženie treba 12/15, chýba ešte 11.')).toBeVisible()

  await button(page, 'Späť na testy').tap()
  await expect(page.getByRole('link', { name: /Jedlo a pitie/ })).toContainText('Najlepšie: 1/15')
})

test('leaving a test halfway asks first', async ({ page }) => {
  await page.goto(foodTest)
  await button(page, 'Začať test').tap()
  await button(page, 'Neviem').tap()
  await page.getByRole('button', { name: 'Ukončiť test' }).tap()
  await expect(page.getByText('Ukončiť test?')).toBeVisible()
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/15')
})

test('Pripraviť sa is a practice lesson from the test', async ({ page }) => {
  await page.goto(foodTest)
  await page.getByRole('link', { name: /Pripraviť sa/ }).tap()
  await expect(page).toHaveURL(/prepare=food:A1/)
  await expect(page.getByText(/^Príprava na test ·/)).toBeVisible()
  await expect(page.locator('header')).toContainText('1/10')
})

test('a passed test counts on the tests page and moves the goal on Domov', async ({ page }) => {
  await seedResults(page, { 'greetings:A1': { bestScore: 14, total: 15, passed: true, passedAt: Date.now(), attempts: 2, lastAt: Date.now() } })
  await page.goto('/')
  const goal = page.getByRole('link', { name: /Ďalší cieľ/ })
  await expect(goal).toContainText('Test: Základné slová · A1')
  await expect(goal).toContainText('A1 · témy 1/19')

  await page.goto('/practice/tests?level=A1')
  await expect(page.getByRole('link', { name: /Pozdravy a frázy/ })).toContainText('Zložené')
  await expect(page.getByRole('link', { name: /Skúška A1/ })).toContainText('Témy: 1/19 zložených')
})

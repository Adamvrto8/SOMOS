import { expect, test, type Page } from '@playwright/test'
import { button, field, status, words } from './helpers.ts'

const foodTest = '/practice/test?level=A1&topic=food'

/** Results as the app stores them (src/lib/testProgress.ts), before the page loads. */
async function seedResults(page: Page, results: Record<string, object>) {
  await page.addInitScript((data) => localStorage.setItem('somos-tests-v1', data), JSON.stringify(results))
}

test('Cvičiť leads to the tests, the exam of the level on top', async ({ page }) => {
  await page.goto('/practice')
  await page.getByRole('link', { name: /Testy/ }).tap()
  await expect(page).toHaveURL(/\/practice\/tests/)
  await expect(page.getByRole('link', { name: /Skúška A1/ })).toContainText('Témy: 0/20 zložených')
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
  await expect(goal).toContainText('A1 · témy 1/20')

  await page.goto('/practice/tests?level=A1')
  await expect(page.getByRole('link', { name: /Pozdravy a frázy/ })).toContainText('Zložené')
  await expect(page.getByRole('link', { name: /Skúška A1/ })).toContainText('Témy: 1/20 zložených')
})

const vocabA1Lessons = Math.ceil(words.filter((w) => w.level === 'A1').length / 10)

test('the lessons of Všetko × A1 end with a test, locked until they are passed', async ({ page }) => {
  await page.goto('/practice?type=vocab&topic=all&level=A1')
  const card = page.getByText('Test: Slovná zásoba · A1')
  await expect(card).toBeVisible()
  await expect(page.getByText(`Odomkne sa po splnení všetkých lekcií (0/${vocabA1Lessons})`)).toBeVisible()
  await expect(page.getByRole('link', { name: /Test: Slovná zásoba · A1/ })).toHaveCount(0)

  // A typed address does not open it either.
  await page.goto('/practice/test?level=A1&type=vocab')
  await expect(page.getByText('Test je zamknutý')).toBeVisible()

  // A topic has no such test.
  await page.goto('/practice?type=vocab&topic=food&level=A1')
  await expect(page.getByRole('button', { name: 'Lekcia 1, aktuálna' })).toBeVisible()
  await expect(page.getByText('Test: Slovná zásoba · A1')).toHaveCount(0)
})

test('with every lesson passed the test opens and is offered at the bottom', async ({ page }) => {
  const passed = Object.fromEntries(
    Array.from({ length: vocabA1Lessons }, (_, i) => [`vocab:all:A1:${i + 1}`, { bestScore: 10, total: 10, passed: true, passedAt: 1 }]),
  )
  await page.addInitScript((data) => localStorage.setItem('somos-lesson-progression-v2', data), JSON.stringify(passed))
  await page.goto('/practice?type=vocab&topic=all&level=A1')
  await expect(page.getByRole('link', { name: /Test: Slovná zásoba · A1/ })).toContainText('30 úloh zo všetkých lekcií')
  await button(page, 'Spraviť test').tap()
  await expect(page.getByRole('heading', { name: 'Test: Slovná zásoba · A1' })).toBeVisible()
  await expect(page.getByText('aspoň 24 z 30')).toBeVisible()
  await button(page, 'Začať test').tap()
  await expect(page.locator('header')).toContainText('1/30')
})

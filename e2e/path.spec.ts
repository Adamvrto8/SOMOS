import { expect, test, type Page } from '@playwright/test'
import { button, field, status } from './helpers.ts'

// The guided path (src/lib/path.ts): units of steps, each step a lesson, the unit's test the last one.

const passed = { bestScore: 10, total: 10, passed: true }

/** Lesson records and test results as the app stores them, before the page loads. */
async function seed(page: Page, lessons: Record<string, object>, tests: Record<string, object> = {}) {
  await page.addInitScript(
    ([l, t]) => {
      localStorage.setItem('somos-lesson-progression-v2', l)
      localStorage.setItem('somos-tests-v1', t)
    },
    [JSON.stringify(lessons), JSON.stringify(tests)],
  )
}

test('Cvičiť leads to the path, its first unit open on its steps', async ({ page }) => {
  await page.goto('/practice')
  await page.getByRole('link', { name: /Cesta/ }).tap()
  await expect(page).toHaveURL(/\/practice\/path$/)
  await expect(page.getByRole('heading', { name: 'Cesta' })).toBeVisible()
  await expect(page.getByText(/^A1 · 0 z \d+ jednotiek$/)).toBeVisible()

  const first = page.getByRole('button', { name: /Pozdravy a frázy 1/ })
  await expect(first).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('link', { name: 'Nové slová', exact: true })).toBeVisible()
  // The steps go in order, but the test is open from the start.
  await expect(page.getByRole('link', { name: 'Nové slová II' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Test jednotky' })).toHaveAttribute('href', '/practice/test?level=A1&topic=greetings&part=1')
  await expect(page.getByRole('link', { name: 'Tip' })).toHaveAttribute('href', '/practice/grammar/ser-estar')
  // The next unit waits for this one's test.
  await expect(page.getByText('Otvorí sa po teste predošlej jednotky').first()).toBeVisible()

  await first.tap()
  await expect(first).toHaveAttribute('aria-expanded', 'false')
})

test('a step is a lesson of the unit, scored like a numbered lesson', async ({ page }) => {
  await page.goto('/practice/path')
  await page.getByRole('link', { name: 'Nové slová', exact: true }).tap()
  await expect(page).toHaveURL(/\/practice\/lesson\?path=a1-greetings-1&step=words$/)

  // First the new words, a card each, nothing to answer; a swipe or the buttons turn them.
  await expect(page.getByText('Nové slovo · 1 z 10')).toBeVisible()
  await expect(page.getByRole('heading', { name: /hola/i })).toBeVisible()
  await button(page, 'Ďalšie slovo').tap()
  await expect(page.getByText('Nové slovo · 2 z 10')).toBeVisible()
  await button(page, 'Späť').tap()
  await expect(page.getByText('Nové slovo · 1 z 10')).toBeVisible()
  for (let i = 1; i < 10; i++) await button(page, 'Ďalšie slovo').tap()
  await button(page, 'Precvičiť slová').tap()
  await expect(page.getByText(/^Jednotka 1 · Nové slová · /)).toBeVisible()

  const total = Number((await page.locator('header').innerText()).match(/\/(\d+)/)![1])
  for (let i = 0; i < total; i++) {
    await field(page).fill('zzzz')
    await button(page, 'Skontrolovať').tap()
    await button(page, 'Vzdať sa').tap()
    await expect(status(page)).toContainText('Nesprávne')
    await button(page, 'Pokračovať').tap()
  }
  await expect(page.getByRole('heading', { name: 'Nové slová: zatiaľ nesplnené' })).toBeVisible()
  await expect(button(page, 'Ďalší krok (zamknutý)')).toBeDisabled()

  // ✕ goes back to the path, where the step is still the one to do.
  await page.getByRole('button', { name: 'Ukončiť lekciu' }).tap()
  await expect(page).toHaveURL(/\/practice\/path$/)
})

test('a passed step opens the next one, which the result leads to', async ({ page }) => {
  await seed(page, { 'path:a1-greetings-1:words': { bestScore: 9, total: 10, passed: false, solved: [] } })
  await page.goto('/practice/path')
  await expect(page.getByRole('link', { name: 'Nové slová II' })).toHaveCount(0)

  await seed(page, { 'path:a1-greetings-1:words': passed })
  await page.goto('/practice/path')
  await page.getByRole('link', { name: 'Nové slová II' }).tap()
  await expect(page).toHaveURL(/step=words2$/)
  await expect(page.getByText(/^Nové slovo · 1 z \d+$/)).toBeVisible()
  await button(page, 'Preskočiť').tap()
  await expect(page.getByText(/^Jednotka 1 · Nové slová II · /)).toBeVisible()
})

test('the grammar step opens on its tip, the rules of the unit named', async ({ page }) => {
  await seed(page, { 'path:a1-greetings-1:words': passed, 'path:a1-greetings-1:words2': passed })
  await page.goto('/practice/path')
  await page.getByRole('link', { name: 'Gramatika', exact: true }).tap()
  await expect(page).toHaveURL(/step=grammar$/)
  await expect(page.getByText('Gramatika jednotky')).toBeVisible()
  await expect(page.getByText('Dnes: Kto alebo čo to je, Pôvod, Povolanie')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'ser a estar' })).toBeVisible()
  await button(page, 'Rozumiem, začať').tap()
  await expect(page.getByText(/^Jednotka 1 · Gramatika · /)).toBeVisible()
})

test('a unit test leads back to the path', async ({ page }) => {
  await page.goto('/practice/test?level=A1&topic=greetings&part=1')
  await button(page, 'Začať test').tap()
  await field(page).fill('zzzz')
  await button(page, 'Ďalej').tap()
  for (let i = 2; i <= 15; i++) {
    await expect(page.locator('header')).toContainText(`${i}/15`)
    await button(page, 'Neviem').tap()
  }
  await expect(page.getByText('Zatiaľ nezložený')).toBeVisible()
  await expect(page.getByText('¡Unidad completada!')).toHaveCount(0)
  await button(page, 'Späť na cestu').tap()
  await expect(page).toHaveURL(/\/practice\/path$/)
})

test('a passed topic test closes its unit, and Domov goes on with the next one', async ({ page }) => {
  await seed(page, { 'path:a1-basics-1:words': passed }, { 'greetings:A1': { bestScore: 14, total: 15, passed: true, attempts: 1, lastAt: 1 } })
  await page.goto('/')
  await expect(page.getByText('Tvoja cesta')).toBeVisible()
  await expect(page.getByText('Jednotka 2 · Základné slová 1 · Nové slová II (2/7)')).toBeVisible()
  await page.getByRole('link', { name: 'Jednotka 2: Nové slová II' }).tap()
  await expect(page).toHaveURL(/path=a1-basics-1&step=words2$/)

  await page.goto('/practice/path')
  // The topic test closes both units of the topic.
  await expect(page.getByText(/^A1 · 2 z \d+ jednotiek$/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Základné slová 1/ })).toHaveAttribute('aria-expanded', 'true')
})

test('a step that is not open yet does not open from its address', async ({ page }) => {
  await page.goto('/practice/lesson?path=a1-basics-1&step=words')
  await expect(page.getByText('Lekcia je zamknutá')).toBeVisible()
})

import { expect, test, type Page } from '@playwright/test'
import { button, field } from './helpers.ts'

/** One vocab task given up: it becomes a mistake (and a flashcard due in a few days). */
async function missOneWord(page: Page) {
  await page.goto('/practice/lesson?type=vocab&topic=all&level=A1&lesson=1')
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')
}

test.beforeEach(async ({ page }) => {
  // A learner who went through the welcome at A1: Domov goes on with Cesta.
  await page.addInitScript(() => localStorage.setItem('somos-onboarding', JSON.stringify({ done: true, level: 'A1' })))
})

test('the tabs carry what waits: flashcards on Domov, mistakes on Cvičiť; Domov keeps the next step of Cesta in reach', async ({ page }) => {
  await missOneWord(page)
  // A starred word is a flashcard due at once.
  await page.goto('/word/casa')
  await button(page, 'Uložiť do môjho slovníka').tap()
  await page.goto('/')

  const bar = page.getByRole('navigation', { name: 'Hlavná navigácia' })
  await expect(bar.getByRole('link', { name: 'Domov, 1 kartička na dnes' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Cvičiť, 1 chyba na opravu' })).toBeVisible()
  await expect(bar.getByRole('link', { name: 'Cesta', exact: true })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Kartičky na dnes' })).toBeVisible()
  const pathRow = page.getByRole('link', { name: /^Ďalej na Ceste:/ })
  await pathRow.tap()
  await expect(page).toHaveURL(/\/practice\/lesson\?path=/)

  // Môj slovník is in Profil, with its numbers.
  await page.goto('/profile')
  const mine = page.getByRole('region', { name: 'Môj slovník' })
  await expect(mine.getByRole('link', { name: /^Chyby/ })).toContainText('1')
  await mine.getByRole('link', { name: /^Chyby/ }).tap()
  await expect(page).toHaveURL(/\/archive\?tab=mistakes$/)
  await expect(bar.getByRole('link', { name: /^Profil/ })).toHaveAttribute('aria-current', 'page')
})

test('Zmiešané cvičenie is the first card of Cvičiť: ten tasks of the level, named as such, ✕ back to Cvičiť', async ({ page }) => {
  await page.goto('/practice')
  // Cesta has its own tab: no card for it here any more.
  await expect(page.getByRole('main').getByRole('link', { name: /^Cesta/ })).toHaveCount(0)
  const mixed = page.getByRole('link', { name: /^Zmiešané cvičenie/ })
  await expect(mixed).toContainText('10 úloh z celej úrovne A1')
  await mixed.tap()
  await expect(page).toHaveURL(/\/practice\/lesson\?mixed=A1$/)
  await expect(page.locator('header')).toContainText('1/10')
  await expect(page.getByRole('main')).toContainText('Zmiešané cvičenie ·')
  await page.getByRole('button', { name: 'Ukončiť lekciu' }).tap()
  await expect(page).toHaveURL(/\/practice$/)
})

test('the old address of Cesta still opens it', async ({ page }) => {
  await page.goto('/practice/path')
  await expect(page).toHaveURL(/\/path$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cesta')
})

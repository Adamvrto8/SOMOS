import { expect, test } from '@playwright/test'
import { seedAttempts } from './helpers.ts'

// The daily goal is 20 right answers here, and two of three seeded answers are right: 30 answers
// reach it. Reached yesterday and the day before, missed three days ago, reached on the three days
// before that, and on four days in a row six weeks ago.
const PAST = { 1: 30, 2: 36, 3: 5, 4: 30, 5: 30, 6: 30, 40: 30, 41: 30, 42: 30, 43: 30 }

test('the week chart on Domov opens the overview: streaks, a longer history, what was practised', async ({ page }) => {
  await page.goto('/')
  await seedAttempts(page, PAST)

  await page.getByRole('link', { name: /^Celý prehľad/ }).tap()
  await expect(page).toHaveURL(/\/stats$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prehľad')
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Domov' })).toHaveAttribute('aria-current', 'page')

  // Since the first answer.
  const figure = (caption: string | RegExp) => page.locator('dl > div').filter({ hasText: caption }).locator('dd')
  await expect(figure('dni v rade')).toHaveText('2')
  await expect(figure('najdlhšia séria')).toHaveText('4')
  await expect(figure('odpovedí spolu')).toHaveText('281')
  await expect(figure('správnych odpovedí')).toHaveText(/^6\d %$/)

  // 30 days by default, 90 on request.
  const history = page.getByRole('region', { name: 'História' })
  await expect(history).toContainText('161 odpovedí')
  await expect(history).toContainText('splnený 5 z 30 dní')
  await page.getByRole('button', { name: '90 dní' }).tap()
  await expect(history).toContainText('281 odpovedí')
  await expect(history).toContainText('splnený 9 z 90 dní')
  await page.getByRole('button', { name: '7 dní' }).tap()
  await expect(history).toContainText('splnený 5 z 7 dní')

  // A day is picked with the arrows…
  await expect(history).toContainText('Dnes')
  await expect(history).toContainText('0 odpovedí')
  await page.getByRole('button', { name: 'Predchádzajúci deň' }).tap()
  await expect(history).toContainText('30 odpovedí, 20 správne')
  await expect(history).toContainText('cieľ splnený')
  // …or by touching its column: three days ago is the fourth of seven from the right.
  const plot = (await page.getByRole('img', { name: /^Správne odpovede po dňoch/ }).boundingBox())!
  await page.touchscreen.tap(plot.x + plot.width * (3.5 / 7), plot.y + plot.height / 2)
  await expect(history).toContainText('5 odpovedí, ')
  await expect(history).not.toContainText('cieľ splnený')

  const practised = page.getByRole('region', { name: /^Čo si cvičil/ })
  await expect(practised.getByRole('listitem')).toHaveText([/^Slovná zásoba/, /^Opakovanie/])

  await page.getByRole('button', { name: 'Späť' }).tap()
  await expect(page).toHaveURL(/\/$/)
})

test('the overview is there before the first answer', async ({ page }) => {
  await page.goto('/stats')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prehľad')
  await expect(page.getByText('V tomto období žiadne odpovede.')).toBeVisible()
})

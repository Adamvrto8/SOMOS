import { expect, test } from '@playwright/test'
import { button } from './helpers.ts'

test('Nastavenia is a list of what is set; a row opens its own page and the change shows back in the list', async ({ page }) => {
  await page.goto('/archive/settings')
  const goal = page.getByRole('link', { name: /^Denný cieľ/ })
  await expect(goal).toContainText('20')
  await expect(page.getByRole('link', { name: /^Opakovanie slov/ })).toContainText('20 denne')
  await expect(page.getByRole('link', { name: /^Pripomienka/ })).toContainText('Vypnuté')
  await expect(page.getByRole('link', { name: /^Vzhľad/ })).toContainText('Pôvodný')

  await goal.tap()
  await expect(page).toHaveURL(/\/archive\/settings\/goal$/)
  await expect(page.getByRole('radio', { name: '20 správnych odpovedí' })).toBeChecked()
  await page.getByRole('radio', { name: '30 správnych odpovedí' }).tap()
  await button(page, 'Späť').tap()
  await expect(goal).toContainText('30')

  // An address that is no setting leads back to the list.
  await page.goto('/archive/settings/nope')
  await expect(page).toHaveURL(/\/archive\/settings$/)
})

test('a learner sees no developer tools until the version is tapped seven times', async ({ page }) => {
  // The dev server starts in developer mode; switched off, it shows Nastavenia as a learner has them.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('somos-dev-mode', 'off')
      sessionStorage.setItem('seeded', '1')
    }
  })
  await page.goto('/archive/settings')
  const tools = page.getByRole('link', { name: /^Nástroje pre vývoj/ })
  await expect(tools).toHaveCount(0)
  await page.goto('/archive/settings/dev')
  await expect(page).toHaveURL(/\/archive\/settings$/)

  const version = page.getByRole('button', { name: /^SOMOS · verzia/ })
  for (let i = 0; i < 3; i++) await version.tap()
  await expect(page.getByText('Ešte 4 ťuknutia a zapne sa vývojársky režim.')).toBeVisible()
  for (let i = 0; i < 4; i++) await version.tap()
  await expect(page.getByText('Vývojársky režim je zapnutý.')).toBeVisible()

  // It stays on after a reload, and its page has the tools.
  await page.reload()
  await tools.tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nástroje pre vývoj')
  await expect(button(page, 'Ukázať slnko denného cieľa')).toBeVisible()

  await button(page, 'Vypnúť vývojársky režim').tap()
  await expect(page).toHaveURL(/\/archive\/settings$/)
  await expect(tools).toHaveCount(0)
})

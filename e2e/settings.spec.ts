import { expect, test } from '@playwright/test'
import { button } from './helpers.ts'

test('Profil lists what is set; a row opens its own page and the change shows back in the list', async ({ page }) => {
  await page.goto('/profile')
  const goal = page.getByRole('link', { name: /^Denný cieľ/ })
  await expect(goal).toContainText('20')
  await expect(page.getByRole('link', { name: /^Opakovanie slov/ })).toContainText('20 denne')
  await expect(page.getByRole('link', { name: /^Pripomienka/ })).toContainText('Vypnuté')
  await expect(page.getByRole('link', { name: /^Vzhľad/ })).toContainText('Pôvodný')

  await goal.tap()
  await expect(page).toHaveURL(/\/profile\/goal$/)
  await expect(page.getByRole('radio', { name: '20 správnych odpovedí' })).toBeChecked()
  await page.getByRole('radio', { name: '30 správnych odpovedí' }).tap()
  await button(page, 'Späť').tap()
  await expect(goal).toContainText('30')

  // An address that is no setting leads back to the list.
  await page.goto('/profile/nope')
  await expect(page).toHaveURL(/\/profile$/)
})

test('a learner sees no developer tools until the version is tapped seven times', async ({ page }) => {
  // The dev server starts in developer mode; switched off, it shows Nastavenia as a learner has them.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('somos-dev-mode', 'off')
      sessionStorage.setItem('seeded', '1')
    }
  })
  await page.goto('/profile')
  const tools = page.getByRole('link', { name: /^Nástroje pre vývoj/ })
  await expect(tools).toHaveCount(0)
  await page.goto('/profile/dev')
  await expect(page).toHaveURL(/\/profile$/)

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
  await expect(page).toHaveURL(/\/profile$/)
  await expect(tools).toHaveCount(0)
})

test('the tab bar ends with Profil, its numbers there without an account; Archív opens from Hľadať', async ({ page }) => {
  await page.goto('/')
  const bar = page.getByRole('navigation', { name: 'Hlavná navigácia' })
  await expect(bar.getByRole('link')).toHaveText(['Domov', 'Hľadať', 'Cvičiť', 'Profil'])
  await bar.getByRole('link', { name: 'Profil' }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Profil')
  await expect(page.getByRole('heading', { name: 'Moje štatistiky' })).toBeVisible()
  await expect(page.getByText('najdlhšia séria')).toBeVisible()
  // Without an account there is nothing to sign out of.
  await expect(button(page, 'Odhlásiť sa')).toHaveCount(0)

  await bar.getByRole('link', { name: 'Hľadať' }).tap()
  await page.getByRole('link', { name: /^Môj archív/ }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Archív')
  // Still under Hľadať in the bar.
  await expect(bar.getByRole('link', { name: 'Hľadať' })).toHaveAttribute('aria-current', 'page')

  // Old addresses of Nastavenia lead to Profil.
  await page.goto('/archive/settings/sound')
  await expect(page).toHaveURL(/\/profile\/sound$/)
})

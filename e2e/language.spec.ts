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

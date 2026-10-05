import { expect, test, type Page } from '@playwright/test'

const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name)
const titleFont = (page: Page) => page.getByRole('heading', { level: 1 }).evaluate((h) => getComputedStyle(h).fontFamily)

test('the style is switched in Nastavenia, applies at once and survives a reload', async ({ page }) => {
  await page.goto('/archive/settings')
  await expect(page.locator('html')).toHaveAttribute('data-look', 'classic')
  expect(await token(page, '--brick')).toBe('#B5553C')
  expect(await titleFont(page)).toContain('Fraunces')

  await page.getByRole('radio', { name: 'Talavera' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'talavera')
  expect(await token(page, '--brick')).toBe('#1F45B5')
  expect(await token(page, '--bg')).toBe('#F2F5FB')
  expect(await titleFont(page)).toContain('Young Serif')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F2F5FB')

  // It has its own dark side, and light / dark stays a separate choice.
  await page.getByRole('radio', { name: 'Tmavá' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await token(page, '--bg')).toBe('#0B1124')
  expect(await token(page, '--brick')).toBe('#8FA8FF')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0B1124')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'talavera')
  expect(await token(page, '--bg')).toBe('#0B1124')
  await expect(page.getByRole('radio', { name: 'Talavera' })).toBeChecked()

  await page.getByRole('radio', { name: 'Pôvodný' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'classic')
  expect(await token(page, '--bg')).toBe('#161614')
})

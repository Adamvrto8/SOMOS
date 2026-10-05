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

test('every style brings its own colours, typefaces and corners, and none overflows the screen', async ({ page }) => {
  const cardCorner = () => page.locator('.rounded-card').first().evaluate((card) => getComputedStyle(card).borderRadius)
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)

  await page.goto('/archive/settings')
  expect(await cardCorner()).toBe('16px')

  // Barragán: flat planes, square corners, no serif.
  await page.getByRole('radio', { name: 'Barragán' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'barragan')
  expect(await token(page, '--brick')).toBe('#C81765')
  expect(await titleFont(page)).toContain('Bricolage Grotesque')
  expect(await cardCorner()).toBe('4px')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#FAF2EF')
  expect(await fits()).toBe(true)

  // Agáve: its text face runs small, so the whole page is set a step larger.
  await page.getByRole('radio', { name: 'Agáve' }).tap()
  await expect(page.locator('html')).toHaveAttribute('data-look', 'agave')
  expect(await token(page, '--brick')).toBe('#17656E')
  expect(await titleFont(page)).toContain('Alegreya')
  expect(await cardCorner()).toBe('10px')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('17px')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F2F5F2')
  expect(await fits()).toBe(true)

  // The larger setting still fits the busiest screens at phone width.
  for (const path of ['/', '/word/tener', '/practice', '/stats']) {
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('data-look', 'agave')
    await expect(page.getByRole('navigation')).toBeVisible()
    expect(await fits(), path).toBe(true)
  }
})

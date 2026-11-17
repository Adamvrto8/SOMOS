import { expect, test, type Page } from '@playwright/test'
import { button, SCREEN } from './helpers.ts'

// A learner who has just been through the welcome and the first lesson: the tour is pending.
const PORT = Number(process.env.E2E_PORT ?? 5199)
test.use({
  viewport: SCREEN,
  storageState: {
    cookies: [],
    origins: [{ origin: `http://localhost:${PORT}`, localStorage: [{ name: 'somos-onboarding', value: '{"done":true,"level":"A1","tour":"pending"}' }] }],
  },
})

const offer = (page: Page) => page.getByRole('heading', { name: 'Krátke zoznámenie s appkou?' })
const tour = (page: Page) => page.getByRole('dialog')

test('the offer walks through Domov, the tabs and Profil, then never comes back', async ({ page }) => {
  await page.goto('/')
  await expect(offer(page)).toBeVisible()
  await button(page, 'Áno, ukáž mi').tap()

  // SOMO's pill is not shown without dev mode and an account: six steps.
  await expect(tour(page)).toContainText('Krok 1 z 6')
  await expect(tour(page)).toContainText('Tu začneš')
  // The page behind cannot be tapped.
  await expect(page.locator('#root')).toHaveAttribute('inert', '')
  for (const title of ['Tvoj pokrok', 'Hľadať', 'Cesta', 'Cvičiť']) {
    await button(page, 'Ďalej').tap()
    await expect(tour(page).getByRole('heading', { name: title })).toBeVisible()
  }
  await button(page, 'Späť').tap()
  await expect(tour(page).getByRole('heading', { name: 'Cesta' })).toBeVisible()
  await button(page, 'Ďalej').tap()
  await button(page, 'Ďalej').tap()
  await expect(tour(page)).toContainText('Krok 6 z 6')
  await button(page, 'Hotovo').tap()

  await expect(tour(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
  await page.reload()
  await expect(page.getByRole('heading', { name: '¡Hola!' })).toBeVisible()
  await expect(offer(page)).toHaveCount(0)
})

test('Nie, vďaka closes the offer for good', async ({ page }) => {
  await page.goto('/')
  await button(page, 'Nie, vďaka').tap()
  await expect(offer(page)).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: '¡Hola!' })).toBeVisible()
  await expect(offer(page)).toHaveCount(0)
})

test('the phone Back and Preskočiť end the tour on Domov', async ({ page }) => {
  await page.goto('/')
  await button(page, 'Áno, ukáž mi').tap()
  await button(page, 'Ďalej').tap()
  await page.goBack()
  await expect(tour(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: '¡Hola!' })).toBeVisible()
  // Taken once: not offered again.
  await expect(offer(page)).toHaveCount(0)

  await page.goto('/?tour=1')
  await expect(tour(page)).toBeVisible()
  await button(page, 'Preskočiť').tap()
  await expect(tour(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})

test('the highlight takes in the whole raised Cesta button', async ({ page }) => {
  await page.goto('/?tour=1')
  for (let i = 0; i < 3; i++) await button(page, 'Ďalej').tap()
  await expect(tour(page).getByRole('heading', { name: 'Cesta' })).toBeVisible()
  const circle = (await page.locator('[data-tour="tab-path"] > span').first().boundingBox())!
  const spot = page.locator('[data-tour-spotlight]')
  await expect.poll(async () => (await spot.boundingBox())!.y).toBeLessThanOrEqual(circle.y)
})

test('on a short screen the buttons of the bubble stay on screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 460 })
  await page.goto('/?tour=1')
  for (const title of ['Tu začneš', 'Tvoj pokrok']) {
    await expect(tour(page).getByRole('heading', { name: title })).toBeVisible()
    await expect(button(page, 'Ďalej')).toBeInViewport({ ratio: 1 })
    await expect(button(page, 'Preskočiť')).toBeInViewport({ ratio: 1 })
    await button(page, 'Ďalej').tap()
  }
})

test('a double tap on Preskočiť stays on Domov', async ({ page }) => {
  await page.goto('/')
  await page.goto('/?tour=1')
  await expect(tour(page)).toBeVisible()
  await button(page, 'Preskočiť').dblclick()
  await expect(tour(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: '¡Hola!' })).toBeVisible()
  // One step back still leads to the Domov opened before: nothing more was taken off the history.
  await page.goBack()
  await expect(page).toHaveURL(/\/$/)
})

test('Profil takes the tour again', async ({ page }) => {
  await page.goto('/profile')
  await page.getByRole('link', { name: 'Zopakovať zoznámenie' }).tap()
  await expect(page).toHaveURL(/\/$/)
  await expect(tour(page)).toContainText('Tu začneš')
  await page.goBack()
  await expect(tour(page)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})

test('the text bubble stays on screen for the tab bar', async ({ page }) => {
  await page.goto('/?tour=1')
  await expect(tour(page)).toContainText('Krok 1 z 6')
  for (let i = 0; i < 5; i++) await button(page, 'Ďalej').tap() // the last tab: Profil
  await expect(tour(page)).toContainText('Krok 6 z 6')
  const box = (await tour(page).boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(SCREEN.height - 64) // above the tab bar
})

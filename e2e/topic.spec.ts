import { expect, test, type Page } from '@playwright/test'
import { swipe } from './helpers.ts'

const LEFT = 60
const RIGHT = 320
const position = (page: Page) => page.getByRole('navigation', { name: 'Témy' })
const title = (page: Page) => page.getByRole('heading', { level: 1 })

test('a swipe turns the topic page, and so do the arrows', async ({ page }) => {
  await page.goto('/search')
  await page.locator('a[href="/topic/greetings"]').tap()
  await expect(title(page)).toHaveText('Pozdravy a frázy')
  await expect(position(page)).toContainText('1 / 20')

  // On the list of words: right to left is the next topic, and it starts at its top.
  await page.mouse.wheel(0, 600)
  await swipe(page, { x: RIGHT, y: 400 }, { x: LEFT, y: 400 })
  await expect(title(page)).toHaveText('Základné slová')
  await expect(position(page)).toContainText('2 / 20')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)

  await swipe(page, { x: LEFT, y: 400 }, { x: RIGHT, y: 400 })
  await expect(title(page)).toHaveText('Pozdravy a frázy')

  // The first topic has nothing before it.
  await swipe(page, { x: LEFT, y: 400 }, { x: RIGHT, y: 400 })
  await page.waitForTimeout(400)
  await expect(title(page)).toHaveText('Pozdravy a frázy')
  await expect(page.getByRole('button', { name: 'Predchádzajúca téma' })).toBeDisabled()

  await page.getByRole('button', { name: 'Ďalšia téma' }).tap()
  await expect(title(page)).toHaveText('Základné slová')

  // Paging does not pile up history: one step back is the list of topics.
  await page.getByRole('button', { name: 'Späť' }).tap()
  await expect(page).toHaveURL(/\/search$/)
})

test('a vertical drag scrolls the list of a topic and keeps the topic', async ({ page }) => {
  await page.goto('/topic/greetings')
  await swipe(page, { x: 200, y: 500 }, { x: 210, y: 300 })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await page.waitForTimeout(400)
  await expect(title(page)).toHaveText('Pozdravy a frázy')
})

test('a word opened from a swiped-to topic pages through that topic', async ({ page }) => {
  await page.goto('/topic/greetings')
  await swipe(page, { x: RIGHT, y: 400 }, { x: LEFT, y: 400 })
  await expect(title(page)).toHaveText('Základné slová')
  // Tapped at once: a quick swipe left to Chrome starts a fling, and the tap that follows it is swallowed.
  await page.locator('a[href^="/word/"]').first().tap()
  await expect(page.getByRole('navigation', { name: 'Slová zo zoznamu' })).toContainText('1 / 108')
})

import { expect, test, type Page } from '@playwright/test'
import { swipe } from './helpers.ts'

const LEFT = 60
const RIGHT = 320
const position = (page: Page) => page.getByRole('navigation', { name: 'Slová zo zoznamu' })
/** A swipe that must change nothing has nothing to wait for: give the page the time to turn anyway. */
const settle = (page: Page) => page.waitForTimeout(400)

test('a swipe turns the word page anywhere below the header', async ({ page }) => {
  await page.goto('/topic/greetings')
  await page.locator('a[href^="/word/"]').first().tap()
  await expect(position(page)).toContainText('1 /')

  // A short word ends mid-screen: the empty space under it has to swipe too.
  const content = (await page.locator('article').boundingBox())!
  const tabBar = (await page.getByRole('navigation').last().boundingBox())!
  const empty = (content.y + content.height + tabBar.y) / 2
  expect(empty - (content.y + content.height)).toBeGreaterThan(20)

  await swipe(page, { x: RIGHT, y: empty }, { x: LEFT, y: empty })
  await expect(position(page)).toContainText('2 /')
  await swipe(page, { x: LEFT, y: empty }, { x: RIGHT, y: empty })
  await expect(position(page)).toContainText('1 /')
  await swipe(page, { x: RIGHT, y: 250 }, { x: LEFT, y: 250 }) // on the content
  await expect(position(page)).toContainText('2 /')

  // Not a page turn: a vertical drag, and a swipe on the tab bar.
  await swipe(page, { x: 200, y: empty }, { x: 210, y: empty - 150 })
  await swipe(page, { x: RIGHT, y: tabBar.y + 30 }, { x: LEFT, y: tabBar.y + 30 })
  await settle(page)
  await expect(position(page)).toContainText('2 /')
})

test('dragging the tense tabs of a verb keeps the word', async ({ page }) => {
  await page.goto('/search')
  await page.getByRole('searchbox').fill('ha')
  await page.locator('a[href="/word/hablar"]').tap()
  const word = page.locator('article h1')
  await expect(word).toHaveText('hablar')

  const tabs = page.getByRole('tablist')
  await tabs.evaluate((bar) => bar.scrollIntoView({ block: 'center' }))
  const bar = (await tabs.boundingBox())!
  const y = bar.y + bar.height / 2
  // Also once the bar has reached its end.
  for (let drag = 0; drag < 3; drag++) await swipe(page, { x: RIGHT, y }, { x: LEFT, y })
  await settle(page)
  await expect(word).toHaveText('hablar')

  await swipe(page, { x: RIGHT, y: y + 150 }, { x: LEFT, y: y + 150 })
  await expect(word).not.toHaveText('hablar')
})

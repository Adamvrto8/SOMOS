import { expect, test, type Page } from '@playwright/test'
import { askedSentence, button, field, KEYBOARD_OPEN, seedAttempts, status, swipe } from './helpers.ts'

const LESSON = '/practice/lesson?type=cloze&topic=all&level=A1&lesson=1'
const DAY = 86_400_000

/** The celebration of a reached daily goal: the whole screen is its button. */
const sun = (page: Page) => page.getByRole('button', { name: /Meta cumplida/ })

/** The daily goal counts right answers, and seedAttempts gets two of three right: this many answers hold `right` right ones. */
const holding = (right: number) => Math.ceil(right * 1.5)

const goalOfTen = (page: Page) => page.addInitScript(() => localStorage.setItem('somos-daily-goal', '10'))

/** A lesson with the daily goal at 10 and the given right answers already in the past (0 = today). */
async function lessonWith(page: Page, rightPerDay: Record<number, number>): Promise<void> {
  await goalOfTen(page)
  await page.goto(LESSON)
  await seedAttempts(page, Object.fromEntries(Object.entries(rightPerDay).map(([daysAgo, right]) => [daysAgo, holding(right)])))
}

/** One right answer, checked: it counts from here, before the learner moves on. */
async function answerRight(page: Page): Promise<void> {
  const answer = (await askedSentence(page)).cloze![0].answer
  await field(page).fill(answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne!')
}

// For now the sun stays until it is tapped (STAY in GoalCelebration.tsx); once it leaves by itself
// again, this test waits for that instead of tapping.
test('the right answer that completes the daily goal brings the sun over its own task, which stays until it is tapped', async ({ page }) => {
  // Yesterday's goal was reached; today is one right answer short.
  await lessonWith(page, { 0: 9, 1: 10 })
  await answerRight(page)

  await expect(sun(page)).toBeVisible()
  await expect(sun(page)).toContainText('Denný cieľ splnený · 10/10')
  await expect(sun(page)).toContainText('2 dni v rade')
  // Still on the task that earned it.
  await expect(page.locator('header')).toContainText('1/10')

  await page.waitForTimeout(3500)
  await expect(sun(page)).toBeVisible()
  // Tapped away, and the lesson goes on; the answer is not counted a second time.
  await sun(page).tap()
  await expect(sun(page)).toHaveCount(0)
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')
  await page.goto('/')
  await expect(page.getByRole('link', { name: /^Denný cieľ: 10 z 10, splnený\./ })).toBeVisible()
})

test('a tap sends the sun away at once, but not while it is still coming up', async ({ page }) => {
  await lessonWith(page, { 0: 9 })
  await answerRight(page)

  // A finger already on its way to "Pokračovať" lands on the sun as it appears: the sun stays, and nothing under it is pressed.
  // Caught in the very frame it appears in, so the touch comes well within its first moment.
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Meta cumplida')), null, { polling: 'raf' })
  const onward = (await button(page, 'Pokračovať').boundingBox())!
  await page.touchscreen.tap(onward.x + onward.width / 2, onward.y + onward.height / 2)
  await page.waitForTimeout(500)
  await expect(sun(page)).toBeVisible()
  await expect(page.locator('header')).toContainText('1/10')

  // Once it has been seen (the tap waits for that), a tap sends it away at once.
  await sun(page).tap()
  await expect(sun(page)).toHaveCount(0, { timeout: 1000 })
})

test('a swipe sends the sun away too, and the screen under it stays where it was', async ({ page }) => {
  await lessonWith(page, { 0: 9 })
  await answerRight(page)
  await expect(sun(page)).toBeVisible()
  // A screen short enough for the lesson under the sun to scroll.
  await page.setViewportSize(KEYBOARD_OPEN)
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeGreaterThan(100)

  // Past its first moment, in which it cannot be sent away.
  await expect(sun(page)).toBeEnabled()
  await swipe(page, { x: 180, y: 380 }, { x: 180, y: 120 })
  await expect(sun(page)).toHaveCount(0, { timeout: 1000 })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  // The finger that sent it away did not press anything under it.
  await expect(page.locator('header')).toContainText('1/10')
})

test('an answer given up does not count for the goal; the next right one does', async ({ page }) => {
  await lessonWith(page, { 0: 9 })
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Nesprávne')
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')

  // The sun would be up within half a second.
  await page.waitForTimeout(1200)
  await expect(sun(page)).toHaveCount(0)

  await answerRight(page)
  await expect(sun(page)).toContainText('Denný cieľ splnený · 10/10')
})

test('a right answer after the goal brings no sun', async ({ page }) => {
  await lessonWith(page, { 0: 10 })
  await answerRight(page)

  await page.waitForTimeout(1200)
  await expect(sun(page)).toHaveCount(0)
})

test('in a review the card that completes the goal waits under the sun', async ({ page }) => {
  await goalOfTen(page)
  // A word given up in a lesson gets a review card, due a few days later.
  await page.goto('/practice/lesson?type=vocab&topic=all&level=A1&lesson=1')
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')
  await page.clock.setFixedTime(Date.now() + 3 * DAY)
  await page.goto('/review')
  await seedAttempts(page, { 0: holding(9) })

  const card = page.locator('article h1')
  const word = await card.innerText()
  await button(page, 'Ukázať preklad').tap()
  await page.getByRole('button', { name: /^Dobre/ }).tap()

  await expect(sun(page)).toContainText('Denný cieľ splnený · 10/10')
  await expect(card).toHaveText(word)
  await sun(page).tap()
  await expect(page.getByText(/^Zopakoval si 1 kartu/)).toBeVisible()
})

test('Nastavenia can show the sun without an answer, each time with another streak, and nothing is counted', async ({ page }) => {
  await goalOfTen(page)
  await page.goto('/profile/dev')
  const show = button(page, 'Ukázať slnko denného cieľa')

  await show.tap()
  await expect(sun(page)).toContainText('Denný cieľ splnený · 10/10')
  await expect(sun(page)).toContainText('7 dní v rade')
  await sun(page).tap()
  await expect(sun(page)).toHaveCount(0)
  // The tap that sent the sun away did not press the button under it again.
  await page.waitForTimeout(600)
  await expect(sun(page)).toHaveCount(0)

  await show.tap()
  await expect(sun(page)).toContainText('1 deň v rade')
  await sun(page).tap()
  await page.goto('/')
  await expect(page.getByRole('link', { name: /^Denný cieľ: 0 z 10\./ })).toBeVisible()
})

test('Domov counts the right answers of today toward the goal', async ({ page }) => {
  await goalOfTen(page)
  await page.goto('/')
  // Nine answers, six of them right.
  await seedAttempts(page, { 0: 9 })

  await expect(page.getByRole('link', { name: /^Denný cieľ: 6 z 10\./ })).toContainText('denný cieľ · ešte 4')
})

/** How far below the middle of the sun the middle of the drawn digits is, in px (above it: negative). */
async function inkBelowCentre(page: Page): Promise<number> {
  const shot = (await page.locator('svg', { has: page.locator('text') }).screenshot()).toString('base64')
  return page.evaluate(async (png) => {
    const image = new Image()
    image.src = `data:image/png;base64,${png}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const pen = canvas.getContext('2d')!
    pen.drawImage(image, 0, 0)
    const { data, width, height } = pen.getImageData(0, 0, image.width, image.height)
    let top = height
    let bottom = 0
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        // Inside the disc only, and only the dark of the digits (the light theme).
        if (Math.hypot(x - width / 2, y - height / 2) > width * 0.24) continue
        const i = (y * width + x) * 4
        if (data[i] + data[i + 1] + data[i + 2] >= 300) continue
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
    return (top + bottom + 1) / 2 - height / 2
  }, shot)
}

// Agave asks its typeface for lining figures (tokens.css), where a 7 stands on the line instead of hanging below it.
for (const look of ['classic', 'talavera', 'barragan', 'agave'])
  test(`the streak sits in the middle of the sun in the ${look} style`, async ({ page }) => {
    await page.addInitScript((picked) => localStorage.setItem('somos-look', picked), look)
    await lessonWith(page, { 0: 9, 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 })
    await answerRight(page)
    await expect(sun(page)).toContainText('7 dní v rade')
    // The digits have risen into place.
    await page.waitForTimeout(900)

    expect(Math.abs(await inkBelowCentre(page))).toBeLessThanOrEqual(1.5)
  })

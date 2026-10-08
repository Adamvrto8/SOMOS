import { expect, test, type Page } from '@playwright/test'
import { askedSentence, button, field, seedAttempts, status } from './helpers.ts'

const LESSON = '/practice/lesson?type=cloze&topic=all&level=A1&lesson=1'

/** The celebration of a reached daily goal: the whole screen is its button. */
const sun = (page: Page) => page.getByRole('button', { name: /Meta cumplida/ })

/** The daily goal counts right answers, and seedAttempts gets two of three right: this many answers hold `right` right ones. */
const holding = (right: number) => Math.ceil(right * 1.5)

/** A lesson with the daily goal at 10 and the given right answers already in the past (0 = today). */
async function lessonWith(page: Page, rightPerDay: Record<number, number>): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('somos-daily-goal', '10'))
  await page.goto(LESSON)
  await seedAttempts(page, Object.fromEntries(Object.entries(rightPerDay).map(([daysAgo, right]) => [daysAgo, holding(right)])))
}

/** One right answer. It counts once the learner moves on: until then it can still be overruled. */
async function answerRight(page: Page): Promise<void> {
  const answer = (await askedSentence(page)).cloze![0].answer
  await field(page).fill(answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne!')
  await button(page, 'Pokračovať').tap()
}

test('the right answer that completes the daily goal brings the sun, which leaves by itself', async ({ page }) => {
  // Yesterday's goal was reached; today is one right answer short.
  await lessonWith(page, { 0: 9, 1: 10 })
  await answerRight(page)

  await expect(sun(page)).toBeVisible()
  await expect(sun(page)).toContainText('Denný cieľ splnený · 10/10')
  await expect(sun(page)).toContainText('2 dni v rade')

  // Gone by itself, and the lesson goes on underneath.
  await expect(sun(page)).toHaveCount(0)
  await expect(page.locator('header')).toContainText('2/10')
  await expect(field(page)).toBeEditable()
})

test('a tap sends the sun away at once', async ({ page }) => {
  await lessonWith(page, { 0: 9 })
  await answerRight(page)

  await expect(sun(page)).toContainText('1 deň v rade')
  await sun(page).tap()
  await expect(sun(page)).toHaveCount(0, { timeout: 1000 })
})

test('an answer given up does not count for the goal; the next right one does', async ({ page }) => {
  await lessonWith(page, { 0: 9 })
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Nesprávne')
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')

  // The sun would be up 0.9 s after moving on.
  await page.waitForTimeout(1500)
  await expect(sun(page)).toHaveCount(0)

  await answerRight(page)
  await expect(sun(page)).toContainText('Denný cieľ splnený · 10/10')
})

test('a right answer after the goal brings no sun', async ({ page }) => {
  await lessonWith(page, { 0: 10 })
  await answerRight(page)

  await page.waitForTimeout(1500)
  await expect(sun(page)).toHaveCount(0)
})

test('Domov counts the right answers of today toward the goal', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('somos-daily-goal', '10'))
  await page.goto('/')
  // Nine answers, six of them right.
  await seedAttempts(page, { 0: 9 })

  await expect(page.getByRole('link', { name: /^Denný cieľ: 6 z 10\./ })).toContainText('denný cieľ · ešte 4')
})

import { expect, test } from '@playwright/test'
import { button, seedAttempts } from './helpers.ts'

// 40 answers a day, two thirds of them right: the default goal of 20 is reached.
const GOAL_DAYS = Object.fromEntries([2, 3, 4, 5, 6, 7, 8, 9].map((daysAgo) => [daysAgo, 40]))

test('a missed day uses a streak freeze: the streak goes on and Domov says so once', async ({ page }) => {
  await page.goto('/')
  // Eight days in a row up to the day before yesterday (one freeze to start + one earned), then yesterday missed.
  await seedAttempts(page, GOAL_DAYS)

  const streak = page.getByRole('region', { name: 'Séria', exact: true })
  await expect(streak).toContainText('8')
  await expect(streak).toContainText('1 ochrana série')

  const notice = page.getByRole('region', { name: 'Séria zachránená' })
  await expect(notice).toContainText('Včera nebol denný cieľ splnený, ale séria pokračuje')
  await expect(notice).toContainText('Zostáva ti 1 ochrana.')
  await button(notice, 'Zavrieť').tap()
  await expect(notice).toHaveCount(0)
  await page.reload()
  await expect(streak).toContainText('8')
  await expect(page.getByRole('region', { name: 'Séria zachránená' })).toHaveCount(0)

  // The overview explains it, with the freezes held.
  await page.goto('/stats')
  await expect(page.getByText('Za 7 dní v rade získaš ochranu série')).toBeVisible()
})

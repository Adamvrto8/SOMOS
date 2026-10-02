import { expect, test } from '@playwright/test'
import { button, field, status, words } from './helpers.ts'

const DAY = 86_400_000

test('a word card can be typed, fixed after a hint, and rates itself', async ({ page }) => {
  // A word practised in a lesson gets a review card: one vocab task, given up.
  await page.goto('/practice/lesson?type=vocab&topic=all&level=A1&lesson=1')
  const prompt = await page.locator('main p[lang]').first().innerText()
  const word = words.find((w) => w.sk.join(', ') === prompt || [w.es, `el ${w.es}`, `la ${w.es}`].includes(prompt))
  if (!word) throw new Error(`no word for "${prompt}"`)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(status(page), 'Vzdať sa').tap()
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')

  // A few days later the card is due.
  await page.clock.setFixedTime(Date.now() + 3 * DAY)
  await page.goto('/review')
  const card = page.locator('article h1')
  await expect(card).toBeVisible()
  const answer = (await card.getAttribute('lang')) === 'sk' ? word.es : word.sk[0]

  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  const hint = status(page)
  await expect(hint).toContainText('Ešte to nie je ono')
  await expect(hint).toContainText('zzzz')

  // Fixed with the button in the hint: right after a hint = "Hard", no manual rating.
  await field(page).fill(answer)
  await button(hint, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne po oprave')
  await expect(status(page)).toContainText('Ďalšie opakovanie')
  await expect(button(page, 'Pokračovať')).toBeVisible()
})

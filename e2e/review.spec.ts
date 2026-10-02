import { expect, test, type Page } from '@playwright/test'
import type { Word } from '../src/data/types.ts'
import { button, field, gapBelowField, status, words } from './helpers.ts'

const DAY = 86_400_000

/** A word practised in a lesson gets a review card: one vocab task, given up. Returns that word. */
async function practiseOneWord(page: Page): Promise<Word> {
  await page.goto('/practice/lesson?type=vocab&topic=all&level=A1&lesson=1')
  const prompt = await page.locator('main p[lang]').first().innerText()
  const word = words.find((w) => w.sk.join(', ') === prompt || [w.es, `el ${w.es}`, `la ${w.es}`].includes(prompt))
  if (!word) throw new Error(`no word for "${prompt}"`)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(status(page), 'Vzdať sa').tap()
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')
  return word
}

test('a word card can be typed, fixed after a hint, and rates itself', async ({ page }) => {
  const word = await practiseOneWord(page)

  // A few days later the card is due.
  await page.clock.setFixedTime(Date.now() + 3 * DAY)
  await page.goto('/review')
  const card = page.locator('article h1')
  await expect(card).toBeVisible()
  const answer = (await card.getAttribute('lang')) === 'sk' ? word.es : word.sk[0]

  // Both ways on sit right under the field, where the open phone keyboard does not cover them.
  await expect(button(page, 'Skontrolovať')).toHaveCount(1)
  for (const name of ['Ukázať preklad', 'Skontrolovať']) {
    const gap = await gapBelowField(page, button(page, name))
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThan(24)
  }

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

test('"Ukázať preklad" under the field reveals the card for a manual rating', async ({ page }) => {
  await practiseOneWord(page)
  await page.clock.setFixedTime(Date.now() + 3 * DAY)
  await page.goto('/review')
  await expect(field(page)).toBeVisible()

  await button(page, 'Ukázať preklad').tap()
  await expect(page.getByText('Ako dobre si to vedel?')).toBeVisible()
  await expect(field(page)).toHaveCount(0)
  await expect(button(page, 'Ukázať preklad')).toHaveCount(0)
})

import { expect, test, type Page } from '@playwright/test'
import type { Word } from '../src/data/types.ts'
import { askedSentence, button, field, gapAboveBottom, KEYBOARD_OPEN, sentences, status, words } from './helpers.ts'

const DAY = 86_400_000

/** A word practised in a lesson gets a review card: one vocab task, given up. Returns that word. */
async function practiseOneWord(page: Page): Promise<Word> {
  await page.goto('/practice/lesson?type=vocab&topic=all&level=A1&lesson=1')
  const prompt = await page.locator('main p[lang]').first().innerText()
  const word = words.find((w) => w.sk.join(', ') === prompt || [w.es, `el ${w.es}`, `la ${w.es}`].includes(prompt))
  if (!word) throw new Error(`no word for "${prompt}"`)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
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

  // Both ways on are in the bar at the bottom, which rides on the keyboard when that is open.
  const inBottomBar = async (names: string[]) => {
    await expect(button(page, 'Skontrolovať')).toHaveCount(1)
    for (const name of names) {
      const gap = await gapAboveBottom(page, button(page, name))
      expect(gap).toBeGreaterThanOrEqual(0)
      expect(gap).toBeLessThan(24)
    }
  }
  await inBottomBar(['Ukázať preklad', 'Skontrolovať'])
  await page.setViewportSize(KEYBOARD_OPEN)
  await inBottomBar(['Ukázať preklad', 'Skontrolovať'])

  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  const hint = status(page)
  await expect(hint).toContainText('Ešte to nie je ono')
  await expect(hint).toContainText('zzzz')
  await expect(hint).toBeInViewport({ ratio: 1 })
  // After a wrong try the way out is to give up (the card then comes back in this session).
  await inBottomBar(['Vzdať sa', 'Skontrolovať'])

  // Fixed after a hint = "Hard", no manual rating.
  await field(page).fill(answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne po oprave')
  await expect(status(page)).toContainText('Znova príde o')
  await expect(button(page, 'Pokračovať')).toBeVisible()
})

test('"Ukázať preklad" reveals the card for a manual rating', async ({ page }) => {
  await practiseOneWord(page)
  await page.clock.setFixedTime(Date.now() + 3 * DAY)
  await page.goto('/review')
  await expect(field(page)).toBeVisible()

  await button(page, 'Ukázať preklad').tap()
  await expect(page.getByText('Ako dobre si to vedel?')).toBeVisible()
  await expect(field(page)).toHaveCount(0)
  await expect(button(page, 'Ukázať preklad')).toHaveCount(0)
})

test('a sentence card is read in Spanish, next time typed in Spanish from Slovak', async ({ page }) => {
  // A wrong translation and ⭐ in its feedback both give the sentence a review card.
  await page.goto('/practice/lesson?type=translation&topic=all&level=A1&lesson=1')
  await askedSentence(page)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Uložiť do môjho slovníka').tap()
  await expect(button(page, 'Odstrániť z môjho slovníka')).toBeVisible()

  const card = page.locator('article h1')
  /** Reveals and rates every card shown in Spanish until one comes in Slovak (or the session ends). */
  const rateSpanishCards = async () => {
    await expect(card.or(page.getByText('Hotovo na dnes'))).toBeVisible()
    while ((await card.isVisible()) && (await card.getAttribute('lang')) === 'es') {
      // A Slovak translation of a sentence can't be checked, so the Spanish side is only revealed.
      await expect(field(page)).toHaveCount(0)
      const before = await card.innerText()
      await button(page, 'Ukázať preklad').tap()
      // Ľahké: a new card leaves the session at once (Dobre would bring it back in a few minutes).
      await page.getByRole('button', { name: /^Ľahké/ }).tap()
      await expect(page.locator('main')).not.toContainText(before)
    }
  }

  // The first review shows the sentence in Spanish.
  const start = Date.now()
  await page.clock.setFixedTime(start + 3 * DAY)
  await page.goto('/review')
  await expect(card).toHaveAttribute('lang', 'es')
  await rateSpanishCards()

  // The next time it shows the Slovak side, and the Spanish sentence is typed.
  await page.clock.setFixedTime(start + 60 * DAY)
  await page.goto('/review')
  await rateSpanishCards()
  await expect(card).toHaveAttribute('lang', 'sk')
  const shown = await card.innerText()
  expect(sentences.some((s) => s.sk === shown)).toBe(true)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Ešte to nie je ono')
  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Nevedel si')
  // A sentence can be said in other ways: as in a lesson, the learner may count it as right.
  await button(page, 'Moja odpoveď bola tiež správna').tap()
  await expect(button(page, 'Moja odpoveď bola tiež správna')).toHaveCount(0)
})

test('the longest word fits its card, and both sides of a card are one height', async ({ page }) => {
  await page.goto('/word/electrodomestico')
  await page.getByRole('button', { name: 'Uložiť do môjho slovníka' }).first().tap()
  await expect(page.getByRole('button', { name: 'Odstrániť z môjho slovníka' }).first()).toBeVisible()

  const card = page.locator('article')
  const heightOfSide = async (lang: string) => {
    await expect(card.locator('h1')).toHaveAttribute('lang', lang)
    // Nothing sticks out of the card, and the page does not scroll sideways.
    const h1 = (await card.locator('h1').boundingBox())!
    const box = (await card.boundingBox())!
    expect(h1.x).toBeGreaterThanOrEqual(box.x)
    expect(h1.x + h1.width).toBeLessThanOrEqual(box.x + box.width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    return box.height
  }

  const start = Date.now()
  await page.clock.setFixedTime(start + 3 * DAY)
  await page.goto('/review')
  const spanish = await heightOfSide('es')
  await button(page, 'Ukázať preklad').tap()
  await page.getByRole('button', { name: /^Ľahké/ }).tap()
  await expect(page.getByText('Hotovo na dnes')).toBeVisible()

  await page.clock.setFixedTime(start + 60 * DAY)
  await page.goto('/review')
  expect(await heightOfSide('sk')).toBe(spanish)
})

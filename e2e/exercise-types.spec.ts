// e2e/exercise-types.spec.ts
import { expect, test } from '@playwright/test'
import { button, sentences, status, swipe, words } from './helpers.ts'

const lesson = (type: string) => `/practice/lesson?type=${type}&topic=all&level=A1&lesson=1`
const PUNCTUATION = /^[¿?¡!.,;:]$/
const withArticle = (w: { es: string; gender?: 'm' | 'f' }) => (w.gender ? `${w.gender === 'm' ? 'el' : 'la'} ${w.es}` : w.es)

test.describe('pravda / nepravda', () => {
  test('is answered by swiping the card, and the verdict follows the sentence', async ({ page }) => {
    await page.goto(lesson('truefalse'))
    const card = page.getByRole('group', { name: 'Veta na posúdenie' })
    await expect(card).toBeVisible()
    const shown = await card.locator('p[lang="es"]').innerText()
    const truth = sentences.some((s) => s.es === shown)

    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2
    await swipe(page, { x, y }, { x: x + 140, y }) // right = pravda
    await expect(status(page)).toContainText(truth ? 'Správne!' : 'Nesprávne')
    // click, not tap: a tap right after the raw CDP touch sequence of `swipe` is often swallowed by Chrome's touch state
    await button(page, 'Pokračovať').click()
    await expect(page.locator('header')).toContainText('2/10')
  })

  test('is answered by the buttons, and a short drag does nothing', async ({ page }) => {
    await page.goto(lesson('truefalse'))
    const card = page.getByRole('group', { name: 'Veta na posúdenie' })
    const shown = await card.locator('p[lang="es"]').innerText()
    const truth = sentences.some((s) => s.es === shown)

    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2
    await swipe(page, { x, y }, { x: x - 30, y })
    await expect(status(page)).toHaveCount(0)

    await button(page, 'Nepravda').click() // click, not tap: see above
    await expect(status(page)).toContainText(truth ? 'Nesprávne' : 'Správne!')
    await button(page, 'Pokračovať').click()
  })
})

test.describe('nájdi chybu', () => {
  /** The sentence on screen and the position (among its words) and original of the swapped one. */
  async function wrongWord(page: import('@playwright/test').Page) {
    const sentence = page.locator('main p[lang="es"]')
    await expect(sentence).toBeVisible()
    const shown = await sentence.locator('button').allInnerTexts()
    const texts = await page.locator('main p').allInnerTexts()
    const original = sentences.find((s) => texts.includes(s.sk))!
    const originalWords = original.tokens.filter((t) => !PUNCTUATION.test(t))
    const at = shown.findIndex((word, i) => word !== originalWords[i])
    return { shown, at, right: originalWords[at] }
  }

  test('tap the wrong word, then pick the fix', async ({ page }) => {
    await page.goto(lesson('findmistake'))
    const { at, right } = await wrongWord(page)
    await page.locator('main p[lang="es"] button').nth(at).tap()
    await page.getByRole('radio', { name: right, exact: true }).tap()
    await expect(status(page)).toContainText('Správne!')
    await button(page, 'Pokračovať').tap()
    await expect(page.locator('header')).toContainText('2/10')
  })

  test('two wrong taps end the task as wrong', async ({ page }) => {
    await page.goto(lesson('findmistake'))
    const { at, shown } = await wrongWord(page)
    const others = shown.map((_, i) => i).filter((i) => i !== at)
    await page.locator('main p[lang="es"] button').nth(others[0]).tap()
    await expect(page.getByText('To nie je ono, skús ešte raz.')).toBeVisible()
    await page.locator('main p[lang="es"] button').nth(others[1]).tap()
    await expect(status(page)).toContainText('Nesprávne')
    await button(page, 'Pokračovať').tap()
  })

  test('a wrong fix is wrong', async ({ page }) => {
    await page.goto(lesson('findmistake'))
    const { at, right } = await wrongWord(page)
    await page.locator('main p[lang="es"] button').nth(at).tap()
    const options = page.getByRole('radio')
    const names = await options.allInnerTexts()
    await options.nth(names.findIndex((n) => n !== right)).tap()
    await expect(status(page)).toContainText('Nesprávne')
  })
})

test.describe('priraďovanie', () => {
  /** Pairs every Spanish chip with its Slovak one, `wrong` times first pairing a chip with a wrong partner. */
  async function play(page: import('@playwright/test').Page, wrong: number) {
    const es = page.getByRole('group', { name: 'Španielsky' }).getByRole('button')
    const sk = page.getByRole('group', { name: 'Slovensky' }).getByRole('button')
    await expect(es).toHaveCount(5)
    const left = await es.allInnerTexts()
    const right = await sk.allInnerTexts()
    const partner = (spanish: string) => words.find((w) => withArticle(w) === spanish)!.sk[0]

    for (let n = 0; n < wrong; n++) {
      const other = right.find((r) => r !== partner(left[0]))!
      await es.filter({ hasText: left[0] }).first().tap()
      await sk.getByText(other, { exact: true }).tap()
      await page.waitForTimeout(600) // the red flash
    }
    for (const spanish of left) {
      await es.getByText(spanish, { exact: true }).tap()
      await sk.getByText(partner(spanish), { exact: true }).tap()
    }
  }

  test('five pairs end the round as right', async ({ page }) => {
    await page.goto(lesson('matching'))
    await play(page, 0)
    await expect(status(page)).toContainText('Správne!')
    await button(page, 'Pokračovať').tap()
    await expect(page.locator('header')).toContainText('2/4')
  })

  test('three wrong pairings make the round wrong and name the words', async ({ page }) => {
    await page.goto(lesson('matching'))
    await play(page, 3)
    await expect(status(page)).toContainText('Nesprávne')
    await expect(status(page)).toContainText('Pomýlil si sa pri')
    await button(page, 'Pokračovať').tap()
  })
})

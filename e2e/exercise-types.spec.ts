// e2e/exercise-types.spec.ts
import { expect, test } from '@playwright/test'
import { button, sentences, status, swipe, words } from './helpers.ts'

const lesson = (type: string) => `/practice/lesson?type=${type}&topic=all&level=A1&lesson=1`
const PUNCTUATION = /^[¿?¡!.,;:]$/
const withArticle = (w: { es: string; gender?: 'm' | 'f' }) => (w.gender ? `${w.gender === 'm' ? 'el' : 'la'} ${w.es}` : w.es)

test.describe('pravda / nepravda', () => {
  test('a swipe gives no verdict, the next card comes at once', async ({ page }) => {
    await page.goto(lesson('truefalse'))
    const card = page.getByRole('group', { name: 'Veta na posúdenie' })
    await expect(card).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pravda' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Nepravda' })).toHaveCount(0)

    const box = (await card.boundingBox())!
    const y = box.y + box.height / 2
    const x = box.x + box.width / 2
    await swipe(page, { x, y }, { x: x - 30, y }) // too short
    await expect(page.locator('header')).toContainText('1/10')

    await swipe(page, { x, y }, { x: x + 140, y }) // right = pravda
    await expect(page.locator('header')).toContainText('2/10')
    await expect(status(page)).toHaveCount(0)
    await expect(button(page, 'Pokračovať')).toHaveCount(0)
  })

  test('ten cards by the arrow keys, then every verdict on the result screen', async ({ page }) => {
    await page.goto(lesson('truefalse'))
    const card = page.getByRole('group', { name: 'Veta na posúdenie' })
    let right = 0
    for (let n = 1; n <= 10; n++) {
      await expect(page.locator('header')).toContainText(`${n}/10`)
      const shown = await card.locator('p[lang="es"]').innerText()
      const truth = sentences.some((s) => s.es === shown)
      // Every other card is judged the wrong way, so both verdicts show up.
      const sayTrue = n % 2 === 0 ? truth : !truth
      if (sayTrue === truth) right++
      await page.keyboard.press(sayTrue ? 'ArrowRight' : 'ArrowLeft')
      if (n < 10) await expect(page.locator('header')).toContainText(`${n + 1}/10`)
    }
    const answers = page.getByRole('region', { name: 'Tvoje odpovede' })
    await expect(answers.locator('li')).toHaveCount(10)
    await expect(answers.locator('li svg[aria-label="Správne"]')).toHaveCount(right)
    await expect(answers.locator('li svg[aria-label="Nesprávne"]')).toHaveCount(10 - right)
    await expect(answers.getByText(/Tvoja odpoveď: (Pravda|Nepravda)/)).toHaveCount(10)
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

  test('the chips fill the screen, and the exercise played comes first in Cvičiť', async ({ page }) => {
    await page.goto(lesson('matching'))
    const es = page.getByRole('group', { name: 'Španielsky' }).getByRole('button')
    await expect(es).toHaveCount(5)
    const last = (await es.last().boundingBox())!
    // The fifth row ends near the bottom of the 800 px screen, not halfway down.
    expect(last.y + last.height).toBeGreaterThan(800 * 0.85)
    expect(last.height).toBeGreaterThanOrEqual(56)

    await play(page, 0)
    await expect(status(page)).toContainText('Správne!')
    await page.goto('/practice')
    await expect(page.getByRole('region', { name: 'Cvičenia' }).getByRole('listitem').first()).toContainText('Priraďovanie')
  })

  test('three wrong pairings make the round wrong and name the words', async ({ page }) => {
    await page.goto(lesson('matching'))
    await play(page, 3)
    await expect(status(page)).toContainText('Nesprávne')
    await expect(status(page)).toContainText('Pomýlil si sa pri')
    await button(page, 'Pokračovať').tap()
  })
})

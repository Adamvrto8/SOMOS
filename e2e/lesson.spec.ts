import { expect, test } from '@playwright/test'
import { askedSentence, button, countShakes, field, gapAboveBottom, KEYBOARD_OPEN, SCREEN, status } from './helpers.ts'

const lesson = (type: string) => `/practice/lesson?type=${type}&topic=all&level=A1&lesson=1`

test.describe('a wrong typed answer', () => {
  test('can be fixed and checked again, as often as it takes', async ({ page }) => {
    const shakes = await countShakes(page)
    await page.goto(lesson('cloze'))
    const answer = (await askedSentence(page)).cloze![0].answer

    await field(page).fill('zzzz')
    await button(page, 'Skontrolovať').tap()
    const hint = status(page)
    await expect(hint).toContainText('Ešte to nie je ono')
    await expect(hint).toContainText('zzzz')
    // The field keeps the focus, so the phone keyboard stays open for the fix.
    await expect(field(page)).toBeFocused()

    // While the answer is being changed, the hint (about the previous try) fades.
    await expect(hint).toHaveCSS('opacity', '1')
    await field(page).fill('yyyy')
    await expect(hint).toHaveCSS('opacity', '0.5')

    // Still wrong: the hint now repeats the new answer.
    await button(page, 'Skontrolovať').tap()
    await expect(hint).toHaveCSS('opacity', '1')
    await expect(hint).toContainText('yyyy')
    await expect(hint).not.toContainText('zzzz')

    // The very same answer again: nothing in the hint changes, so it has to shake.
    const before = await shakes()
    await button(page, 'Skontrolovať').tap()
    await expect.poll(shakes).toBe(before + 1)

    // Fixed: counts as correct, the lesson goes on.
    await field(page).fill(answer)
    await button(page, 'Skontrolovať').tap()
    await expect(status(page)).toContainText('Správne!')
    await button(page, 'Pokračovať').tap()
    await expect(page.locator('header')).toContainText('2/10')
  })

  test('can be given up: the answer is shown and it counts as wrong', async ({ page }) => {
    await page.goto(lesson('vocab'))
    await field(page).fill('zzzz')
    await button(page, 'Skontrolovať').tap()
    await button(page, 'Vzdať sa').tap()
    await expect(status(page)).toContainText('Nesprávne')
    await expect(status(page)).toContainText('Správna odpoveď')
    await expect(button(page, 'Moja odpoveď bola tiež správna')).toBeVisible()
  })

  test('has its wrong word marked in a sentence', async ({ page }) => {
    await page.goto(lesson('translation'))
    const spanish = (await askedSentence(page)).es.replace(/[¿?¡!.,]/g, '').split(' ')
    expect(spanish.length).toBeGreaterThan(1)

    await field(page).fill([...spanish.slice(0, -1), 'zzz'].join(' '))
    await button(page, 'Skontrolovať').tap()
    const hint = status(page)
    await expect(hint.getByText('zzz', { exact: true })).toHaveClass(/text-error/)
    await expect(hint).toContainText('Červené slovo je zle.')
    // The words that were right are repeated as they are, the missing one is not given away.
    await expect(hint).toContainText(spanish[0])
    await expect(hint).not.toContainText(spanish.at(-1)!)
  })
})

test('"Vzdať sa" and "Skontrolovať" ride on the keyboard and rest at the bottom of the screen without it', async ({ page }) => {
  await page.goto(lesson('cloze'))
  await expect(field(page)).toBeVisible()
  // Without this Chrome lays the keyboard over the page and covers the bar.
  await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /interactive-widget=resizes-content/)

  const inBottomBar = async () => {
    await expect(button(page, 'Skontrolovať')).toHaveCount(1)
    for (const name of ['Vzdať sa', 'Skontrolovať']) {
      const gap = await gapAboveBottom(page, button(page, name))
      expect(gap).toBeGreaterThanOrEqual(0)
      expect(gap).toBeLessThan(24)
    }
  }
  await inBottomBar()
  await page.setViewportSize(KEYBOARD_OPEN)
  await inBottomBar()

  // After a wrong try too, with the hint in view above the bar.
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toBeInViewport({ ratio: 1 })
  await inBottomBar()
  await page.setViewportSize(SCREEN)
  await inBottomBar()

  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Správna odpoveď')
})

test('the accent keys sit in one row and type into the field', async ({ page }) => {
  await page.goto(lesson('cloze'))
  const keys = page.locator('[aria-label="Špeciálne znaky"]').getByRole('button')
  await expect(keys).toHaveCount(9)
  const boxes = await keys.evaluateAll((all) => all.map((key) => key.getBoundingClientRect()).map((box) => ({ top: box.top, right: box.right })))
  expect(new Set(boxes.map((box) => box.top)).size).toBe(1)
  expect(Math.max(...boxes.map((box) => box.right))).toBeLessThanOrEqual(375)

  await field(page).fill('ma')
  await button(page, 'Vložiť ñ').tap()
  await expect(field(page)).toHaveValue('mañ')
  await expect(field(page)).toBeFocused()
})

test('a passed lesson opens on its overview', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('somos-lesson-progression-v2', JSON.stringify({ 'cloze:all:A1:1': { bestScore: 9, total: 10, passed: true } }))
  })
  await page.goto(lesson('cloze'))
  await expect(page.getByRole('heading', { name: 'Prehľad lekcie' })).toBeVisible()
  await expect(page.getByText('Splnená (9/10)')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(10)

  await button(page, 'Zopakovať lekciu').tap()
  await expect(field(page)).toBeVisible()
  await expect(page.locator('header')).toContainText('1/10')
})

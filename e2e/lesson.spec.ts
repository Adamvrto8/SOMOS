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

test.describe('a wrong try without typing', () => {
  test('a built sentence has the words in a wrong slot marked, and only those have to be put back', async ({ page }) => {
    await page.goto(lesson('builder'))
    const pool = page.locator('[aria-label="Slová"]').getByRole('button')
    const sentenceArea = page.locator('[aria-label="Tvoja veta"]')
    const built = sentenceArea.getByRole('button')
    const sentence = await askedSentence(page, pool.first())
    const words = sentence.tokens.filter((t) => !/^[¿?¡!.,;:]$/.test(t)).map((w, i) => (i === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w))

    // The tiles as they lie are never the answer.
    for (let left = await pool.count(); left > 0; left--) await pool.first().tap()
    await expect(built).toHaveCount(words.length)
    const wrongSlots = (await built.allInnerTexts()).flatMap((word, slot) => (word === words[slot] ? [] : [slot]))
    await button(page, 'Skontrolovať').tap()
    const hint = status(page)
    await expect(hint).toContainText('Ešte to nie je ono')
    await expect(hint).toContainText('Červené slová sú na zlom mieste')
    // Red is exactly the words that sit where another one belongs.
    const red = sentenceArea.locator('button.text-error')
    await expect(red).toHaveCount(wrongSlots.length)

    // Taking a red word out leaves its slot open (the others stay put); the hint is about the previous try and fades.
    await red.first().tap()
    await expect(hint).toHaveCSS('opacity', '0.5')
    await expect(built).toHaveCount(words.length - 1)
    await expect(sentenceArea.getByRole('img', { name: 'chýba slovo' })).toHaveCount(1)

    // The other red words out too, then the right word into each open slot, first slot first: counts as correct.
    for (let left = await red.count(); left > 0; left--) await red.first().tap()
    for (const slot of wrongSlots) await pool.getByText(words[slot], { exact: true }).first().tap()
    await button(page, 'Skontrolovať').tap()
    await expect(status(page)).toContainText('Správne!')
  })

  test('a built sentence can be given up', async ({ page }) => {
    await page.goto(lesson('builder'))
    const pool = page.locator('[aria-label="Slová"]').getByRole('button')
    await expect(pool.first()).toBeVisible()
    for (let left = await pool.count(); left > 0; left--) await pool.first().tap()
    await button(page, 'Skontrolovať').tap()
    await expect(status(page)).toContainText('Ešte to nie je ono')
    await button(page, 'Vzdať sa').tap()
    await expect(status(page)).toContainText('Nesprávne')
    await expect(status(page)).toContainText('Správna odpoveď')
  })

  test('a wrong option is taken out and another one can be picked', async ({ page }) => {
    await page.goto(lesson('choice'))
    const options = page.getByRole('radio')
    const option = (name: string) => page.getByRole('radio', { name, exact: true })
    const sentence = await askedSentence(page, options.first())
    const answers = sentence.cloze!.map((c) => c.answer)
    const all = await options.allInnerTexts()
    const wrong = all.find((o) => !answers.includes(o))!

    await option(wrong).tap()
    await button(page, 'Skontrolovať').tap()
    await expect(status(page)).toContainText('Ešte to nie je ono')
    await expect(option(wrong)).toBeDisabled()
    // Nothing is picked any more, so there is nothing to check.
    await expect(button(page, 'Skontrolovať')).toBeDisabled()

    // The other options one by one: each wrong one goes out too, until the right one is found.
    for (const next of all.filter((o) => o !== wrong)) {
      await option(next).tap()
      await button(page, 'Skontrolovať').tap()
      await expect(option(next)).toBeDisabled()
      if (await button(page, 'Pokračovať').isVisible()) break
    }
    await expect(status(page)).toContainText('Správne!')
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

test('a lesson left before it was passed goes on with the tasks not answered right yet', async ({ page }) => {
  await page.goto(lesson('cloze'))
  const header = page.locator('header')
  /** A sentence with two blanks is asked twice, so the answer is whichever blank fits. */
  const answerRight = async () => {
    for (const { answer } of (await askedSentence(page)).cloze!) {
      await field(page).fill(answer)
      await button(page, 'Skontrolovať').tap()
      if (await button(page, 'Pokračovať').isVisible()) break
    }
    await expect(status(page)).toContainText('Správne!')
    await button(page, 'Pokračovať').tap()
  }

  // Two right, one wrong, seven not reached.
  await answerRight()
  await answerRight()
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Pokračovať').tap()
  await expect(header).toContainText('4/10')
  await button(page, 'Ukončiť lekciu').tap()
  await button(page, 'Ukončiť').tap()

  // Back in the lesson: only the eight that are still open, the score goes on from 2.
  await page.goto(lesson('cloze'))
  await expect(header).toContainText('1/8')
  await expect(page.getByText('Lekcia 1 · pokračovanie')).toBeVisible()
  await answerRight()
  await page.goto(lesson('cloze'))
  await expect(header).toContainText('1/7')

  // Through to the end: the result counts the answers from before too.
  for (let left = 7; left > 0; left--) await answerRight()
  await expect(page.getByRole('heading', { name: 'Lekcia 1 splnená' })).toBeVisible()
  await expect(page.getByText('Splnené (10/10)')).toBeVisible()
})

test('Cvičiť names the picked exercise, topic and level right above its button, and a tap on it leads to them', async ({ page }) => {
  // All topics: lessons enough below the options for the page to scroll all the way to them.
  await page.goto('/practice?type=cloze&topic=all&level=A1')
  const picked = button(page, 'Doplňovačka · Všetky témy · A1')
  await expect(picked).toBeInViewport({ ratio: 1 })
  // Seen together with the button, without scrolling up to the options.
  expect(await gapAboveBottom(page, picked)).toBeLessThan(200)
  expect((await picked.boundingBox())!.height).toBeGreaterThanOrEqual(44)

  // Topic and level are further down the page; the tap brings both between the header and the bar.
  const level = page.getByRole('radio', { name: 'Všetky', exact: true })
  await expect(level).not.toBeInViewport()
  await picked.tap()
  // The scroll is animated: it has arrived when the topic heading sits right under the header.
  const headerBottom = await page.locator('header').evaluate((header) => header.getBoundingClientRect().bottom)
  const topicTop = async () => (await page.locator('#topic-heading').boundingBox())!.y - headerBottom
  await expect.poll(topicTop).toBeLessThan(40)
  expect(await topicTop()).toBeGreaterThanOrEqual(0)
  const levelBox = (await level.boundingBox())!
  expect(levelBox.y + levelBox.height).toBeLessThanOrEqual((await picked.boundingBox())!.y)

  await page.getByRole('button', { name: 'Jedlo a pitie', exact: true }).tap()
  await level.tap()
  await expect(button(page, 'Doplňovačka · Jedlo a pitie · Všetky úrovne')).toBeInViewport({ ratio: 1 })
  await page.getByRole('radio', { name: /^Časovanie/ }).tap()
  await expect(page.getByRole('button', { name: /^Časovanie · .+ · Všetky úrovne$/ })).toBeInViewport({ ratio: 1 })
})

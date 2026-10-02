import { expect, test, type Page } from '@playwright/test'
import type { Sentence } from '../src/data/types.ts'
import { askedSentence, button, field, status, tips } from './helpers.ts'

const lesson = (type: string) => `/practice/lesson?type=${type}&topic=all&level=A1&lesson=1`
const counter = (page: Page) => page.locator('header').first()
const tipLink = (page: Page) => page.getByRole('button', { name: /^(Prečo\?|Gramatika k vete)$/ })

/** Gives up the tasks of a cloze lesson until one asks for ser or estar; that task is left unanswered. */
async function reachSerEstar(page: Page): Promise<Sentence> {
  for (let n = 1; n <= 10; n++) {
    await expect(counter(page)).toContainText(`${n}/10`)
    const sentence = await askedSentence(page)
    if (sentence.cloze![0].hint?.startsWith('ser/estar')) return sentence
    await button(page, 'Vzdať sa').tap()
    await button(page, 'Pokračovať').tap()
  }
  throw new Error('no ser/estar task in this lesson')
}

test('"Prečo?" explains why a sentence takes ser or estar, and the back button closes it', async ({ page }) => {
  await page.goto(lesson('cloze'))
  const sentence = await reachSerEstar(page)
  const rule = tips.find((t) => t.id === 'ser-estar')!.rules.find((r) => r.id === sentence.cloze![0].why)!
  const position = await counter(page).innerText()

  await button(page, 'Vzdať sa').tap()
  await button(page, 'Prečo?').tap()
  const tip = page.getByRole('dialog')
  await expect(tip.getByRole('heading', { level: 1 })).toHaveText('ser a estar')
  const here = tip.getByLabel('V tejto vete')
  await expect(here).toContainText(sentence.es)
  await expect(here).toContainText(rule.because!)
  // The rule that applies is right there with its examples: nothing to scroll for and look up in the list below.
  await expect(here.getByRole('heading', { name: rule.title, exact: true })).toBeInViewport({ ratio: 1 })
  await expect(here.getByText(rule.examples[0].es, { exact: true })).toBeInViewport({ ratio: 1 })
  await expect(tip.getByRole('heading', { name: 'Celý prehľad' })).toBeVisible()

  // The phone's back button closes the tip; the lesson has not moved or restarted.
  await page.goBack()
  await expect(tip).toHaveCount(0)
  await expect(status(page)).toContainText('Správna odpoveď')
  await expect(counter(page)).toHaveText(position)

  // "Pozri aj" stays inside the tip: still one step back to the lesson.
  await button(page, 'Prečo?').tap()
  await tip.getByRole('button', { name: 'Zhoda prídavných mien' }).tap()
  await expect(tip.getByRole('heading', { level: 1 })).toHaveText('Zhoda prídavných mien')
  await expect(tip.getByLabel('V tejto vete')).toHaveCount(0)
  await tip.getByRole('button', { name: 'Zavrieť' }).tap()
  await expect(tip).toHaveCount(0)
  await expect(status(page)).toContainText('Správna odpoveď')
  await expect(counter(page)).toHaveText(position)

  // Reloaded with the tip open: the lesson starts over and no tip hangs over it, now or after the next answer.
  await button(page, 'Prečo?').tap()
  await expect(tip).toBeVisible()
  await page.reload()
  await expect(field(page)).toBeVisible()
  await expect(tip).toHaveCount(0)
  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Správna odpoveď')
  await expect(tip).toHaveCount(0)
})

test('the tips can be read as a handbook from Cvičiť', async ({ page }) => {
  await page.goto('/practice')
  await page.getByRole('link', { name: /Gramatika/ }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gramatika')
  const list = page.getByRole('main').getByRole('listitem')
  await expect(list).toHaveCount(tips.length)
  expect(tips.length).toBe(12)

  await list.getByRole('link', { name: /^ser a estar/ }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ser a estar')
  await expect(page.getByRole('heading', { level: 2, name: 'ser', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'estar', exact: true })).toBeVisible()
  // Read on its own, a tip has no sentence to explain.
  await expect(page.getByLabel('V tejto vete')).toHaveCount(0)

  await page.getByRole('button', { name: 'Zhoda prídavných mien' }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Zhoda prídavných mien')
  await button(page, 'Späť').tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ser a estar')

  await page.goto('/practice/grammar/nope')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tip sa nenašiel')
})

test('a whole sentence links to its grammar topic, if it has one', async ({ page }) => {
  await page.goto(lesson('translation'))
  const sentence = await askedSentence(page)
  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Správna odpoveď')
  if (sentence.grammar?.length) {
    await button(page, 'Gramatika k vete').tap()
    await expect(page.getByRole('dialog').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('dialog').getByLabel('V tejto vete')).toHaveCount(0)
  } else {
    await expect(tipLink(page)).toHaveCount(0)
  }
})

test('there is no link without a tip or after a right answer', async ({ page }) => {
  // Vocabulary has no grammar tip.
  await page.goto(lesson('vocab'))
  await expect(field(page)).toBeVisible()
  await button(page, 'Vzdať sa').tap()
  await expect(status(page)).toContainText('Správna odpoveď')
  await expect(tipLink(page)).toHaveCount(0)

  // A right answer needs no explanation.
  await page.goto(lesson('cloze'))
  const sentence = await askedSentence(page)
  await field(page).fill(sentence.cloze![0].answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne!')
  await expect(tipLink(page)).toHaveCount(0)
})

import { expect, test, type Page } from '@playwright/test'
import type { Sentence } from '../src/data/types.ts'
import { askedSentence, button, field, status, tips } from './helpers.ts'

const lesson = (type: string) => `/practice/lesson?type=${type}&topic=all&level=A1&lesson=1`
const counter = (page: Page) => page.locator('header').first()
const tipLink = (page: Page) => page.getByRole('button', { name: /^(Prečo\?|Gramatika k vete)$/ })

/** Gives up the tasks of a cloze lesson until one fits; that task is left unanswered. */
async function reach(page: Page, fits: (sentence: Sentence) => boolean): Promise<Sentence> {
  for (let n = 1; n <= 10; n++) {
    await expect(counter(page)).toContainText(`${n}/10`)
    const sentence = await askedSentence(page)
    if (fits(sentence)) return sentence
    await button(page, 'Vzdať sa').tap()
    await button(page, 'Pokračovať').tap()
  }
  throw new Error('no such task in this lesson')
}

const reachSerEstar = (page: Page) => reach(page, (s) => Boolean(s.cloze![0].hint?.startsWith('ser/estar')))

test('"Prečo?" explains why a sentence takes ser or estar, and the back button closes it', async ({ page }) => {
  // One topic keeps its lessons in id order: new content elsewhere does not move the ser/estar tasks out of lesson 1.
  await page.goto('/practice/lesson?type=cloze&topic=greetings&level=A1&lesson=1')
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
  // (.last(): the sentence asked can itself be the rule's first example.)
  await expect(here.getByText(rule.examples[0].es, { exact: true }).last()).toBeInViewport({ ratio: 1 })
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

test('"Prečo?" on a verb form answers for that form first: the reason, its rule, then the handbook', async ({ page }) => {
  await page.goto('/practice/lesson?type=conjugation&tense=preterito&level=A1&lesson=1')
  await expect(field(page)).toBeVisible()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Prečo?').tap()

  const tip = page.getByRole('dialog')
  const here = tip.getByLabel('V tejto úlohe')
  // What was asked, why, and the rule with an example: all on the first screen, nothing to look up.
  await expect(here).toContainText('· pretérito')
  await expect(here.getByText('Pravidlo', { exact: true })).toBeInViewport({ ratio: 1 })
  const rule = here.getByRole('heading', { level: 3 })
  await expect(rule).toBeInViewport({ ratio: 1 })
  const preterito = tips.find((t) => t.id === 'preterito')!
  const title = await rule.innerText()
  const found = preterito.rules.find((r) => r.title === title)!
  await expect(here.getByText(found.examples[0].es, { exact: true })).toBeInViewport({ ratio: 1 })

  // The handbook page follows, with the same rule marked in its list.
  await expect(tip.getByRole('heading', { name: 'Celý prehľad' })).toBeVisible()
  await expect(tip.getByRole('heading', { level: 1 })).toHaveText(preterito.title)
  const marked = tip.locator('li.ring-1')
  await expect(marked).toHaveCount(1)
  await expect(marked.getByRole('heading', { level: 3 })).toHaveText(title)
})

test('"Prečo?" on a blank that asks for a tense shows the sentence, the reason and the rule', async ({ page }) => {
  await page.goto(lesson('cloze'))
  const tense = /^[^/]+ · \S+ · (presente|pretérito|imperfecto|futuro)$/
  const sentence = await reach(page, (s) => tense.test(s.cloze![0].hint ?? ''))
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Prečo?').tap()

  const here = page.getByRole('dialog').getByLabel('V tejto vete')
  await expect(here).toContainText(sentence.es)
  await expect(here).toContainText(sentence.cloze![0].hint!)
  await expect(here.getByText('Pravidlo', { exact: true })).toBeInViewport({ ratio: 1 })
  await expect(here.getByRole('heading', { level: 3 })).toBeInViewport({ ratio: 1 })
  await expect(page.getByRole('dialog').locator('li.ring-1')).toHaveCount(1)
})

test('the tips can be read as a handbook from Cvičiť', async ({ page }) => {
  await page.goto('/practice')
  await page.getByRole('link', { name: /Gramatika/ }).tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gramatika')
  const list = page.getByRole('main').getByRole('listitem')
  await expect(list).toHaveCount(tips.length)
  expect(tips.length).toBe(49)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  // The level chips narrow the list, "Všetko" brings it back.
  const levels = page.getByRole('group', { name: 'Úroveň' })
  await levels.getByRole('button', { name: 'B2', exact: true }).tap()
  await expect(list).toHaveCount(tips.filter((tip) => tip.level === 'B2').length)
  await levels.getByRole('button', { name: 'Všetko', exact: true }).tap()
  await expect(list).toHaveCount(tips.length)

  // The search ignores accents; Back from a tip returns to the same query.
  const doubt = tips.find((tip) => tip.id === 'doubt')!
  const field = page.getByRole('searchbox', { name: 'Hľadať v gramatike' })
  await field.fill('quiza')
  await expect(list.first()).toContainText(doubt.title)
  await list.first().getByRole('link').tap()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(doubt.title)
  await button(page, 'Späť').tap()
  await expect(field).toHaveValue('quiza')
  await expect(list.first()).toContainText(doubt.title)
  await field.fill('zzzzz')
  await expect(page.getByText('Nenašli sme nič pre „zzzzz“.')).toBeVisible()
  await field.fill('')
  await expect(list).toHaveCount(tips.length)

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

test('the grammar handbook is grouped by area and a tip names its source', async ({ page }) => {
  await page.goto('/practice/grammar')
  for (const area of ['Slovesá a časy', 'Spôsoby a podmienky', 'Ser, estar a iné slovesá', 'Podstatné a prídavné mená', 'Zámená', 'Vety a spojky', 'Pravopis']) {
    await expect(page.getByRole('heading', { name: new RegExp(`^${area} · [0-9]+$`) })).toBeVisible()
  }
  await page.getByRole('link', { name: /Subjuntivo presente/ }).tap()
  await expect(page.getByText(/^Podľa: Plan curricular del Instituto Cervantes/)).toBeVisible()
})

test('a tense of the conjugation drill opens its grammar before the lesson, and the back button closes it', async ({ page }) => {
  await page.goto('/practice?type=conjugation&tense=all')
  // "Všetky časy" has no single tense to explain.
  await expect(page.getByRole('button', { name: /^Ťahák:/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'pretérito', exact: true }).tap()
  await page.getByRole('button', { name: /^Ťahák: pretérito/ }).tap()
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Pretérito (dokončený minulý čas)')
  // What the tense is for comes first, before how it is formed.
  await expect(sheet.getByRole('heading', { level: 3 }).first()).toHaveText('Kedy sa používa')
  await expect(sheet).toContainText('la semana pasada')

  await page.goBack()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Časovanie')

  await page.getByRole('button', { name: /^Ťahák: pretérito/ }).tap()
  await button(page, 'Zavrieť').tap()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/tense=preterito/)
})

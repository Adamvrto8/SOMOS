import { expect, test, type Page } from '@playwright/test'
import { askedSentence, button, field, status } from './helpers.ts'

const LESSON = '/practice/lesson?type=cloze&topic=all&level=A1&lesson=1'

/** Answers /api/report like the server; returns the bodies it got. */
async function fakeReports(page: Page, statusCode = 204) {
  const bodies: Record<string, unknown>[] = []
  await page.route('**/api/report', async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>)
    await route.fulfill({ status: statusCode })
  })
  return bodies
}

test('a sentence is reported from the feedback sheet, and the lesson goes on', async ({ page }) => {
  const bodies = await fakeReports(page)
  await page.goto(LESSON)
  const sentence = await askedSentence(page)
  await field(page).fill(sentence.cloze![0].answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne!')

  await button(page, 'Nahlásiť chybu').tap()
  // A right answer: nothing to accept, so that reason is not offered.
  await expect(page.getByRole('radio', { name: 'Moja odpoveď mala byť uznaná' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Zlý alebo neprirodzený preklad' }).check()
  await page.getByLabel('Poznámka (nepovinná)').fill('Znie to strojovo.')
  await button(page, 'Odoslať').tap()
  await expect(page.getByText('Ďakujeme, pozrieme sa na to.')).toBeVisible()
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toMatchObject({
    target: `sentence:${sentence.id}`,
    detail: '0',
    exercise: 'cloze',
    reason: 'translation',
    note: 'Znie to strojovo.',
    answer: null,
    shown: { es: sentence.es },
  })

  // The flag stays filled today, and the lesson is where it was.
  await expect(button(page, 'Nahlásené')).toBeVisible()
  await button(page, 'Pokračovať').tap()
  await expect(page.locator('header')).toContainText('2/10')
})

test('"my answer should have been accepted" sends the answer', async ({ page }) => {
  const bodies = await fakeReports(page)
  await page.goto(LESSON)
  await askedSentence(page)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await button(page, 'Vzdať sa').tap()
  await button(page, 'Nahlásiť chybu').tap()
  await page.getByRole('radio', { name: 'Moja odpoveď mala byť uznaná' }).check()
  await button(page, 'Odoslať').tap()
  await expect(page.getByText('Ďakujeme, pozrieme sa na to.')).toBeVisible()
  expect(bodies[0]).toMatchObject({ reason: 'answer', answer: 'zzzz' })
})

test('Detail slova reports the word; a failed send keeps what was chosen and written', async ({ page }) => {
  await fakeReports(page, 500)
  await page.goto('/word/casa')
  await button(page, 'Nahlásiť chybu').tap()
  // Detail slova has no answer to accept.
  await expect(page.getByRole('radio', { name: 'Moja odpoveď mala byť uznaná' })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Chyba v španielčine' }).check()
  await page.getByLabel('Poznámka (nepovinná)').fill('Rod?')
  await button(page, 'Odoslať').tap()
  await expect(page.getByRole('alert')).toContainText('Nepodarilo sa odoslať. Skús to znova.')
  await expect(page.getByRole('radio', { name: 'Chyba v španielčine' })).toBeChecked()
  await expect(page.getByLabel('Poznámka (nepovinná)')).toHaveValue('Rod?')
  // Zrušiť closes it; nothing was reported.
  await button(page, 'Zrušiť').tap()
  await expect(button(page, 'Nahlásiť chybu')).toBeVisible()
})

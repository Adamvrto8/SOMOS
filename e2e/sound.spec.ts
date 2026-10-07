import { expect, test, type Page } from '@playwright/test'
import { askedSentence, button, field, status } from './helpers.ts'

/** Counts the notes the page starts, by their waveform: the only way to "hear" a sound here. */
async function listen(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const heard: string[] = []
    ;(window as unknown as { heard: string[] }).heard = heard
    const start = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (...args) {
      heard.push(this.type)
      return start.apply(this, args)
    }
  })
  return () => page.evaluate(() => (window as unknown as { heard: string[] }).heard.splice(0))
}

test('the sounds are chosen in Nastavenia, heard at once, and the choice survives a reload', async ({ page }) => {
  const heard = await listen(page)
  await page.goto('/archive/settings')
  await expect(page.getByRole('radio', { name: 'Suave' })).toBeChecked()
  expect(await heard()).toEqual([])

  // Marimba: a struck bar is three partials, and "correct" is two notes.
  await page.getByRole('radio', { name: 'Marimba' }).tap()
  expect(await heard()).toHaveLength(6)

  await page.getByRole('radio', { name: 'Vypnuté' }).tap()
  expect(await heard()).toEqual([])
  await page.reload()
  await expect(page.getByRole('radio', { name: 'Vypnuté' })).toBeChecked()
})

test('an answer in a lesson is heard: wrong, then right', async ({ page }) => {
  const heard = await listen(page)
  await page.goto('/practice/lesson?type=cloze&topic=all&level=A1&lesson=1')
  const answer = (await askedSentence(page)).cloze![0].answer

  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Ešte to nie je ono')
  // Suave: wrong is one low triangle note.
  expect(await heard()).toEqual(['triangle'])

  await field(page).fill(answer)
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Správne!')
  expect(await heard()).toEqual(['sine', 'sine'])
})

test('with the sounds off, a lesson is silent', async ({ page }) => {
  const heard = await listen(page)
  await page.addInitScript(() => localStorage.setItem('somos-sound', 'off'))
  await page.goto('/practice/lesson?type=cloze&topic=all&level=A1&lesson=1')
  await askedSentence(page)
  await field(page).fill('zzzz')
  await button(page, 'Skontrolovať').tap()
  await expect(status(page)).toContainText('Ešte to nie je ono')
  expect(await heard()).toEqual([])
})

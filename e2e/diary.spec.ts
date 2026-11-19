// e2e/diary.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

const note = (page: Page) => page.getByLabel('Čo si chceš zapamätať?')
const today = (page: Page) => page.getByRole('link', { name: /^Dnes/ })

test('a diary day: kept after a reload, listed, removed when the text is cleared', async ({ page }) => {
  await page.goto('/diary')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
  await today(page).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)

  await note(page).fill('el pretérito de ir: fui, fuiste, fue\nHoy fui al mercado.')
  await expect(page.getByText('Uložené')).toBeVisible()
  await page.reload()
  await expect(note(page)).toHaveValue('el pretérito de ir: fui, fuiste, fue\nHoy fui al mercado.')

  await page.goto('/diary')
  await expect(today(page)).toContainText('el pretérito de ir: fui, fuiste, fue')
  await expect(today(page)).not.toContainText('Hoy fui al mercado.')

  // Typed and left at once: the last text is still saved.
  await today(page).tap()
  await note(page).fill('')
  await button(page, 'Späť').tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(today(page)).toContainText('Dnes ešte nič')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
})

test('"Uložiť" stores the text at once and closes the keyboard', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  const save = page.getByRole('button', { name: 'Uložiť', exact: true })
  await expect(save).toBeVisible()
  await note(page).fill('Hoy aprendí el pretérito.')
  // Well before the 800 ms of the typing pause: only the button can have stored it.
  await save.tap()
  await expect(note(page)).not.toBeFocused()
  await expect(page.getByText('Uložené', { exact: true })).toBeVisible({ timeout: 500 })
  await page.reload()
  await expect(note(page)).toHaveValue('Hoy aprendí el pretérito.')
})

test('a wrong or future date goes back to the diary', async ({ page }) => {
  await page.goto('/diary/2026-13-45')
  await expect(page).toHaveURL(/\/diary$/)
  await page.goto('/diary/2999-01-01')
  await expect(page).toHaveURL(/\/diary$/)
})

test('the Domov card: a hint and "Napísať", then ✓ and the first line of the entry', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Dnešný zápis' })
  await expect(card).toContainText('Zapíš si, čo si chceš zapamätať')
  await card.getByRole('link', { name: 'Napísať' }).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)
  await note(page).fill('ser vs estar\nestar = kde a ako')
  await expect(page.getByText('Uložené')).toBeVisible()

  await page.goto('/')
  await expect(card).toContainText('ser vs estar')
  await expect(card).not.toContainText('estar = kde a ako')
  await expect(card.getByRole('link', { name: 'Napísať' })).toHaveCount(0)
  await card.getByRole('link', { name: 'Všetky zápisy' }).tap()
  await expect(page).toHaveURL(/\/diary$/)
})

test('going from one day to another in the history shows that day’s own text', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await note(page).fill('Hoy comí tacos.')
  await expect(page.getByText('Uložené')).toBeVisible()
  // Yesterday, reached inside the app (as the history does), not by a fresh load.
  await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    window.history.pushState({}, '', `/diary/${key}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(note(page)).toHaveValue('')
})

test('the app going to the background saves what was typed at once', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await note(page).fill('Hoy fui al parque.')
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  // Well before the 800 ms of the typing pause: only the background save can have stored it.
  await page.waitForTimeout(250)
  const stored = await page.evaluate(
    () =>
      new Promise<string | undefined>((resolve) => {
        const open = indexedDB.open('somos')
        open.onsuccess = () => {
          const rows = open.result.transaction('diary').objectStore('diary').getAll()
          rows.onsuccess = () => resolve((rows.result as { text: string }[])[0]?.text)
        }
      }),
  )
  expect(stored).toBe('Hoy fui al parque.')
})

// e2e/diary.spec.ts
import { expect, test, type Page } from '@playwright/test'
import { button } from './helpers.ts'

const learned = (page: Page) => page.getByLabel('Čo som sa dnes naučil')
const spanish = (page: Page) => page.getByLabel('Po španielsky')
const today = (page: Page) => page.getByRole('link', { name: /^Dnes/ })

test('a diary day: kept after a reload, listed, removed when both fields are cleared', async ({ page }) => {
  await page.goto('/diary')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
  await today(page).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)

  await learned(page).fill('el pretérito de ir')
  await spanish(page).fill('Hoy fui al mercado con mi hermana.')
  await expect(page.getByText('Uložené')).toBeVisible()
  await page.reload()
  await expect(spanish(page)).toHaveValue('Hoy fui al mercado con mi hermana.')
  await expect(learned(page)).toHaveValue('el pretérito de ir')

  await page.goto('/diary')
  await expect(today(page)).toContainText('Hoy fui al mercado con mi hermana.')

  // Typed and left at once: the last text is still saved.
  await today(page).tap()
  await learned(page).fill('')
  await spanish(page).fill('')
  await button(page, 'Späť').tap()
  await expect(page).toHaveURL(/\/diary$/)
  await expect(today(page)).toContainText('Dnes ešte nič')
  await expect(page.getByText('Zatiaľ nemáš žiadny zápis.')).toBeVisible()
})

test('the check underlines an unknown word with a suggestion; a verb form opens its verb', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await spanish(page).fill('Manana tengo clase con Ana.')
  const check = page.getByRole('region', { name: 'Kontrola' })
  await check.getByRole('button', { name: 'Manana' }).tap()
  await expect(check.getByRole('status')).toContainText('„Manana“ nepoznám.')
  await expect(check.getByRole('status')).toContainText('Možno: mañana')
  // A name and known words are not marked.
  await expect(check.getByRole('button')).toHaveCount(1)
  await check.getByRole('link', { name: 'tengo' }).tap()
  await expect(page).toHaveURL(/\/word\/tener$/)
})

test('a wrong or future date goes back to the diary', async ({ page }) => {
  await page.goto('/diary/2026-13-45')
  await expect(page).toHaveURL(/\/diary$/)
  await page.goto('/diary/2999-01-01')
  await expect(page).toHaveURL(/\/diary$/)
})

test('the Domov card: the day’s prompt and "Napísať", then ✓ and the first line of the entry', async ({ page }) => {
  await page.goto('/')
  const card = page.getByRole('region', { name: 'Dnešný zápis' })
  await expect(card.locator('[lang="es"]').first()).toHaveText(/\?$|\.$/)
  await card.getByRole('link', { name: 'Napísať' }).tap()
  await expect(page).toHaveURL(/\/diary\/\d{4}-\d{2}-\d{2}$/)
  await spanish(page).fill('Hoy comí tacos.\nDespués fui al parque.')
  await expect(page.getByText('Uložené')).toBeVisible()

  await page.goto('/')
  await expect(card).toContainText('Hoy comí tacos.')
  await expect(card).not.toContainText('Después fui al parque.')
  await expect(card.getByRole('link', { name: 'Napísať' })).toHaveCount(0)
  await card.getByRole('link', { name: 'Všetky zápisy' }).tap()
  await expect(page).toHaveURL(/\/diary$/)
})

test('going from one day to another in the history shows that day’s own text', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await spanish(page).fill('Hoy comí tacos.')
  await expect(page.getByText('Uložené')).toBeVisible()
  // Yesterday, reached inside the app (as the history does), not by a fresh load.
  await page.evaluate(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    window.history.pushState({}, '', `/diary/${key}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(spanish(page)).toHaveValue('')
})

test('the app going to the background saves what was typed at once', async ({ page }) => {
  await page.goto('/diary')
  await today(page).tap()
  await spanish(page).fill('Hoy fui al parque.')
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
          rows.onsuccess = () => resolve((rows.result as { es: string }[])[0]?.es)
        }
      }),
  )
  expect(stored).toBe('Hoy fui al parque.')
})
